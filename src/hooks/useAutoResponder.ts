import { NonEmptyString100, sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { cluster } from "radash";
import { useEffect, useRef } from "react";
import { useAutoResponderState } from "../components/listeners/AutoResponderState";
import {
    calculateRandomDelay,
    isMarcoMessage,
    reconstructDeleteMessage,
    reconstructReactionMessage,
    reconstructTextMessage,
    shouldAutorespond,
} from "../lib/marco-polo/autoresponder";
import {
    lastNReactionsQuery,
    lastNTextMessagesQuery,
} from "../lib/marco-polo/queries";
import type { TypedWsClient } from "../lib/sockets";
import {
    type DeleteMessage,
    isMarcoPoloMessage,
    isReactionMessage,
    isTextMessage,
    type MarcoPoloMessage,
    type ReactionMessage,
    type TextMessage,
    type WsMessage,
    WsMessageType,
} from "../lib/sockets";
import { useZustand } from "./use-zustand";

interface UseAutoResponderOptions {
    socketClient: TypedWsClient;
    channelId: string;
    uuid: string | undefined;
    encryptionKey: string | undefined;
    encrypted: boolean;
}

/**
 * Hook that handles autoresponder functionality for Marco messages.
 * Monitors incoming messages, schedules autoresponses, and sends catch-up messages.
 */
export function useAutoResponder(options: UseAutoResponderOptions) {
    const { socketClient, channelId, uuid, encryptionKey, encrypted } = options;
    const state = useAutoResponderState();

    // Query last N messages and reactions
    const textMessages = useQuery(
        lastNTextMessagesQuery(NonEmptyString100.orThrow(channelId.slice(0, 100))),
    );
    const reactions = useQuery(
        lastNReactionsQuery(NonEmptyString100.orThrow(channelId.slice(0, 100))),
    );
    // Use textMessages for reaction lookup (they include deleted messages)

    // Refs to keep latest values
    const textMessagesRef = useRef(textMessages);
    textMessagesRef.current = textMessages;
    const reactionsRef = useRef(reactions);
    reactionsRef.current = reactions;

    // Debug logging for query results
    useEffect(() => {
        console.log("[AUTORESPONDER] Query results updated:", {
            channelId,
            textMessagesCount: textMessages?.length ?? 0,
            reactionsCount: reactions?.length ?? 0,
            textMessages: textMessages,
            reactions: reactions,
        });
    }, [channelId, textMessages, reactions]);

    // Handler for Marco messages
    useEffect(() => {
        if (!uuid) return;

        const handler = (e: WsMessage) => {
            if (!isMarcoPoloMessage(e.message)) {
                return;
            }

            const payload: MarcoPoloMessage = e.message;
            if (payload.channelId !== channelId) {
                return;
            }

            // Only handle Marco messages (empty user/channel)
            if (!isMarcoMessage(payload)) {
                return;
            }

            // Must have a UUID
            if (!payload.uuid) {
                return;
            }

            // Track Marco message for spam detection
            state.recordMarcoMessage(payload.uuid);

            // Get current user config (in case it changed)
            const currentUser = useZustand.getState().user;
            
            // Check if we should autorespond
            if (!shouldAutorespond(payload, state, currentUser)) {
                return;
            }

            // Get current messages and reactions
            const currentTextMessages = textMessagesRef.current ?? [];
            const currentReactions = reactionsRef.current ?? [];

            console.log("[AUTORESPONDER] Marco message received, preparing to respond:", {
                marcoUuid: payload.uuid,
                textMessagesCount: currentTextMessages.length,
                reactionsCount: currentReactions.length,
                channelId: payload.channelId,
            });

            // Note: Idempotency filtering happens per-message during sending

            // Calculate random delay
            const delay = calculateRandomDelay(0, 500);

            // Schedule autoresponse
            const marcoUuid = payload.uuid;
            if (!marcoUuid) {
                return;
            }

            const timeoutId = setTimeout(() => {
                // Double-check we should still respond (might have been cancelled)
                const scheduledTimeout = state.cancelAutoresponse(marcoUuid);
                if (!scheduledTimeout) {
                    // Was cancelled
                    return;
                }

                // Record autoresponse
                if (marcoUuid) {
                    state.recordAutoresponse(marcoUuid);
                    state.updateCooldown(marcoUuid);
                }

                // Re-read messages and reactions in case they've updated during the delay
                const latestTextMessages = textMessagesRef.current ?? [];
                const latestReactions = reactionsRef.current ?? [];

                console.log("[AUTORESPONDER] Sending catch-up messages:", {
                    textMessagesCount: latestTextMessages.length,
                    reactionsCount: latestReactions.length,
                });

                const messageMap = new Map(
                    latestTextMessages.map((m) => [m.id, m]),
                );

                // Collect all messages to send (for batching)
                type MessageToSend =
                    | { type: "text"; message: TextMessage; networkMessageId: string }
                    | { type: "delete"; message: DeleteMessage; networkMessageId: string }
                    | { type: "reaction"; message: ReactionMessage; networkMessageId: string };
                const messagesToSend: MessageToSend[] = [];

                // Process TEXT messages
                for (const dbMessage of latestTextMessages) {
                    if (!dbMessage.networkMessageId) {
                        continue;
                    }

                    // Check idempotency again (might have heard it during delay)
                    if (
                        state.hasHeardMessage(dbMessage.networkMessageId, 10000) ||
                        state.hasSentMessage(dbMessage.networkMessageId, 10000)
                    ) {
                        continue;
                    }

                    if (dbMessage.isDeleted === sqliteTrue) {
                        // Send DELETE message
                        // Include the original message creator's UUID for authorization
                        const deleteMsg = reconstructDeleteMessage(
                            dbMessage.networkMessageId,
                            NonEmptyString100.orThrow(channelId.slice(0, 100)),
                            dbMessage.createdBy ?? undefined,
                        );
                        messagesToSend.push({
                            type: "delete",
                            message: deleteMsg,
                            networkMessageId: dbMessage.networkMessageId,
                        });
                        state.recordSentMessage(dbMessage.networkMessageId);
                    } else {
                        // Reconstruct TEXT message
                        const textMsg = reconstructTextMessage(
                            dbMessage,
                            NonEmptyString100.orThrow(channelId.slice(0, 100)),
                            encryptionKey,
                            encrypted,
                        );
                        if (textMsg) {
                            messagesToSend.push({
                                type: "text",
                                message: textMsg,
                                networkMessageId: dbMessage.networkMessageId,
                            });
                            state.recordSentMessage(dbMessage.networkMessageId);
                        }
                    }
                }

                // Process REACTION messages
                for (const dbReaction of latestReactions) {
                    // Skip if messageId is null
                    if (!dbReaction.messageId) {
                        continue;
                    }
                    // messageId is guaranteed non-null after the check above
                    const associatedMessage = messageMap.get(dbReaction.messageId);
                    if (!associatedMessage) {
                        // Message not in set - skip this reaction
                        continue;
                    }

                    // Check idempotency (use networkMessageId + createdBy + reaction + isDeleted as key)
                    // This ensures we distinguish between reactions from different users and deleted vs active reactions
                    const reactionKey = `${associatedMessage.networkMessageId}:${dbReaction.createdBy}:${dbReaction.reaction}:${dbReaction.isDeleted === sqliteTrue}`;
                    if (
                        state.hasHeardMessage(reactionKey, 10000) ||
                        state.hasSentMessage(reactionKey, 10000)
                    ) {
                        continue;
                    }

                    // Reconstruct REACTION message
                    const reactionMsg = reconstructReactionMessage(
                        dbReaction,
                        associatedMessage.networkMessageId,
                        NonEmptyString100.orThrow(channelId.slice(0, 100)),
                    );
                    if (reactionMsg) {
                        messagesToSend.push({
                            type: "reaction",
                            message: reactionMsg,
                            networkMessageId: associatedMessage.networkMessageId,
                        });
                        state.recordSentMessage(reactionKey);
                    }
                }

                // Send messages in batches to avoid network flooding
                // Batch size: 50 messages, delay: 100ms between batches
                const BATCH_SIZE = 50;
                const BATCH_DELAY_MS = 100;

                const sendBatches = async () => {
                    const batches = cluster(messagesToSend, BATCH_SIZE);
                    
                    for (let i = 0; i < batches.length; i++) {
                        const batch = batches[i];
                        
                        // Send batch synchronously
                        for (const { message } of batch) {
                            socketClient.safeSend(message);
                        }

                        // Log batch progress
                        const totalSent = (i + 1) * BATCH_SIZE;
                        console.log(
                            `[AUTORESPONDER] Sent batch ${i + 1}/${batches.length} (${Math.min(totalSent, messagesToSend.length)}/${messagesToSend.length} messages)`,
                        );

                        // Wait before next batch (except for the last batch)
                        if (i < batches.length - 1) {
                            await new Promise((resolve) =>
                                setTimeout(resolve, BATCH_DELAY_MS),
                            );
                        }
                    }
                };

                // Start sending batches (non-blocking)
                sendBatches().catch((err) => {
                    console.error("[AUTORESPONDER] Error sending batches:", err);
                });
            }, delay);

            // Store scheduled timeout for potential cancellation
            state.scheduleAutoresponse(marcoUuid, timeoutId);
        };

        socketClient.on(WsMessageType.MARCO_POLO, handler);
        return () => {
            // Cleanup: cancel any pending autoresponses on unmount
            // Note: We can't easily enumerate all scheduled timeouts, but they'll be cleaned up by LRU
        };
    }, [socketClient, state, channelId, uuid, encryptionKey, encrypted]);

    // Handler for TEXT messages - detect other autoResponders and cancel our scheduled response
    useEffect(() => {
        if (!uuid) return;

        const handler = (e: WsMessage) => {
            if (!isTextMessage(e.message)) {
                return;
            }

            const payload: TextMessage = e.message;
            if (payload.channelId !== channelId) {
                return;
            }

            // Skip our own messages
            if (payload.uuid === uuid) {
                return;
            }

            // Check if this is from another autoResponder
            if (payload.user.autoResponder === true && Date.now() - e.date < 200) {
                // Another autoResponder is responding - cancel all our scheduled responses
                // We don't know which Marco message they're responding to, so cancel all
                const timeouts = state.cancelAllAutoresponses();
                for (const timeoutId of timeouts) {
                    clearTimeout(timeoutId);
                }

                // Record that we heard this message
                state.recordHeardMessage(payload.networkMessageId);
            }
        };

        socketClient.on(WsMessageType.TEXT, handler);
    }, [socketClient, state, channelId, uuid]);

    // Handler for REACTION messages - detect other autoResponders and cancel our scheduled response
    useEffect(() => {
        if (!uuid) return;

        const handler = (e: WsMessage) => {
            if (!isReactionMessage(e.message)) {
                return;
            }

            const payload: ReactionMessage = e.message;
            if (payload.channelId !== channelId) {
                return;
            }

            // Skip our own messages
            if (payload.uuid === uuid) {
                return;
            }

            // For reactions, we need to check if the sender has autoResponder flag
            // But ReactionMessage doesn't include user data, so we can't directly check
            // Instead, we'll use timestamp diff as a heuristic
            // If timestamp diff is very small, it's likely from another autoResponder
            if (Date.now() - e.date < 200) {
                // Likely from another autoResponder - cancel all our scheduled responses
                // We don't know which Marco message they're responding to, so cancel all
                const timeouts = state.cancelAllAutoresponses();
                for (const timeoutId of timeouts) {
                    clearTimeout(timeoutId);
                }

                // Record that we heard this reaction (use networkMessageId + uuid + reaction + isDeleted as key)
                // This matches the key format used when sending reactions
                const reactionKey = `${payload.networkMessageId}:${payload.uuid}:${payload.reaction}:${payload.isDeleted}`;
                state.recordHeardMessage(reactionKey);
            }
        };

        socketClient.on(WsMessageType.REACTION, handler);
    }, [socketClient, state, channelId, uuid]);
}

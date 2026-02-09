import { NonEmptyString100, sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { cluster } from "radash";
import { useEffect, useMemo, useRef } from "react";
import type { Hex } from "viem";
import { useAutoResponderState } from "../components/listeners/AutoResponderState";
import { evoluInstance } from "../lib/local-first";
import {
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
import type { CurrentUserData, KnownMessage, TypedWsClient } from "../lib/sockets";
import {
	type DeleteMessage,
	isEncryptedMessage,
	isMarcoPoloMessage,
	isReactionMessage,
	isTextMessage,
	type MarcoPoloMessage,
	type ReactionMessage,
	type TextMessage,
	type WsMessage,
	WsMessageType,
} from "../lib/sockets";
import {
	decryptMessagePayload,
	prepareEncryptedMessage,
} from "../lib/symmetric-encryption";
import { useZustand } from "./use-zustand";

interface UseAutoResponderOptions {
	socketClient: TypedWsClient | null;
	channelId: string;
	uuid: string | undefined;
}

/**
 * Hook that handles autoresponder functionality for Marco messages.
 * Monitors incoming messages, schedules autoresponses, and sends catch-up messages.
 */
export function useAutoResponder(options: UseAutoResponderOptions) {
	const { socketClient, channelId, uuid } = options;
	const state = useAutoResponderState();

	// Query last N messages and reactions
	const textMessages = useQuery(
		lastNTextMessagesQuery(NonEmptyString100.orThrow(channelId.slice(0, 100))),
	);
	const reactions = useQuery(
		lastNReactionsQuery(NonEmptyString100.orThrow(channelId.slice(0, 100))),
	);
	// Use textMessages for reaction lookup (they include deleted messages)

	// Collect unique user UUIDs from messages to query their latest data
	// This is memory-efficient: we query only the users we need, database handles it efficiently
	const uniqueSenderUuids = useMemo(() => {
		const uuids = new Set<string>();
		for (const msg of textMessages ?? []) {
			if (msg.createdBy) {
				uuids.add(msg.createdBy);
			}
		}
		return Array.from(uuids);
	}, [textMessages]);

	// Query only the specific users we need using WHERE IN clause
	// This is more efficient than querying all users:
	// - Database only reads rows we need (indexed lookup)
	// - Memory: Only ~50 users in query result (~2-5KB) vs all users (~200KB+)
	// - Network sync: Only syncs users we actually need
	// - Scales better: Performance doesn't degrade as total user count grows
	const targetedUsers = useQuery(
		evoluInstance.createQuery((db) => {
			const query = db
				.selectFrom("user")
				.select(["networkUuid", "displayName", "pfpUrl", "publicNtfyShId", "publicEthereumAddress"])
				.where("isDeleted", "is not", sqliteTrue);
			
			// Kysely WHERE IN: need to ensure proper typing
			// If empty array, return empty result set efficiently
			if (uniqueSenderUuids.length === 0) {
				return query.where("networkUuid", "is", null); // Always false
			}
			
			// Use OR conditions for WHERE IN equivalent
			// This works around Kysely's strict typing for WHERE IN
			return query.where((eb) =>
				eb.or(
					uniqueSenderUuids.map((uuid) =>
						eb("networkUuid", "is", NonEmptyString100.orThrow(uuid.slice(0, 100))),
					),
				),
			);
		}),
	);

	// Build map of latest user data from targeted query results
	// No filtering needed - database already returned only the users we need
	const latestUserDataMap = useMemo(() => {
		const map = new Map<string, CurrentUserData>();
		
		for (const user of targetedUsers ?? []) {
			if (user.networkUuid) {
				map.set(user.networkUuid, {
					displayName: user.displayName ?? "",
					pfpUrl: user.pfpUrl ?? "",
					publicNtfyShId: user.publicNtfyShId ?? "",
					publicEthereumAddress: user.publicEthereumAddress ? `0x${user.publicEthereumAddress.replace("0x", "")}` : null,
				});
			}
		}
		return map;
	}, [targetedUsers]);

	// Refs to keep latest values
	const textMessagesRef = useRef(textMessages);
	textMessagesRef.current = textMessages;
	const reactionsRef = useRef(reactions);
	reactionsRef.current = reactions;
	const latestUserDataMapRef = useRef(latestUserDataMap);
	latestUserDataMapRef.current = latestUserDataMap;

	// Handler for Marco messages
	useEffect(() => {
		if (!uuid || !socketClient) return;

		const handler = (e: WsMessage<KnownMessage>) => {
			let message = e.message;

			// Handle encryption at the top level
			if (isEncryptedMessage(message)) {
				const currentState = useZustand.getState();
				const currentEncryptionKey = currentState.channel.encryptionKey;
				const decrypted = decryptMessagePayload<MarcoPoloMessage>(
					message,
					currentEncryptionKey ?? "",
				);
				if (!decrypted) return;
				message = decrypted;
			}

			if (!isMarcoPoloMessage(message)) {
				return;
			}

			const payload: MarcoPoloMessage = message;
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

			console.log(
				"[AUTORESPONDER] Marco message received, checking if should respond:",
				{
					marcoUuid: payload.uuid,
					channelId: payload.channelId,
				},
			);

			// Check if we should autorespond
			if (!shouldAutorespond(payload, state)) {
				return;
			}

			// Get current messages and reactions
			const currentTextMessages = textMessagesRef.current ?? [];
			const currentReactions = reactionsRef.current ?? [];

			console.log(
				"[AUTORESPONDER] Marco message received, preparing to respond:",
				{
					marcoUuid: payload.uuid,
					textMessagesCount: currentTextMessages.length,
					reactionsCount: currentReactions.length,
					channelId: payload.channelId,
				},
			);

			// Small random delay (0-200ms) to prevent network swarming when multiple
			// autoresponders respond to the same Marco message simultaneously.
			// Also helps if React render loops cause rapid re-renders.
			// Idempotency checks still prevent duplicate sends.
			const delay = Math.floor(Math.random() * 200);

			// Schedule autoresponse
			const marcoUuid = payload.uuid;
			if (!marcoUuid) {
				return;
			}

			// Collect messages to send
			// Note: For reactions, we use reactionKey for idempotency tracking, not networkMessageId
			type MessageToSend =
				| {
						type: "text";
						message: TextMessage;
						networkMessageId: string;
						idempotencyKey: string;
				  }
				| {
						type: "delete";
						message: DeleteMessage;
						networkMessageId: string;
						idempotencyKey: string;
				  }
				| {
						type: "reaction";
						message: ReactionMessage;
						networkMessageId: string;
						idempotencyKey: string;
				  };
			const messagesToSend: MessageToSend[] = [];

			// Process TEXT messages - check idempotency IMMEDIATELY
			// Since networkMessageId should not be reused, we don't need deduplication
			// However, the query includes deleted messages, so we need to handle them separately
			// (send DELETE messages for deleted ones, TEXT messages for non-deleted ones)
			console.log("[AUTORESPONDER] Query results:", {
				totalMessages: currentTextMessages.length,
				deletedCount: currentTextMessages.filter(
					(m) => m.isDeleted === sqliteTrue,
				).length,
				nonDeletedCount: currentTextMessages.filter(
					(m) => m.isDeleted !== sqliteTrue,
				).length,
				sample: currentTextMessages.slice(0, 5).map((m) => ({
					id: m.id,
					networkMessageId: m.networkMessageId,
					isDeleted: m.isDeleted,
					updatedAt: m.updatedAt,
				})),
			});

			// Use latest user data from database queries (memory-efficient)
			// Database queries are fast and indexed - better than keeping data in memory
			// The map is built reactively via useMemo and kept in a ref for handler access
			const latestUserDataMap = latestUserDataMapRef.current;

			// Track which networkMessageIds we've already processed to avoid duplicates
			// (shouldn't happen if networkMessageId is unique, but defensive programming)
			const processedNetworkIds = new Set<string>();

			// Process messages - separate deleted and non-deleted
			for (const dbMessage of currentTextMessages) {
				if (!dbMessage.networkMessageId) {
					continue;
				}

				// Skip if we've already processed this networkMessageId
				// (shouldn't happen, but defensive programming)
				if (processedNetworkIds.has(dbMessage.networkMessageId)) {
					console.warn(
						"[AUTORESPONDER] Duplicate networkMessageId detected (should not happen):",
						{
							networkMessageId: dbMessage.networkMessageId,
							id: dbMessage.id,
							isDeleted: dbMessage.isDeleted,
						},
					);
					continue;
				}
				processedNetworkIds.add(dbMessage.networkMessageId);

				// Check idempotency: already heard or already sent
				if (
					state.hasHeardMessage(dbMessage.networkMessageId, 10000) ||
					state.hasSentMessage(dbMessage.networkMessageId, 10000)
				) {
					continue;
				}

				if (dbMessage.isDeleted === sqliteTrue) {
					// Send DELETE message (signed or unsigned based on what's stored)
					const signature = dbMessage.signature
						? (`0x${dbMessage.signature.replace("0x", "")}` as Hex)
						: null;
					const deleteMsg = reconstructDeleteMessage(
						dbMessage.networkMessageId,
						NonEmptyString100.orThrow(channelId.slice(0, 100)),
						dbMessage.createdBy ?? "",
						signature,
					);
					messagesToSend.push({
						type: "delete",
						message: deleteMsg,
						networkMessageId: dbMessage.networkMessageId,
						idempotencyKey: dbMessage.networkMessageId,
					});
				} else {
					// Get latest user data for this message's sender
					const latestUserData = dbMessage.createdBy
						? latestUserDataMap.get(dbMessage.createdBy) ?? null
						: null;

					// Reconstruct TEXT message with hybrid approach:
					// - Historical status/bio from message (context)
					// - Latest displayName/pfpUrl/publicNtfyShId from DB (recognition/functionality)
					const textMsg = reconstructTextMessage(
						dbMessage,
						NonEmptyString100.orThrow(channelId.slice(0, 100)),
						latestUserData,
					);
					if (textMsg) {
						messagesToSend.push({
							type: "text",
							message: textMsg,
							networkMessageId: dbMessage.networkMessageId,
							idempotencyKey: dbMessage.networkMessageId,
						});
					}
				}
			}

			// Process REACTION messages
			console.log("[AUTORESPONDER] Processing reactions:", {
				reactionsCount: currentReactions.length,
				reactions: currentReactions.map((r) => ({
					id: r.id,
					messageId: r.messageId,
					networkMessageId: r.networkMessageId,
					reaction: r.reaction,
					createdBy: r.createdBy,
					isDeleted: r.isDeleted,
				})),
			});
			for (const dbReaction of currentReactions) {
				// Skip if messageId or networkMessageId is null
				if (!dbReaction.messageId || !dbReaction.networkMessageId) {
					continue;
				}

				// Check idempotency (use networkMessageId + createdBy + reaction + isDeleted as key)
				const reactionKey = `${dbReaction.networkMessageId}:${dbReaction.createdBy}:${dbReaction.reaction}:${dbReaction.isDeleted === sqliteTrue}`;
				const hasHeard = state.hasHeardMessage(reactionKey, 10000);
				const hasSent = state.hasSentMessage(reactionKey, 10000);
				if (hasHeard || hasSent) {
					continue;
				}

				// Reconstruct REACTION message
				const reactionMsg = reconstructReactionMessage(
					dbReaction,
					dbReaction.networkMessageId,
					NonEmptyString100.orThrow(channelId.slice(0, 100)),
				);
				if (reactionMsg) {
					messagesToSend.push({
						type: "reaction",
						message: reactionMsg,
						networkMessageId: dbReaction.networkMessageId,
						idempotencyKey: reactionKey, // Use reactionKey for reactions, not networkMessageId
					});
				} else {
					console.log("[AUTORESPONDER] Failed to reconstruct reaction:", {
						dbReaction,
					});
				}
			}

			// If no messages to send, don't schedule a timeout
			if (messagesToSend.length === 0) {
				return;
			}

			console.log("[AUTORESPONDER] Scheduling autoresponse:", {
				marcoUuid,
				messagesCount: messagesToSend.length,
				delay,
			});

			const timeoutId = setTimeout(() => {
				// Double-check we should still respond (might have been cancelled)
				// cancelAutoresponse removes the timeout from cache and returns it
				// If it returns null, the timeout was cancelled (or never scheduled)
				// Note: If a newer timeout was scheduled for the same UUID, we'll get that one,
				// which is fine - we're still responding to a Marco message
				const scheduledTimeout = state.cancelAutoresponse(marcoUuid);
				if (!scheduledTimeout) {
					// Was cancelled - idempotency checks will prevent re-sending
					console.log(
						"[AUTORESPONDER] Autoresponse was cancelled, skipping send",
					);
					return;
				}

				// Read latest encryption settings at send time
				const currentState = useZustand.getState();
				const currentEncryptionKey = currentState.channel.encryptionKey;
				const currentEncrypted = currentState.channel.encrypted;

				console.log("[AUTORESPONDER] Executing scheduled autoresponse:", {
					marcoUuid,
					messagesCount: messagesToSend.length,
					timeoutId,
					scheduledTimeout,
					encrypted: currentEncrypted,
					hasEncryptionKey: !!currentEncryptionKey,
				});

				// Record autoresponse
				if (marcoUuid) {
					state.updateCooldown(marcoUuid);
				}

				// Sort messages to ensure TEXT messages are sent before DELETE messages
				// This prevents DELETE messages from being buffered and immediately deleting
				// newly inserted TEXT messages during catchup
				const sortedMessages = [...messagesToSend].sort((a, b) => {
					// TEXT messages come before DELETE messages
					if (a.type === "text" && b.type === "delete") return -1;
					if (a.type === "delete" && b.type === "text") return 1;
					// Within same type, maintain original order
					return 0;
				});

				console.log("[AUTORESPONDER] Sending catch-up messages:", {
					textMessagesCount: sortedMessages.length,
				});

				// Record messages as sent (idempotency tracking prevents duplicates)
				for (const msg of sortedMessages) {
					state.recordSentMessage(msg.idempotencyKey);
				}

				// Send messages in batches to avoid network flooding
				// Batch size: 50 messages, small delay between batches for network health
				// The delay helps prevent overwhelming the network when sending many messages
				const BATCH_SIZE = 50;
				const BATCH_DELAY_MS = 50; // Small delay to prevent network swarming

				const sendBatches = async () => {
					const batches = cluster(sortedMessages, BATCH_SIZE);

					for (let i = 0; i < batches.length; i++) {
						const batch = batches[i];

						// Send batch synchronously
						for (const { message } of batch) {
							const messageToSend = prepareEncryptedMessage(
								message,
								currentEncrypted,
								currentEncryptionKey,
							);
							socketClient.safeSend(messageToSend);
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
	}, [socketClient, state, channelId, uuid]);

	// Handler for TEXT messages - detect other autoResponders and cancel our scheduled response
	useEffect(() => {
		if (!uuid || !socketClient) return;

		const handler = (e: WsMessage<KnownMessage>) => {
			let message = e.message;

			// Handle encryption at the top level
			if (isEncryptedMessage(message)) {
				const currentState = useZustand.getState();
				const currentEncryptionKey = currentState.channel.encryptionKey;
				const decrypted = decryptMessagePayload<TextMessage>(
					message,
					currentEncryptionKey ?? "",
				);
				if (!decrypted) return;
				message = decrypted;
			}

			if (!isTextMessage(message)) {
				return;
			}

			const payload: TextMessage = message;
			if (payload.channelId !== channelId) {
				return;
			}

			// Skip our own messages
			if (payload.uuid === uuid) {
				return;
			}

			// Check if this is from another autoResponder
			if (payload.autoResponder === true && Date.now() - e.date < 200) {
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
		if (!uuid || !socketClient) return;

		const handler = (e: WsMessage<KnownMessage>) => {
			let message = e.message;

			// Handle encryption at the top level
			if (isEncryptedMessage(message)) {
				const currentState = useZustand.getState();
				const currentEncryptionKey = currentState.channel.encryptionKey;
				const decrypted = decryptMessagePayload<ReactionMessage>(
					message,
					currentEncryptionKey ?? "",
				);
				if (!decrypted) return;
				message = decrypted;
			}

			if (!isReactionMessage(message)) {
				return;
			}

			const payload: ReactionMessage = message;
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

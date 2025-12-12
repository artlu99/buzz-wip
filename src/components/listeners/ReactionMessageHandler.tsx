import { NonEmptyString100, sqliteFalse, sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useRef } from "react";
import { lru } from "tiny-lru";
import { useZustand } from "../../hooks/use-zustand";
import {
	type AllReactionsForChannelRow,
	allReactionsForChannelQuery,
	type MessageId,
	messagesQuery,
	useEvolu,
} from "../../lib/local-first";
import {
	isReactionMessage,
	type ReactionMessage,
	type WsMessage,
	WsMessageType,
} from "../../lib/sockets";
import {
	getSafeNetworkTimestamp,
	validateNetworkTimestamp,
} from "../../lib/timestamp-validation";
import { useSocket } from "../../providers/SocketProvider";

// Buffer reactions that arrive before their messages
// Key: networkMessageId, Value: array of pending reactions
type PendingReaction = {
	payload: ReactionMessage;
	timestamp: number;
};

export const ReactionMessageHandler = () => {
	const socketClient = useSocket();
	const { insert, update } = useEvolu();
	const { channel } = useZustand();
	const { channelId } = channel;

	const allReactions = useQuery(allReactionsForChannelQuery(channelId));
	const allMessages = useQuery(messagesQuery());

	// Use refs to ensure handler always reads latest values from Evolu
	const allReactionsRef = useRef(allReactions);
	allReactionsRef.current = allReactions;
	const allMessagesRef = useRef(allMessages);
	allMessagesRef.current = allMessages;

	// LRU cache for reactions that arrive before their messages
	// Max 200 entries with 30s TTL - automatically evicts expired or LRU entries
	const pendingReactionsRef = useRef(
		lru<PendingReaction[]>(200, 30000, true), // max=200, ttl=30s, resetTtl=true
	);

	useEffect(() => {
		const handler = (e: WsMessage) => {
			if (!isReactionMessage(e.message)) return;

			const payload: ReactionMessage = e.message;

			// Use getState() to read current values without subscribing
			const state = useZustand.getState();
			const currentChannelId = state.channel.channelId;
			const currentUuid = state.uuid;

			console.log("[REACTION HANDLER] Received reaction:", {
				networkMessageId: payload.networkMessageId,
				uuid: payload.uuid,
				reaction: payload.reaction,
				isDeleted: payload.isDeleted,
				channelId: payload.channelId,
				currentChannelId,
				currentUuid,
			});

			// Early return if not for current channel
			if (payload.channelId !== currentChannelId) {
				console.log("[REACTION HANDLER] Skipping - wrong channel");
				return;
			}

			if (payload.uuid === currentUuid) {
				console.log("[REACTION HANDLER] Skipping - own reaction");
				return;
			}

			// Always read latest values from Evolu via refs
			const currentReactions = allReactionsRef.current ?? [];
			const currentMessages = allMessagesRef.current ?? [];

			// Find the message by networkMessageId to get the local message id
			const localMessage = currentMessages.find(
				(msg) => msg.networkMessageId === payload.networkMessageId,
			);

			if (!localMessage) {
				// Message not found yet - buffer this reaction for later processing
				console.log(
					"[REACTION HANDLER] Message not found, buffering reaction:",
					{
						networkMessageId: payload.networkMessageId,
						channelId: payload.channelId,
						availableMessages: currentMessages.length,
					},
				);

				// Get existing pending reactions for this message, or create new array
				const pending =
					pendingReactionsRef.current.get(payload.networkMessageId) ?? [];
				pending.push({
					payload,
					timestamp: Date.now(),
				});
				// LRU cache automatically handles TTL expiration and eviction when full
				// resetTtl=true means updating resets the 30s timer
				pendingReactionsRef.current.set(payload.networkMessageId, pending);

				return;
			}

			console.log("[REACTION HANDLER] Found message, processing reaction:", {
				localMessageId: localMessage.id,
				networkMessageId: payload.networkMessageId,
			});

			// Process the reaction
			processReaction(
				payload,
				localMessage.id,
				currentReactions,
				insert,
				update,
			);
		};

		socketClient.on(WsMessageType.REACTION, handler);
	}, [socketClient, insert, update]);

	// Process pending reactions when messages are updated
	useEffect(() => {
		const currentMessages = allMessages ?? [];
		const currentReactions = allReactions ?? [];
		const pendingCache = pendingReactionsRef.current;

		// Check each pending reaction to see if its message has arrived
		// Use keys() to iterate since LRU cache doesn't have entries() method
		const networkMessageIds = Array.from(pendingCache.keys());
		for (const networkMessageId of networkMessageIds) {
			const reactions = pendingCache.get(networkMessageId);
			if (!reactions) continue;

			const localMessage = currentMessages.find(
				(msg) => msg.networkMessageId === networkMessageId,
			);

			if (localMessage) {
				// Message found! Process all pending reactions for this message
				// Note: If reactions expired, get() returns undefined due to TTL
				console.log(
					"[REACTION HANDLER] Processing buffered reactions for message:",
					{
						networkMessageId,
						localMessageId: localMessage.id,
						pendingCount: reactions.length,
					},
				);

				// Process all reactions - database-level matching ensures idempotency
				for (const { payload } of reactions) {
					processReaction(
						payload,
						localMessage.id,
						currentReactions,
						insert,
						update,
					);
				}

				// Remove from cache (LRU will handle eviction automatically)
				pendingCache.delete(networkMessageId);
			}
		}
	}, [allMessages, allReactions, insert, update]);

	return null;
};

/**
 * Process a reaction message by inserting or updating it in the database.
 */
function processReaction(
	payload: ReactionMessage,
	localMessageId: MessageId,
	currentReactions: readonly AllReactionsForChannelRow[],
	insert: ReturnType<typeof useEvolu>["insert"],
	update: ReturnType<typeof useEvolu>["update"],
) {
	// Find the reaction by matching on network identifiers: networkMessageId, createdBy, and reaction type
	// This ensures matching works correctly across distributed stores, not just local messageId
	// Note: We check all reactions (including deleted) to find the right one to update
	const existingReaction = currentReactions.find(
		(r) =>
			r.networkMessageId === payload.networkMessageId &&
			r.createdBy === payload.uuid &&
			String(r.reaction) === String(payload.reaction),
	);

	if (payload.isDeleted) {
		if (existingReaction && existingReaction.isDeleted !== sqliteTrue) {
			// Update networkTimestamp when deleting (use DELETE timestamp)
			const safeNetworkTimestamp = getSafeNetworkTimestamp(
				payload.networkTimestamp,
				Date.now(),
			);
			update("reaction", {
				id: existingReaction.id,
				isDeleted: sqliteTrue,
				networkTimestamp: NonEmptyString100.orThrow(
					safeNetworkTimestamp.slice(0, 100),
				),
			});
		} else if (existingReaction && existingReaction.isDeleted === sqliteTrue) {
			// Already deleted - no-op (idempotent)
		}
	} else {
		if (existingReaction) {
			if (existingReaction.isDeleted === sqliteTrue) {
				// Update networkTimestamp when restoring
				const safeNetworkTimestamp = getSafeNetworkTimestamp(
					payload.networkTimestamp,
					Date.now(),
				);
				update("reaction", {
					id: existingReaction.id,
					isDeleted: sqliteFalse,
					networkTimestamp: NonEmptyString100.orThrow(
						safeNetworkTimestamp.slice(0, 100),
					),
				});
			} else {
				// Reaction already exists and is active - no-op (idempotent)
			}
		} else {
			// Validate and get safe network timestamp
			const timestampValidation = validateNetworkTimestamp(
				payload.networkTimestamp,
				Date.now(),
			);
			if (!timestampValidation.valid && timestampValidation.reason) {
				console.warn("[REACTION HANDLER] Invalid networkTimestamp:", {
					networkMessageId: payload.networkMessageId,
					reason: timestampValidation.reason,
					originalTimestamp: timestampValidation.originalTimestamp,
				});
			}
			const safeNetworkTimestamp = getSafeNetworkTimestamp(
				payload.networkTimestamp,
				Date.now(),
			);

			insert("reaction", {
				messageId: localMessageId,
				reaction: NonEmptyString100.orThrow(payload.reaction.slice(0, 100)),
				channelId: NonEmptyString100.orThrow(payload.channelId.slice(0, 100)),
				createdBy: payload.uuid,
				networkTimestamp: NonEmptyString100.orThrow(
					safeNetworkTimestamp.slice(0, 100),
				),
			});
		}
	}
}

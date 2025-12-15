import {
	createIdFromString,
	NonEmptyString100,
	String100,
	String1000,
	sqliteFalse,
	sqliteTrue,
} from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useRef } from "react";
import { lru } from "tiny-lru";
import { useZustand } from "../../hooks/use-zustand";
import {
	type MessageId,
	type MessagesForChannelRow,
	messagesForChannelQuery,
	useEvolu,
} from "../../lib/local-first";
import {
	isReactionMessage,
	type KnownMessage,
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
	const { upsert } = useEvolu();
	const { channel } = useZustand();
	const { channelId } = channel;

	const allMessages = useQuery(
		messagesForChannelQuery(NonEmptyString100.orThrow(channelId.slice(0, 100))),
	);

	// Use refs to ensure handler always reads latest values from Evolu
	const allMessagesRef = useRef(allMessages);
	allMessagesRef.current = allMessages;

	// LRU cache for reactions that arrive before their messages
	// Max 200 entries with 30s TTL - automatically evicts expired or LRU entries
	const pendingReactionsRef = useRef(
		lru<PendingReaction[]>(200, 30000, true), // max=200, ttl=30s, resetTtl=true
	);

	useEffect(() => {
		const handler = (e: WsMessage<KnownMessage>) => {
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
			processReaction(payload, localMessage.id, currentMessages, upsert);
		};

		socketClient.on(WsMessageType.REACTION, handler);
	}, [socketClient, upsert]);

	// Process pending reactions when messages are updated
	useEffect(() => {
		const currentMessages = allMessages ?? [];
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

				// Process all reactions - deterministic IDs ensure idempotency
				for (const { payload } of reactions) {
					processReaction(payload, localMessage.id, currentMessages, upsert);
				}

				// Remove from cache (LRU will handle eviction automatically)
				pendingCache.delete(networkMessageId);
			}
		}
	}, [allMessages, upsert]);

	return null;
};

/**
 * Process a reaction message by upserting it in the database using a deterministic ID.
 * Uses network identifiers (networkMessageId, createdBy, reaction) to create a deterministic ID,
 * ensuring database-level idempotency and preventing race conditions.
 * Also ensures the user exists in the database.
 */
function processReaction(
	payload: ReactionMessage,
	localMessageId: MessageId,
	currentMessages: readonly MessagesForChannelRow[],
	upsert: ReturnType<typeof useEvolu>["upsert"],
) {
	// Ensure user exists - extract from existing message if available
	const networkUuid = NonEmptyString100.orThrow(payload.uuid);
	const userMessage = currentMessages.find(
		(msg) => msg.createdBy === payload.uuid,
	);

	if (userMessage?.user) {
		try {
			const userData = JSON.parse(userMessage.user);
			upsert("user", {
				id: createIdFromString(networkUuid),
				networkUuid,
				displayName: String100.orThrow(
					userData.displayName?.slice(0, 100) ?? "<none>",
				),
				pfpUrl: String1000.orThrow(userData.pfpUrl?.slice(0, 1000) ?? "<none>"),
				bio: String1000.orThrow(userData.bio?.slice(0, 1000) ?? ""),
				status: String100.orThrow(userData.status?.slice(0, 100) ?? ""),
				publicNtfyShId: String100.orThrow(userData.publicNtfyShId?.slice(0, 100) ?? ""),
				privateNtfyShId: String100.orThrow(""),
			});
		} catch {
			// Invalid user data - create minimal record
			upsert("user", {
				id: createIdFromString(networkUuid),
				networkUuid,
				displayName: String100.orThrow("<none>"),
				pfpUrl: String1000.orThrow("<none>"),
				bio: String1000.orThrow(""),
				status: String100.orThrow(""),
				publicNtfyShId: String100.orThrow(""),
				privateNtfyShId: String100.orThrow(""),
			});
		}
	} else {
		// No message from this user yet - create minimal record
		// Will be updated when Polo or TEXT message arrives
		upsert("user", {
			id: createIdFromString(networkUuid),
			networkUuid,
			displayName: String100.orThrow("<none>"),
			pfpUrl: String1000.orThrow("<none>"),
			bio: String1000.orThrow(""),
			status: String100.orThrow(""),
			publicNtfyShId: String100.orThrow(""),
			privateNtfyShId: String100.orThrow(""),
		});
	}
	// Create deterministic ID from network identifiers for idempotent upsert
	// This ensures database-level uniqueness: same (networkMessageId, createdBy, reaction) = same ID
	// This prevents race conditions - upsert is atomic at the database level
	const reactionId = createIdFromString(
		`${payload.networkMessageId}:${payload.uuid}:${payload.reaction}`,
	);

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

	// Use upsert with deterministic ID - database handles insert-or-update atomically
	// This prevents race conditions: if two instances try to insert the same reaction,
	// the second upsert will update the first, ensuring only one reaction exists
	upsert("reaction", {
		id: reactionId,
		messageId: localMessageId,
		networkMessageId: NonEmptyString100.orThrow(
			payload.networkMessageId.slice(0, 100),
		),
		reaction: NonEmptyString100.orThrow(payload.reaction.slice(0, 100)),
		channelId: NonEmptyString100.orThrow(payload.channelId.slice(0, 100)),
		createdBy: payload.uuid,
		networkTimestamp: NonEmptyString100.orThrow(
			safeNetworkTimestamp.slice(0, 100),
		),
		isDeleted: payload.isDeleted ? sqliteTrue : sqliteFalse,
	});
}

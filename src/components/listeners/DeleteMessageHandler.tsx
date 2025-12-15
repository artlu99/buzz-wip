import { sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useRef } from "react";
import invariant from "tiny-invariant";
import { lru } from "tiny-lru";
import {
	type AllReactionsForAllMessagesRow,
	allReactionsForAllMessagesQuery,
	type MessagesRow,
	messagesQuery,
	useEvolu,
} from "../../lib/local-first";
import {
	type DeleteMessage,
	isDeleteMessage,
	type KnownMessage,
	type WsMessage,
	WsMessageType,
} from "../../lib/sockets";
import { validateDeleteTimestamp } from "../../lib/timestamp-validation";
import { useSocket } from "../../providers/SocketProvider";

// Buffer DELETE messages that arrive before their messages
type PendingDelete = {
	payload: DeleteMessage;
	timestamp: number;
};

export const DeleteMessageHandler = () => {
	const socketClient = useSocket();
	const { update } = useEvolu();
	const allMessages = useQuery(messagesQuery());
	const allReactions = useQuery(allReactionsForAllMessagesQuery());

	// Use refs to ensure handler always reads latest values from Evolu
	const allMessagesRef = useRef(allMessages);
	allMessagesRef.current = allMessages;
	const allReactionsRef = useRef(allReactions);
	allReactionsRef.current = allReactions;

	// LRU cache for DELETE messages that arrive before their messages
	// Max 200 entries with 30s TTL - automatically evicts expired or LRU entries
	const pendingDeletesRef = useRef(
		lru<PendingDelete>(200, 30000, true), // max=200, ttl=30s, resetTtl=true
	);

	useEffect(() => {
		const handler = (e: WsMessage<KnownMessage>) => {
			if (!isDeleteMessage(e.message)) return;

			const payload: DeleteMessage = e.message;

			// Always read latest values from Evolu via ref
			const currentMessages = allMessagesRef.current ?? [];

			// Match by networkMessageId - this is consistent across all distributed stores
			const messages = currentMessages.filter(
				(msg) => msg.networkMessageId === payload.networkMessageId,
			);

			if (messages.length === 0) {
				// Message not found yet - buffer this DELETE for later processing
				console.log("[DELETE HANDLER] Message not found, buffering DELETE:", {
					networkMessageId: payload.networkMessageId,
					channelId: payload.channelId,
					availableMessages: currentMessages.length,
				});

				// Store in LRU cache (TTL handles expiration automatically)
				pendingDeletesRef.current.set(payload.networkMessageId, {
					payload,
					timestamp: Date.now(),
				});

				return;
			}

			// Process the DELETE message
			processDeleteMessage(
				payload,
				messages,
				allReactionsRef.current ?? [],
				update,
			);
		};

		socketClient.on(WsMessageType.DELETE, handler);
	}, [socketClient, update]);

	// Process pending DELETE messages when messages are updated
	useEffect(() => {
		const currentMessages = allMessages ?? [];
		const currentReactions = allReactions ?? [];
		const pendingCache = pendingDeletesRef.current;

		// Check each pending DELETE to see if its message has arrived
		const networkMessageIds = Array.from(pendingCache.keys());
		for (const networkMessageId of networkMessageIds) {
			const pendingDelete = pendingCache.get(networkMessageId);
			if (!pendingDelete) continue;

			const messages = currentMessages.filter(
				(msg) => msg.networkMessageId === networkMessageId,
			);

			if (messages.length > 0) {
				// Message found! Process the DELETE
				console.log(
					"[DELETE HANDLER] Processing buffered DELETE for message:",
					{
						networkMessageId,
						localMessageIds: messages.map((m) => m.id),
					},
				);

				processDeleteMessage(
					pendingDelete.payload,
					messages,
					currentReactions,
					update,
				);

				// Remove from cache (LRU will handle eviction automatically)
				pendingCache.delete(networkMessageId);
			}
		}
	}, [allMessages, allReactions, update]);

	return null;
};

/**
 * Process a DELETE message by soft-deleting the message and its reactions.
 */
function processDeleteMessage(
	payload: DeleteMessage,
	messages: readonly MessagesRow[],
	currentReactions: readonly AllReactionsForAllMessagesRow[],
	update: ReturnType<typeof useEvolu>["update"],
) {
	// Verify the message is in the correct channel (safety check)
	if (messages.some((msg) => msg.channelId !== payload.channelId)) {
		console.warn("[DELETE HANDLER] Channel mismatch:", {
			networkMessageId: payload.networkMessageId,
			payloadChannel: payload.channelId,
		});
		return;
	}

	// Only allow deletion by the original sender (security check)
	// Verify it matches the message creator
	invariant(
		payload.uuid !== undefined,
		"uuid is required on every DELETE message",
	);
	if (messages.some((msg) => msg.createdBy !== payload.uuid)) {
		console.warn("[DELETE HANDLER] Unauthorized delete attempt:", {
			networkMessageId: payload.networkMessageId,
			deleteAttemptBy: payload.uuid,
			messageCreators: messages.map((m) => m.createdBy),
		});
		return;
	}

	// verify the signature
	if (payload.signature !== null) {
		// TODO: Implement signature verification
		console.warn("[DELETE HANDLER] Signature verification failed:", {
			networkMessageId: payload.networkMessageId,
			signature: payload.signature,
		});
		return;
	}

	// Validate DELETE timestamp against message updatedAt
	if (payload.networkTimestamp) {
		for (const msg of messages) {
			const validation = validateDeleteTimestamp(
				payload.networkTimestamp,
				msg.updatedAt,
			);
			if (!validation.valid) {
				console.warn("[DELETE HANDLER] Timestamp validation triggered:", {
					networkMessageId: payload.networkMessageId,
					reason: validation.reason,
					deleteTimestamp: payload.networkTimestamp,
					messageUpdatedAt: msg.updatedAt,
				});
				// Continue anyway - timestamp mismatch is logged but not fatal
			}
		}
	}

	// Soft delete the message
	messages.forEach((msg) => {
		update("message", {
			id: msg.id,
			isDeleted: sqliteTrue,
		});
	});

	// Soft delete the reactions by querying with foreign key, then updating by primary key
	messages.forEach((msg) => {
		// Find all reactions for this message using the foreign key (messageId)
		const reactionsToDelete = currentReactions.filter(
			(reaction) => reaction.messageId === msg.id,
		);
		// Update each reaction
		reactionsToDelete.forEach((reaction) => {
			update("reaction", {
				id: reaction.id,
				isDeleted: sqliteTrue,
			});
		});
	});
}

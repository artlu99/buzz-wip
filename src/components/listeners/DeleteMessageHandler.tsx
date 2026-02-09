import { sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useRef } from "react";
import invariant from "tiny-invariant";
import { lru } from "tiny-lru";
import { useGarbledStore } from "../../hooks/use-garbled";
import { useZustand } from "../../hooks/use-zustand";
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
	isEncryptedMessage,
	type KnownMessage,
	type WsMessage,
	WsMessageType,
} from "../../lib/sockets";
import { decryptMessagePayload } from "../../lib/symmetric-encryption";
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
		if (!socketClient) return;
		const handler = (e: WsMessage<KnownMessage>) => {
			let message = e.message;

			console.log("[DELETE HANDLER] Received message", {
				isEncrypted: isEncryptedMessage(message),
				type: message.type,
				hasNetworkMessageId: !!message.networkMessageId,
			});

			// Handle encryption at the top level
			if (isEncryptedMessage(message)) {
				const state = useZustand.getState();
				const encryptionKey = state.channel.encryptionKey;
				if (!encryptionKey) {
					// message is encrypted but no decryption key is set
					// We can't process encrypted DELETE without the key
					console.log(
						"[DELETE HANDLER] Encrypted DELETE message received, but no key available. Skipping.",
					);
					return;
				}
				const decrypted = decryptMessagePayload<DeleteMessage>(
					message,
					encryptionKey,
				);
				if (!decrypted) {
					// if we can't decrypt it, remove it from the garbled store
					useGarbledStore
						.getState()
						.removeMessageByNetworkMessageId(message.networkMessageId ?? "");
					return;
				}
				message = decrypted;
				console.log("[DELETE HANDLER] Decrypted message", {
					networkMessageId: message.networkMessageId,
					type: message.type,
				});
			}

			if (!isDeleteMessage(message)) {
				console.log("[DELETE HANDLER] Not a DELETE message, skipping");
				return;
			}

			const payload: DeleteMessage = message;

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

	// verify the signature (when present)
	// For backwards compatibility, we accept unsigned DELETE messages from old clients
	if (payload.signature !== null) {
		// TODO: Implement signature verification using verifyMessageSignature()
		// For now, we accept signatures without verification
		console.log(
			"[DELETE HANDLER] Signed DELETE message (verification not yet implemented):",
			{
				networkMessageId: payload.networkMessageId,
			},
		);
	} else {
		console.log(
			"[DELETE HANDLER] Unsigned DELETE message (backwards compatibility mode):",
			{
				networkMessageId: payload.networkMessageId,
			},
		);
	}

	// Filter messages that should be deleted based on timestamp
	// A DELETE message should only delete messages that existed before the DELETE timestamp
	// This prevents catchup DELETE messages from deleting newly inserted TEXT messages
	let messagesToDelete = messages;
	if (payload.networkTimestamp) {
		const deleteTimestamp = parseInt(payload.networkTimestamp, 10);
		if (!Number.isNaN(deleteTimestamp)) {
			messagesToDelete = messages.filter((msg) => {
				// Only delete if the message was created/updated before the DELETE timestamp
				// This ensures we don't delete messages that were inserted after the DELETE was sent
				const messageTimestamp = new Date(
					msg.updatedAt ?? msg.createdAt,
				).getTime();
				const isValid = messageTimestamp <= deleteTimestamp;
				if (!isValid) {
					console.warn(
						"[DELETE HANDLER] Skipping message - created after DELETE:",
						{
							networkMessageId: payload.networkMessageId,
							messageId: msg.id,
							messageTimestamp,
							deleteTimestamp,
							timeDiff: messageTimestamp - deleteTimestamp,
						},
					);
				}
				return isValid;
			});
		}
	}

	// Validate DELETE timestamp against message updatedAt (for logging)
	if (payload.networkTimestamp) {
		for (const msg of messagesToDelete) {
			const validation = validateDeleteTimestamp(
				payload.networkTimestamp,
				msg.updatedAt ?? msg.createdAt,
			);
			if (!validation.valid) {
				console.warn("[DELETE HANDLER] Timestamp validation triggered:", {
					networkMessageId: payload.networkMessageId,
					reason: validation.reason,
					deleteTimestamp: payload.networkTimestamp,
					messageUpdatedAt: msg.updatedAt ?? msg.createdAt,
				});
				// Continue anyway - timestamp mismatch is logged but not fatal
			}
		}
	}

	if (messagesToDelete.length === 0) {
		console.log("[DELETE HANDLER] No messages to delete (all filtered out):", {
			networkMessageId: payload.networkMessageId,
			totalMatching: messages.length,
		});
		return;
	}

	console.log("[DELETE HANDLER] Deleting messages:", {
		networkMessageId: payload.networkMessageId,
		totalMatching: messages.length,
		toDelete: messagesToDelete.length,
		filteredOut: messages.length - messagesToDelete.length,
	});

	messagesToDelete.forEach((msg) => {
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

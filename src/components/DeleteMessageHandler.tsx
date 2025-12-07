import { sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useRef } from "react";
import {
	allReactionsForAllMessagesQuery,
	messagesQuery,
	useEvolu,
} from "../lib/local-first";
import {
	type DeleteMessage,
	isDeleteMessage,
	type WsMessage,
	WsMessageType,
} from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";

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

	useEffect(() => {
		const handler = (e: WsMessage) => {
			if (!isDeleteMessage(e.message)) return;

			const payload: DeleteMessage = e.message;

			// Always read latest values from Evolu via ref
			const currentMessages = allMessagesRef.current ?? [];

			// Match by networkMessageId - this is consistent across all distributed stores
			const messages = currentMessages.filter(
				(msg) => msg.networkMessageId === payload.networkMessageId,
			);

			if (messages.length === 0) {
				console.warn("[DELETE] Message not found:", {
					networkMessageId: payload.networkMessageId,
					channelName: payload.channelName,
				});
				return;
			}

			// Verify the message is in the correct channel (safety check)
			if (messages.some((msg) => msg.channelName !== payload.channelName)) {
				console.warn("[DELETE] Channel mismatch:", {
					networkMessageId: payload.networkMessageId,
					payloadChannel: payload.channelName,
				});
				return;
			}

			// Only allow deletion by the original sender (security check)
			if (messages.some((msg) => msg.createdBy !== payload.deletedBy)) {
				console.warn("[DELETE] Unauthorized delete attempt:", {
					networkMessageId: payload.networkMessageId,
					deleteAttemptBy: payload.deletedBy,
				});
				return;
			}

			// Soft delete the message
			messages.forEach((msg) => {
				update("message", {
					id: msg.id,
					isDeleted: sqliteTrue,
				});
			});

			// Soft delete the reactions by querying with foreign key, then updating by primary key
			const currentReactions = allReactionsRef.current ?? [];
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
		};

		socketClient.on(WsMessageType.DELETE, handler);
	}, [socketClient, update]);

	return null;
};

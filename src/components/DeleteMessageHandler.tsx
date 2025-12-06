import { sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useRef } from "react";
import { messagesQuery, useEvolu } from "../lib/local-first";
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

	// Use ref to ensure handler always reads latest values from Evolu
	const allMessagesRef = useRef(allMessages);
	allMessagesRef.current = allMessages;

	useEffect(() => {
		const handler = (e: WsMessage) => {
			if (!isDeleteMessage(e.message)) return;

			const payload: DeleteMessage = e.message;

			// Only process delete messages from the original sender
			if (payload.createdBy !== payload.messageCreatedBy) {
				return;
			}

			// Always read latest values from Evolu via ref
			const currentMessages = allMessagesRef.current ?? [];

			// Find the message to delete by matching createdBy and content
			const localMessage = currentMessages.find(
				(msg) =>
					msg.createdBy === payload.messageCreatedBy &&
					msg.content === payload.messageContent,
			);

			if (!localMessage) return;

			// Soft delete the message
			update("message", {
				id: localMessage.id,
				isDeleted: sqliteTrue,
			});
		};

		socketClient.on(WsMessageType.DELETE, handler);
	}, [socketClient, update]);

	return null;
};

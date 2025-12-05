import type { OwnerId } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect } from "react";
import { useZustand } from "../hooks/use-zustand";
import { messagesQuery, useEvolu } from "../lib/local-first";
import {
	isTextMessage,
	type TextMessage,
	type WsMessage,
	WsMessageType,
} from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";

const DUPLICATE_TIME_WINDOW = 2000; // 2 seconds

export const TextMessageHandler = () => {
	const socketClient = useSocket();
	const { insert } = useEvolu();
	const { displayName } = useZustand();
	const existingMessages = useQuery(messagesQuery());

	useEffect(() => {
		socketClient.on(WsMessageType.TEXT, (e: WsMessage) => {
			if (!isTextMessage(e.message)) {
				return;
			}
			const payload: TextMessage = e.message;

			// Skip inserting our own messages (we already inserted them locally)
			if (payload.createdBy === displayName) {
				return;
			}

			// Check for duplicates: same content, same creator, and createdAt within time window
			const isDuplicate = existingMessages?.some((msg) => {
				if (
					msg.content === payload.content &&
					msg.createdBy === payload.createdBy
				) {
					const msgTime = new Date(msg.createdAt).getTime();
					const payloadTime = payload.createdAt;
					const timeDiff = Math.abs(msgTime - payloadTime);
					return timeDiff < DUPLICATE_TIME_WINDOW;
				}
				return false;
			});

			if (isDuplicate) {
				// Skip inserting duplicate message
				return;
			}

			// Insert the message into the database
			insert("message", {
				content: payload.content,
				createdBy: payload.createdBy as OwnerId,
			});
		});
	}, [socketClient, insert, displayName, existingMessages]);

	return null; // This component doesn't render anything
};

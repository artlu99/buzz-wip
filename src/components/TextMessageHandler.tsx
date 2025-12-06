import type { OwnerId } from "@evolu/common";
import { useEffect } from "react";
import { useZustand } from "../hooks/use-zustand";
import { useEvolu } from "../lib/local-first";
import {
	isTextMessage,
	type TextMessage,
	type WsMessage,
	WsMessageType,
} from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";

export const TextMessageHandler = () => {
	const socketClient = useSocket();
	const { insert } = useEvolu();
	const { displayName } = useZustand();

	useEffect(() => {
		const handler = (e: WsMessage) => {
			if (!isTextMessage(e.message)) {
				return;
			}
			const payload: TextMessage = e.message;

			if (payload.createdBy === displayName) return;

			insert("message", {
				content: payload.content,
				createdBy: payload.createdBy as OwnerId,
			});
		};

		socketClient.on(WsMessageType.TEXT, handler);
	}, [socketClient, insert, displayName]);

	return null;
};

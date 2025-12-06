import type { OwnerId } from "@evolu/common";
import { useZustand } from "../hooks/use-zustand";
import { useEvolu } from "../lib/local-first";
import type { TextMessage } from "../lib/sockets";
import {
	type TypingIndicatorMessage,
	TypingIndicatorType,
	WsMessageType,
} from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";
import { TextEntry } from "./TextEntry";

export const MessageSender = () => {
	const { insert } = useEvolu();
	const { displayName } = useZustand();
	const socketClient = useSocket();

	const handleSend = (content: string) => {
		// Insert our own message into the database immediately
		insert("message", {
			content: content,
			createdBy: displayName as OwnerId,
		});

		// Send STOP_TYPING indicator
		const stopTypingMessage: TypingIndicatorMessage = {
			uuid: displayName,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.STOP_TYPING,
		};
		try {
			socketClient.send(stopTypingMessage);
		} catch (err) {
			console.error("Failed to send stop_typing indicator", err);
		}

		// Send the TEXT message over websocket
		// Note: timestamp comes from envelope (e.date), not from payload
		const textMessage: TextMessage = {
			uuid: displayName,
			type: WsMessageType.TEXT,
			content: content,
			createdBy: displayName,
		};
		try {
			socketClient.send(textMessage);
		} catch (err) {
			console.error("Failed to send text message", err);
		}
	};

	const handleTyping = () => {
		const message: TypingIndicatorMessage = {
			uuid: displayName,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.TYPING,
		};
		try {
			socketClient.send(message);
		} catch (err) {
			console.error("Failed to send typing indicator", err);
		}
	};

	const handleStopTyping = () => {
		const message: TypingIndicatorMessage = {
			uuid: displayName,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.STOP_TYPING,
		};
		try {
			socketClient.send(message);
		} catch (err) {
			console.error("Failed to send stop_typing indicator", err);
		}
	};

	return (
		<TextEntry
			onTyping={handleTyping}
			onStopTyping={handleStopTyping}
			onSend={handleSend}
		/>
	);
};

import type { OwnerId } from "@evolu/common";
import { useEvolu } from "../lib/local-first";
import { useZustand } from "../hooks/use-zustand";
import { useSocket } from "../providers/SocketProvider";
import { TextEntry } from "./TextEntry";
import type { TextMessage } from "../lib/sockets";
import {
	WsMessageType,
	TypingIndicatorType,
	type TypingIndicatorMessage,
} from "../lib/sockets";

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
		const textMessage: TextMessage = {
			uuid: displayName,
			type: WsMessageType.TEXT,
			content: content,
			createdAt: Math.floor(Date.now() / 500) * 500, // Round down to nearest half second
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

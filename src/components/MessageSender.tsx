import { createIdFromString } from "@evolu/common";
import { useZustand } from "../hooks/use-zustand";
import { useEvolu } from "../lib/local-first";
import { safeSend } from "../lib/message-utils";
import type { TextMessage } from "../lib/sockets";
import {
	type TypingIndicatorMessage,
	TypingIndicatorType,
	WsMessageType,
} from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";
import { TextEntry } from "./TextEntry";

export const MessageSender = () => {
	const { insert, update } = useEvolu();
	const { channelName, user, uuid } = useZustand();
	const socketClient = useSocket();

	const handleSend = (content: string) => {
		// Insert our own message into the database immediately
		if (!uuid)  {
			console.error("Unable to send message, uuid is not set");
			return;
		};
		const result = insert("message", {
			content: content,
			user: JSON.stringify(user),
			channelName: channelName,
			createdBy: uuid,
			networkMessageId: createIdFromString(crypto.randomUUID()), // temporary, will be overridden next
		});
		if (!result.ok) {
			console.error("Failed to insert message", result.error);
			return;
		}
		const networkMessageId = result.value.id;
		update("message", { id: networkMessageId, networkMessageId });

		// Send STOP_TYPING indicator
		const stopTypingMessage: TypingIndicatorMessage = {
			uuid: uuid,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.STOP_TYPING,
			channelName: channelName,
		};
		safeSend(
			socketClient,
			stopTypingMessage,
			"Failed to send stop_typing indicator",
		);

		// Send the TEXT message over websocket
		// Note: timestamp comes from envelope (e.date), not from payload
		const textMessage: TextMessage = {
			uuid: uuid,
			type: WsMessageType.TEXT,
			content: content,
			user: user,
			channelName: channelName,
			encrypted: false,
			networkMessageId: networkMessageId,
		};
		safeSend(socketClient, textMessage, "Failed to send text message");
	};

	const handleTyping = () => {
		const message: TypingIndicatorMessage = {
			uuid: uuid,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.TYPING,
			channelName: channelName,
		};
		safeSend(socketClient, message, "Failed to send typing indicator");
	};

	const handleStopTyping = () => {
		const message: TypingIndicatorMessage = {
			uuid: uuid,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.STOP_TYPING,
			channelName: channelName,
		};
		safeSend(socketClient, message, "Failed to send stop_typing indicator");
	};

	return (
		<TextEntry
			onTyping={handleTyping}
			onStopTyping={handleStopTyping}
			onSend={handleSend}
		/>
	);
};

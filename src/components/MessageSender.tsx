import { createIdFromString } from "@evolu/common";
import { useZustand } from "../hooks/use-zustand";
import { useEvolu } from "../lib/local-first";
import type { TextMessage } from "../lib/sockets";
import {
	type TypingIndicatorMessage,
	TypingIndicatorType,
	WsMessageType,
} from "../lib/sockets";
import { prepareEncryptedMessage } from "../lib/symmetric-encryption";
import { useSocket } from "../providers/SocketProvider";
import { TextEntry } from "./ui/TextEntry";

export const MessageSender = () => {
	const { insert, update } = useEvolu();
	const { channel, user, uuid, lockdown } = useZustand();
	const { channelId, encrypted, encryptionKey } = channel;
	const socketClient = useSocket();

	const handleTyping = () => {
		if (lockdown || !socketClient) return;
		const message: TypingIndicatorMessage = {
			uuid: uuid,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.TYPING,
			channelId: channelId,
		};
		const messageToSend = prepareEncryptedMessage(
			message,
			encrypted,
			encryptionKey,
		);
		socketClient.safeSend(messageToSend);
	};

	const handleStopTyping = () => {
		if (lockdown || !socketClient) return;
		const message: TypingIndicatorMessage = {
			uuid: uuid,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.STOP_TYPING,
			channelId: channelId,
		};
		const messageToSend = prepareEncryptedMessage(
			message,
			encrypted,
			encryptionKey,
		);
		socketClient.safeSend(messageToSend);
	};

	const handleSend = async (content: string): Promise<void> => {
		// Insert our own message into the database immediately
		if (!uuid) {
			console.error("Unable to send message, uuid is not set");
			return;
		}
		const result = insert("message", {
			content: content,
			user: JSON.stringify(user),
			channelId: channelId,
			createdBy: uuid,
			networkMessageId: createIdFromString(crypto.randomUUID()), // temporary, will be overridden next
			networkTimestamp: Date.now().toString(),
			signature: "",
		});
		if (!result.ok) {
			console.error("Failed to insert message", result.error);
			return;
		}
		const networkMessageId = result.value.id;
		update("message", { id: networkMessageId, networkMessageId });

		if (!socketClient) return;

		// Send STOP_TYPING indicator
		if (!lockdown) {
			const stopTypingMessage: TypingIndicatorMessage = {
				uuid: uuid,
				type: WsMessageType.STATUS,
				presence: TypingIndicatorType.STOP_TYPING,
				channelId: channelId,
			};
			socketClient.safeSend(stopTypingMessage);
		}

		// Send the TEXT message over websocket
		// Note: timestamp comes from envelope (e.date), not from payload
		// this encryption protocol is not secure under most conditions,
		// it uses same-band insecure secret transmission by default
		// and user input without concern for sufficient entropy
		const textMessage: TextMessage = {
			uuid,
			type: WsMessageType.TEXT,
			content,
			user,
			channelId,
			networkMessageId,
			networkTimestamp: Date.now().toString(),
			autoResponder: false,
			signature: null,
		};
		const messageToSend = prepareEncryptedMessage(
			textMessage,
			encrypted,
			encryptionKey,
		);
		socketClient.safeSend(messageToSend);
	};

	return (
		<TextEntry
			onTyping={handleTyping}
			onStopTyping={handleStopTyping}
			onSend={handleSend}
		/>
	);
};

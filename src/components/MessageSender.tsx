import { createIdFromString } from "@evolu/common";
import { useZustand } from "../hooks/use-zustand";
import { useEvolu } from "../lib/local-first";
import type { TextMessage } from "../lib/sockets";
import {
	type TypingIndicatorMessage,
	TypingIndicatorType,
	WsMessageType,
} from "../lib/sockets";
import { prepareMessageContent } from "../lib/symmetric-encryption";
import { useSocket } from "../providers/SocketProvider";
import { TextEntry } from "./ui/TextEntry";

export const MessageSender = () => {
	const { insert, update } = useEvolu();
	const { channel, user, uuid, lockdown } = useZustand();
	const { channelId, encrypted, encryptionKey } = channel;
	const socketClient = useSocket();

	const handleTyping = () => {
		if (lockdown) return;
		const message: TypingIndicatorMessage = {
			uuid: uuid,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.TYPING,
			channelId: channelId,
		};
		socketClient.safeSend(message);
	};

	const handleStopTyping = () => {
		if (lockdown) return;
		const message: TypingIndicatorMessage = {
			uuid: uuid,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.STOP_TYPING,
			channelId: channelId,
		};
		socketClient.safeSend(message);
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
		});
		if (!result.ok) {
			console.error("Failed to insert message", result.error);
			return;
		}
		const networkMessageId = result.value.id;
		update("message", { id: networkMessageId, networkMessageId });

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
		// this encryption protocol is not secure (yet),
		// it uses same-band insecure secret transmission
		// and user input without concern for sufficient entropy
		const { content: messageUuid, encrypted: isUuidEncrypted } =
			prepareMessageContent(uuid, encrypted, encryptionKey);
		const { content: messageContent, encrypted: isMessageEncrypted } =
			prepareMessageContent(content, encrypted, encryptionKey);
		const { content: userContent, encrypted: isUserEncrypted } =
			prepareMessageContent(
				JSON.stringify(user),
				isMessageEncrypted,
				encryptionKey,
			);

		const textMessage: TextMessage = {
			uuid: isUuidEncrypted ? messageUuid : uuid,
			type: WsMessageType.TEXT,
			content: messageContent,
			user:
				isUserEncrypted && typeof userContent !== "string" ? userContent : user,
			channelId: channelId,
			encrypted: isUuidEncrypted || isMessageEncrypted || isUserEncrypted,
			networkMessageId: networkMessageId,
			networkTimestamp: Date.now().toString(),
			autoResponder: false,
		};
		socketClient.safeSend(textMessage);
	};

	return (
		<TextEntry
			onTyping={handleTyping}
			onStopTyping={handleStopTyping}
			onSend={handleSend}
		/>
	);
};

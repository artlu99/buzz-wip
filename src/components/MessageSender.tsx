import {
	createIdFromString,
	createRandomBytes,
	createSymmetricCrypto,
	EncryptionKey,
} from "@evolu/common";
import { useZustand } from "../hooks/use-zustand";
import {
	type SerializedEncryptedData,
	uint8ArrayToBase64,
} from "../lib/helpers";
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
	const { channelId: channelId, user, uuid } = useZustand();
	const socketClient = useSocket();

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
			channelId: channelId,
		};
		safeSend(
			socketClient,
			stopTypingMessage,
			"Failed to send stop_typing indicator",
		);

		// Send the TEXT message over websocket
		// Note: timestamp comes from envelope (e.date), not from payload
		// this encryption protocol is not secure (yet), it uses same-band insecure secret transmission
		const randomBytes = createRandomBytes();
		const seed = randomBytes.create(32); // Type: Random32
		const encryptionKey = EncryptionKey.orThrow(seed);

		const crypt = createSymmetricCrypto({
			randomBytes,
		});
		const plaintextBytes = new TextEncoder().encode(content);
		const encryptedContent = crypt.encrypt(plaintextBytes, encryptionKey);

		const serializedEncryptedContent: SerializedEncryptedData = {
			nonce: uint8ArrayToBase64(encryptedContent.nonce),
			ciphertext: uint8ArrayToBase64(encryptedContent.ciphertext),
		};

		const DO_ENCRYPTION = false;
		const textMessage: TextMessage = {
			uuid: uuid,
			type: WsMessageType.TEXT,
			content: DO_ENCRYPTION ? serializedEncryptedContent : content,
			user: user, // TODO: add encryption for user
			channelId: channelId,
			encrypted: DO_ENCRYPTION,
			networkMessageId: networkMessageId,
		};
		safeSend(socketClient, textMessage, "Failed to send text message");
	};

	const handleTyping = () => {
		const message: TypingIndicatorMessage = {
			uuid: uuid,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.TYPING,
			channelId: channelId,
		};
		safeSend(socketClient, message, "Failed to send typing indicator");
	};

	const handleStopTyping = () => {
		const message: TypingIndicatorMessage = {
			uuid: uuid,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.STOP_TYPING,
			channelId: channelId,
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

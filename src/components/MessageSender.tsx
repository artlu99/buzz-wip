import {
	createIdFromString,
	createRandomBytes,
	createSymmetricCrypto,
	EncryptionKey,
} from "@evolu/common";
import { useZustand } from "../hooks/use-zustand";
import {
	Base64ToUint8Array,
	type SerializedEncryptedData,
	uint8ArrayToBase64,
} from "../lib/helpers";
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
	const { insert, update } = useEvolu();
	const { channelId, encrypted, encryptionKey, user, uuid } = useZustand();
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
		socketClient.safeSend(stopTypingMessage);

		// Send the TEXT message over websocket
		// Note: timestamp comes from envelope (e.date), not from payload
		// this encryption protocol is not secure (yet),
		// it uses same-band insecure secret transmission
		// and user input without concern for sufficient entropy
		const symmetricEncryptionKey = (encryptionKey
			? Base64ToUint8Array(encryptionKey)
			: undefined) as EncryptionKey | undefined;

		const randomBytes = createRandomBytes();
		const crypt = createSymmetricCrypto({
			randomBytes,
		});
		const plaintextBytes = new TextEncoder().encode(content);
		const encryptedContent = symmetricEncryptionKey ? crypt.encrypt(
			plaintextBytes,
			symmetricEncryptionKey,
		) : undefined;

		const serializedEncryptedContent: SerializedEncryptedData|undefined = encryptedContent ? {
			nonce: uint8ArrayToBase64(encryptedContent.nonce),
			ciphertext: uint8ArrayToBase64(encryptedContent.ciphertext),
		} : undefined;

		const DO_ENCRYPTION = encrypted && serializedEncryptedContent && (encryptionKey !== undefined);
		const textMessage: TextMessage = {
			uuid: uuid,
			type: WsMessageType.TEXT,
			content: DO_ENCRYPTION ? serializedEncryptedContent : content,
			user: user, // TODO: add encryption for user
			channelId: channelId,
			encrypted: !!DO_ENCRYPTION,
			networkMessageId: networkMessageId,
		};
		socketClient.safeSend(textMessage);
	};

	const handleTyping = () => {
		const message: TypingIndicatorMessage = {
			uuid: uuid,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.TYPING,
			channelId: channelId,
		};
		socketClient.safeSend(message);
	};

	const handleStopTyping = () => {
		const message: TypingIndicatorMessage = {
			uuid: uuid,
			type: WsMessageType.STATUS,
			presence: TypingIndicatorType.STOP_TYPING,
			channelId: channelId,
		};
		socketClient.safeSend(message);
	};

	return (
		<TextEntry
			onTyping={handleTyping}
			onStopTyping={handleStopTyping}
			onSend={handleSend}
		/>
	);
};

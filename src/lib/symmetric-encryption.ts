import {
	createRandomBytes,
	createSymmetricCrypto,
	type EncryptionKey,
} from "@evolu/common";
import { z } from "zod";
import { Base64ToUint8Array, uint8ArrayToBase64 } from "./helpers";
import type { EncryptedMessage } from "./sockets";

/**
 * Serialized encrypted data format for transmission over websocket.
 */
export interface SerializedEncryptedData {
	nonce: string;
	ciphertext: string;
}

export const SerializedEncryptedDataSchema = z.object({
	nonce: z.string(),
	ciphertext: z.string(),
});

export function isSerializedEncryptedData(data: unknown): data is SerializedEncryptedData {
	return SerializedEncryptedDataSchema.safeParse(data).success;
}

/**
 * Creates a symmetric crypto instance for encryption/decryption operations.
 * This is a shared utility to avoid duplicating the crypto setup code.
 */
export function createCryptoInstance() {
	const randomBytes = createRandomBytes();
	return createSymmetricCrypto({ randomBytes });
}

/**
 * Decrypts encrypted message content using the provided encryption key.
 * This is the shared decryption logic used by TextMessageHandler.
 *
 * @param encryptedContent - The encrypted content with nonce and ciphertext
 * @param encryptionKey - The base64-encoded encryption key
 * @returns The decrypted plaintext string, or undefined if decryption fails
 */
export function decryptMessageContent(
	encryptedContent: SerializedEncryptedData,
	encryptionKey: string,
): string | undefined {
	const symmetricEncryptionKey = Base64ToUint8Array(
		encryptionKey,
	) as EncryptionKey;

	const { ciphertext, nonce } = encryptedContent;

	const crypt = createCryptoInstance();
	const decryptedContent = crypt.decrypt(
		Base64ToUint8Array(ciphertext),
		symmetricEncryptionKey,
		Base64ToUint8Array(nonce),
	);

	if (decryptedContent.ok) {
		return new TextDecoder().decode(decryptedContent.value);
	}

	return undefined;
}

/**
 * Encrypts a message's data while keeping type and channelId in plaintext.
 *
 * @param message - The message object to potentially encrypt
 * @param encrypted - Whether encryption is enabled
 * @param encryptionKey - The base64-encoded encryption key
 * @returns Either the original message or an EncryptedMessage
 */
export function prepareEncryptedMessage<T extends { type: unknown; channelId: string; networkMessageId?: string }>(
	message: T,
	encrypted: boolean,
	encryptionKey: string | undefined,
): T | EncryptedMessage {
	if (encrypted && encryptionKey) {
		const { type, channelId, networkMessageId, ...rest } = message;
		const symmetricEncryptionKey = Base64ToUint8Array(
			encryptionKey,
		) as EncryptionKey;

		const crypt = createCryptoInstance();
		const plaintextBytes = new TextEncoder().encode(JSON.stringify(rest));
		const encryptedContent = crypt.encrypt(plaintextBytes, symmetricEncryptionKey);

		const encryptedMsg: Omit<EncryptedMessage, "uuid"> & { uuid?: never } = {
			type: type as EncryptedMessage["type"],
			channelId,
			networkMessageId,
			payload: {
				nonce: uint8ArrayToBase64(encryptedContent.nonce),
				ciphertext: uint8ArrayToBase64(encryptedContent.ciphertext),
			},
		};
		return encryptedMsg as EncryptedMessage;
	}

	return message;
}

/**
 * Decrypts an encrypted message payload and merges it with the base fields.
 *
 * @param message - The EncryptedMessage to decrypt
 * @param encryptionKey - The base64-encoded encryption key
 * @returns The decrypted message, or undefined if decryption fails
 */
export function decryptMessagePayload<T>(
	message: { type: unknown; channelId: string; networkMessageId?: string; payload: SerializedEncryptedData },
	encryptionKey: string,
): T | undefined {
	const symmetricEncryptionKey = Base64ToUint8Array(
		encryptionKey,
	) as EncryptionKey;

	const { ciphertext, nonce } = message.payload;

	const crypt = createCryptoInstance();
	const decryptedContent = crypt.decrypt(
		Base64ToUint8Array(ciphertext),
		symmetricEncryptionKey,
		Base64ToUint8Array(nonce),
	);

	if (decryptedContent.ok) {
		try {
			const decryptedData = JSON.parse(new TextDecoder().decode(decryptedContent.value));
			// Reconstruct the message with plaintext fields first, then decrypted fields
			// This ensures networkMessageId (used for routing) is always available
			const reconstructed = {
				type: message.type,
				channelId: message.channelId,
				networkMessageId: message.networkMessageId,
				...decryptedData,
			} as object;
			
			// Verify required fields are present
			if (!("type" in reconstructed) || !("channelId" in reconstructed)) {
				console.error("Decrypted message missing required fields", reconstructed);
				return undefined;
			}
			
			return reconstructed as T;
		} catch (e) {
			console.error("Failed to parse decrypted message JSON", e);
			return undefined;
		}
	}

	return undefined;
}

import {
	createRandomBytes,
	createSymmetricCrypto,
	type EncryptionKey,
} from "@evolu/common";
import { z } from "zod";
import { Base64ToUint8Array, uint8ArrayToBase64 } from "./helpers";

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
 * Encrypts plaintext content if encryption is enabled, otherwise returns plaintext.
 * This is the shared encryption logic used by MessageSender and autoresponder.
 *
 * @param plaintext - The plaintext string to potentially encrypt
 * @param encrypted - Whether the channel is currently encrypted
 * @param encryptionKey - The base64-encoded encryption key (if encryption is enabled)
 * @returns Object with content (string or SerializedEncryptedData) and encrypted flag
 */
export function prepareMessageContent(
	plaintext: string,
	encrypted: boolean,
	encryptionKey: string | undefined,
): {
	content: string | SerializedEncryptedData;
	encrypted: boolean;
} {
	// If encryption is enabled and we have a key, encrypt the content
	if (encrypted && encryptionKey) {
		const symmetricEncryptionKey = Base64ToUint8Array(
			encryptionKey,
		) as EncryptionKey;

		const crypt = createCryptoInstance();
		const plaintextBytes = new TextEncoder().encode(plaintext);
		const encryptedContent = crypt.encrypt(plaintextBytes, symmetricEncryptionKey);

		const serializedEncryptedContent: SerializedEncryptedData = {
			nonce: uint8ArrayToBase64(encryptedContent.nonce),
			ciphertext: uint8ArrayToBase64(encryptedContent.ciphertext),
		};

		return {
			content: serializedEncryptedContent,
			encrypted: true,
		};
	}

	// Send as plaintext
	return {
		content: plaintext,
		encrypted: false,
	};
}

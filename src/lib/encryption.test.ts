import { describe, expect, it } from "bun:test";
import { createSaltedHash } from "./salted-hashing";
import { prepareEncryptedMessage, decryptMessagePayload } from "./symmetric-encryption";
import { isEncryptedMessage, WsMessageType } from "./sockets";

describe("Encryption & Hashing Refactor", () => {
	
	describe("Salted Hashing", () => {
		it("should produce consistent hashes for the same input", async () => {
			const hash1 = await createSaltedHash("room-123", "secret-salt");
			const hash2 = await createSaltedHash("room-123", "secret-salt");
			expect(hash1).toBe(hash2);
		});

		it("should produce different hashes for different salts", async () => {
			const hash1 = await createSaltedHash("room-123", "salt-a");
			const hash2 = await createSaltedHash("room-123", "salt-b");
			expect(hash1).not.toBe(hash2);
		});

		it("should produce different hashes for different rooms", async () => {
			const hash1 = await createSaltedHash("room-a", "same-salt");
			const hash2 = await createSaltedHash("room-b", "same-salt");
			expect(hash1).not.toBe(hash2);
		});
	});

	describe("Encryption Cycle", () => {
		// Create a valid 32-byte key (256-bit)
		const keyBytes = new Uint8Array(32).fill(1);
		const testKey = btoa(String.fromCharCode(...keyBytes));
		const testMessage = {
			type: WsMessageType.TEXT,
			channelId: "test-channel",
			networkMessageId: "msg-123",
			content: "Hello, world!",
			uuid: "user-123",
			user: { displayName: "Test Bee", pfpUrl: "", bio: "", status: "", publicNtfyShId: "" },
			autoResponder: false
		};

		it("should not encrypt when encryption is disabled", () => {
			const result = prepareEncryptedMessage(testMessage, false, testKey);
			expect(result).toEqual(testMessage);
			expect(isEncryptedMessage(result)).toBe(false);
		});

		it("should encrypt and then decrypt back to the original message", async () => {
			const encrypted = prepareEncryptedMessage(testMessage, true, testKey);
			
			// Verify it's an encrypted envelope
			expect(isEncryptedMessage(encrypted)).toBe(true);
			if (!isEncryptedMessage(encrypted)) return;

			expect(encrypted.type).toBe(testMessage.type);
			expect(encrypted.channelId).toBe(testMessage.channelId);
			expect(encrypted.networkMessageId).toBe(testMessage.networkMessageId);
			expect(encrypted).toHaveProperty("payload");

			// Decrypt
			const decrypted = decryptMessagePayload<typeof testMessage>(encrypted, testKey);
			expect(decrypted).toEqual(testMessage);
		});
	});

	describe("Type Safety", () => {
		it("should identify valid encrypted messages", () => {
			const validEncrypted = {
				type: WsMessageType.TEXT,
				channelId: "room",
				payload: {
					nonce: "any-nonce",
					ciphertext: "any-cipher"
				}
			};
			expect(isEncryptedMessage(validEncrypted)).toBe(true);
		});

		it("should reject messages missing payload", () => {
			const invalid = {
				type: WsMessageType.TEXT,
				channelId: "room",
				content: "hi"
			};
			expect(isEncryptedMessage(invalid)).toBe(false);
		});

		it("should reject malformed payloads", () => {
			const invalid = {
				type: WsMessageType.TEXT,
				channelId: "room",
				payload: "not-an-object"
			};
			expect(isEncryptedMessage(invalid)).toBe(false);
		});
	});

	describe("Network ID Persistence", () => {
		it("should keep networkMessageId outside the encryption envelope", () => {
			const keyBytes = new Uint8Array(32).fill(2);
			const testKey = btoa(String.fromCharCode(...keyBytes));
			const msg = {
				type: WsMessageType.DELETE,
				channelId: "chan",
				networkMessageId: "keep-me-visible",
				uuid: "user"
			};
			const encrypted = prepareEncryptedMessage(msg, true, testKey);
			
			expect(isEncryptedMessage(encrypted)).toBe(true);
			if (isEncryptedMessage(encrypted)) {
				expect(encrypted.networkMessageId).toBe("keep-me-visible");
				// Verify it's NOT in the rest of the object if we were to look at it (not easily done without decryption)
			}
		});
	});
});




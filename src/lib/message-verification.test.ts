import { describe, expect, it } from "bun:test";
import type { PrivateKeyAccount } from "viem/accounts";
import { deriveAccountFromMnemonic, getEthereumAddress } from "./crypto-keys";
import type { MessageEnvelope } from "./message-verification";
import {
	constructMessageEnvelope,
	recoverSignerAddress,
	signMessageEnvelope,
	verifyMessageSignature,
} from "./message-verification";
import { WsMessageType } from "./sockets";

// Test mnemonic (DO NOT USE IN PRODUCTION - for testing only)
const TEST_MNEMONIC =
	"test test test test test test test test test test test junk";

describe("Message Verification - Core Cryptographic Primitives", () => {
	describe("Key Derivation (crypto-keys.ts)", () => {
		describe("Happy Path", async () => {
			it("should derive Ethereum account from valid mnemonic", async () => {
				const account = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				expect(account).toBeDefined();
				expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
				expect(account.account).toBeDefined();
			});

			it("should derive same address from same mnemonic (deterministic)", async () => {
				const account1 = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const account2 = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				expect(account1.address).toBe(account2.address);
			});

			it("should derive different addresses from different mnemonics", async () => {
				const mnemonic2 =
					"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
				const account1 = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const account2 = await deriveAccountFromMnemonic(mnemonic2);
				expect(account1.address).not.toBe(account2.address);
			});

			it("should extract Ethereum address from account", async () => {
				const account = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const address = getEthereumAddress(account);
				expect(address).toBe(account.address);
				expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
			});
		});

		describe("Failure Cases", () => {
			it("should handle invalid mnemonic gracefully", async () => {
				const invalidMnemonic = "invalid mnemonic phrase";
				expect(deriveAccountFromMnemonic(invalidMnemonic)).rejects.toThrow();
			});

			it("should handle empty mnemonic", async () => {
				expect(deriveAccountFromMnemonic("")).rejects.toThrow();
			});

			it("should handle mnemonic with wrong word count", async () => {
				const wrongCount = "test test test";
				expect(deriveAccountFromMnemonic(wrongCount)).rejects.toThrow();
			});
		});

		describe("Edge Cases", () => {
			it("should handle 12-word mnemonic", async () => {
				const mnemonic12 =
					"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
				const account = await deriveAccountFromMnemonic(mnemonic12);
				expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
			});

			it("should handle 24-word mnemonic", async () => {
				const mnemonic24 =
					"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";
				const account = await deriveAccountFromMnemonic(mnemonic24);
				expect(account.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
			});

			it("should handle mnemonic with extra whitespace", async () => {
				const mnemonicWithSpaces = `  ${TEST_MNEMONIC}  `;
				const account1 = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const account2 = await deriveAccountFromMnemonic(
					mnemonicWithSpaces.trim(),
				);
				expect(account1.address).toBe(account2.address);
			});
		});
	});

	describe("Message Envelope Construction", () => {
		describe("Happy Path", () => {
			it("should construct envelope for TEXT message", () => {
				const envelope = constructMessageEnvelope({
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: "Hello, world!",
				});

				expect(envelope.sender).toBe("user-uuid-123");
				expect(envelope.timestamp).toBe(1234567890);
				expect(envelope.channelId).toBe("channel-123");
				expect(envelope.networkMessageId).toBe("msg-123");
				expect(envelope.messageType).toBe(WsMessageType.TEXT);
				expect(envelope.content).toBe("Hello, world!");
			});

			it("should construct envelope for REACTION message", () => {
				const envelope = constructMessageEnvelope({
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.REACTION,
					content: "👍",
				});

				expect(envelope.messageType).toBe(WsMessageType.REACTION);
				expect(envelope.content).toBe("👍");
			});

			it("should construct envelope for DELETE message", () => {
				const envelope = constructMessageEnvelope({
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.DELETE,
					content: "deleted-msg-id",
				});

				expect(envelope.messageType).toBe(WsMessageType.DELETE);
				expect(envelope.content).toBe("deleted-msg-id");
			});
		});

		describe("Edge Cases", () => {
			it("should handle empty content", () => {
				const envelope = constructMessageEnvelope({
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: "",
				});

				expect(envelope.content).toBe("");
			});

			it("should handle very long content", () => {
				const longContent = "a".repeat(10000);
				const envelope = constructMessageEnvelope({
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: longContent,
				});

				expect(envelope.content).toBe(longContent);
			});

			it("should handle unicode content", () => {
				const unicodeContent = "Hello 🌍 世界 مرحبا";
				const envelope = constructMessageEnvelope({
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: unicodeContent,
				});

				expect(envelope.content).toBe(unicodeContent);
			});
		});
	});

	describe("EIP-712 Signature Generation", () => {
		describe("Happy Path", () => {
			it("should sign envelope and produce valid signature", async () => {
				const account = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const envelope: MessageEnvelope = {
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: "Hello, world!",
				};

				const signature = await signMessageEnvelope(envelope, account.account);
				expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
			});

			it("should produce same signature for same envelope and account", async () => {
				const account = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const envelope: MessageEnvelope = {
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: "Hello, world!",
				};

				const sig1 = await signMessageEnvelope(envelope, account.account);
				const sig2 = await signMessageEnvelope(envelope, account.account);
				expect(sig1).toBe(sig2);
			});

			it("should produce different signature for different content", async () => {
				const account = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const envelope1: MessageEnvelope = {
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: "Hello",
				};

				const envelope2: MessageEnvelope = {
					...envelope1,
					content: "World",
				};

				const sig1 = await signMessageEnvelope(envelope1, account.account);
				const sig2 = await signMessageEnvelope(envelope2, account.account);
				expect(sig1).not.toBe(sig2);
			});
		});

		describe("Failure Cases", () => {
			it("should handle invalid account object", async () => {
				const envelope: MessageEnvelope = {
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: "Hello",
				};

				await expect(
					signMessageEnvelope(envelope, null as unknown as PrivateKeyAccount),
				).rejects.toThrow();

				await expect(
					signMessageEnvelope(
						envelope,
						undefined as unknown as PrivateKeyAccount,
					),
				).rejects.toThrow();
			});
		});
	});

	describe("EIP-712 Signature Recovery", () => {
		describe("Happy Path", () => {
			it("should recover correct address from valid signature", async () => {
				const account = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const envelope: MessageEnvelope = {
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: "Hello, world!",
				};

				const signature = await signMessageEnvelope(envelope, account.account);
				const recoveredAddress = await recoverSignerAddress(
					envelope,
					signature,
				);

				expect(recoveredAddress.toLowerCase()).toBe(
					account.address.toLowerCase(),
				);
			});
		});

		describe("Failure Cases", () => {
			it("should fail to recover address from tampered envelope", async () => {
				const account = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const envelope: MessageEnvelope = {
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: "Hello, world!",
				};

				const signature = await signMessageEnvelope(envelope, account.account);

				const tamperedEnvelope: MessageEnvelope = {
					...envelope,
					content: "Tampered content",
				};

				const recoveredAddress = await recoverSignerAddress(
					tamperedEnvelope,
					signature,
				);

				expect(recoveredAddress.toLowerCase()).not.toBe(
					account.address.toLowerCase(),
				);
			});
		});
	});

	describe("End-to-End Signature Verification", () => {
		describe("Happy Path", () => {
			it("should verify signature matches sender address", async () => {
				const account = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const envelope: MessageEnvelope = {
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: "Hello, world!",
				};

				const signature = await signMessageEnvelope(envelope, account.account);
				const isValid = await verifyMessageSignature(
					envelope,
					signature,
					account.address,
				);

				expect(isValid).toBe(true);
			});

			it("should reject signature that doesn't match sender address", async () => {
				const account1 = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const mnemonic2 =
					"abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
				const wrongAccount = await deriveAccountFromMnemonic(mnemonic2);

				const envelope: MessageEnvelope = {
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: "Hello, world!",
				};

				const signature = await signMessageEnvelope(envelope, account1.account);
				const isValid = await verifyMessageSignature(
					envelope,
					signature,
					wrongAccount.address,
				);

				expect(isValid).toBe(false);
			});
		});

		describe("Failure Cases", () => {
			it("should reject tampered message signature", async () => {
				const account = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const envelope: MessageEnvelope = {
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: "Hello, world!",
				};

				const signature = await signMessageEnvelope(envelope, account.account);

				const tamperedEnvelope: MessageEnvelope = {
					...envelope,
					content: "Tampered!",
				};

				const isValid = await verifyMessageSignature(
					tamperedEnvelope,
					signature,
					account.address,
				);

				expect(isValid).toBe(false);
			});

			it("should reject null signature", async () => {
				const envelope: MessageEnvelope = {
					sender: "user-uuid-123",
					timestamp: 1234567890,
					channelId: "channel-123",
					networkMessageId: "msg-123",
					messageType: WsMessageType.TEXT,
					content: "Hello",
				};

				const account = await deriveAccountFromMnemonic(TEST_MNEMONIC);
				const isValid = await verifyMessageSignature(
					envelope,
					null,
					account.address,
				);

				expect(isValid).toBe(false);
			});
		});
	});
});

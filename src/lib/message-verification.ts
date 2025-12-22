import type { Hex } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { recoverTypedDataAddress } from "viem/utils";
import type { WsMessageType } from "./sockets";

/**
 * MessageEnvelope - The canonical data structure to be signed.
 * This matches the EIP-712 type definition.
 */
export interface MessageEnvelope {
	sender: string; // UUID of the sender
	timestamp: number; // Unix timestamp in seconds
	channelId: string; // Channel identifier
	networkMessageId: string; // Unique message identifier
	messageType: WsMessageType; // Type of message (TEXT, REACTION, DELETE)
	content: string; // Message-specific content
}

/**
 * EIP-712 Domain for message signing.
 * Must be consistent across all clients.
 */
export const EIP712_DOMAIN = {
	name: "Buzz Messages",
	version: "1",
	chainId: 1, // Ethereum mainnet (for compatibility, actual chain not used)
	verifyingContract: "0x0000000000000000000000000000000000000000" as const, // Placeholder
} as const;

/**
 * EIP-712 Types for MessageEnvelope.
 * Must be consistent across all clients.
 */
export const EIP712_TYPES = {
	MessageEnvelope: [
		{ name: "sender", type: "string" },
		{ name: "timestamp", type: "uint256" },
		{ name: "channelId", type: "string" },
		{ name: "networkMessageId", type: "string" },
		{ name: "messageType", type: "string" },
		{ name: "content", type: "string" },
	],
} as const;

/**
 * Constructs a MessageEnvelope from message data.
 *
 * @param data - Message data to construct envelope from
 * @returns MessageEnvelope object
 */
export function constructMessageEnvelope(data: {
	sender: string;
	timestamp: number;
	channelId: string;
	networkMessageId: string;
	messageType: WsMessageType;
	content: string;
}): MessageEnvelope {
	return {
		sender: data.sender,
		timestamp: data.timestamp,
		channelId: data.channelId,
		networkMessageId: data.networkMessageId,
		messageType: data.messageType,
		content: data.content,
	};
}

/**
 * Signs a MessageEnvelope using EIP-712 typed data signing.
 *
 * @param envelope - The MessageEnvelope to sign
 * @param account - The viem PrivateKeyAccount to sign with
 * @returns The ECDSA signature (0x-prefixed hex string, 130 chars)
 */
export async function signMessageEnvelope(
	envelope: MessageEnvelope,
	account: PrivateKeyAccount,
): Promise<string> {
	return await account.signTypedData({
		domain: EIP712_DOMAIN,
		types: EIP712_TYPES,
		primaryType: "MessageEnvelope",
		message: {
			sender: envelope.sender,
			timestamp: BigInt(envelope.timestamp),
			channelId: envelope.channelId,
			networkMessageId: envelope.networkMessageId,
			messageType: envelope.messageType,
			content: envelope.content,
		},
	});
}

/**
 * Recovers the signer's Ethereum address from a MessageEnvelope and signature.
 *
 * @param envelope - The MessageEnvelope that was signed
 * @param signature - The ECDSA signature (0x-prefixed hex string)
 * @returns The Ethereum address of the signer (0x-prefixed hex string)
 */
export async function recoverSignerAddress(
	envelope: MessageEnvelope,
	signature: string,
): Promise<string> {
	return await recoverTypedDataAddress({
		domain: EIP712_DOMAIN,
		types: EIP712_TYPES,
		primaryType: "MessageEnvelope",
		message: {
			sender: envelope.sender,
			timestamp: BigInt(envelope.timestamp),
			channelId: envelope.channelId,
			networkMessageId: envelope.networkMessageId,
			messageType: envelope.messageType,
			content: envelope.content,
		},
		signature: `0x${signature.replace("0x", "")}` as Hex,
	});
}

/**
 * Verifies that a signature matches the expected sender address.
 *
 * @param envelope - The MessageEnvelope that was signed
 * @param signature - The ECDSA signature to verify
 * @param expectedAddress - The expected Ethereum address of the signer
 * @returns true if signature is valid and matches expected address, false otherwise
 */
export async function verifyMessageSignature(
	envelope: MessageEnvelope,
	signature: string | null | undefined,
	expectedAddress: string,
): Promise<boolean> {
	if (!signature) return false;
	const recoveredAddress = await recoverSignerAddress(envelope, signature);
	return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
}

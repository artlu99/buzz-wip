import { type NonEmptyString100, sqliteTrue } from "@evolu/common";
import type { AutoResponderState } from "../../components/listeners/AutoResponderState";
import type {
	DeleteMessage,
	MarcoPoloMessage,
	ReactionMessage,
	TextMessage,
	UserMessageData,
} from "../sockets";
import { WsMessageType } from "../sockets";
import { prepareMessageContent } from "../symmetric-encryption";
import type { LastNReactionsRow, LastNTextMessagesRow } from "./queries";

/**
 * Check if a message is a Marco message (empty user and channel).
 */
export function isMarcoMessage(message: MarcoPoloMessage): boolean {
	return (
		message.message.user === undefined && message.message.channel === undefined
	);
}

/**
 * Check if we should autorespond to a Marco message.
 */
export function shouldAutorespond(
	marcoMessage: MarcoPoloMessage,
	state: AutoResponderState,
	autoResponder: boolean,
): boolean {
	// Must have autoResponder enabled
	if (!autoResponder) {
		console.log(
			"[AUTORESPONDER] shouldAutorespond: false - autoResponder disabled",
		);
		return false;
	}

	// Must have a UUID in the Marco message
	if (!marcoMessage.uuid) {
		console.log(
			"[AUTORESPONDER] shouldAutorespond: false - no UUID in Marco message",
		);
		return false;
	}

	// Blocklist disabled - idempotency and cooldown provide sufficient protection
	// if (state.isBlocked(marcoMessage.uuid)) {
	// 	console.log("[AUTORESPONDER] shouldAutorespond: false - UUID is blocked", {
	// 		uuid: marcoMessage.uuid,
	// 	});
	// 	return false;
	// }

	// Check cooldown (30 seconds)
	if (state.isInCooldown(marcoMessage.uuid, 30000)) {
		console.log(
			"[AUTORESPONDER] shouldAutorespond: false - UUID is in cooldown",
			{
				uuid: marcoMessage.uuid,
			},
		);
		return false;
	}

	console.log("[AUTORESPONDER] shouldAutorespond: true - all checks passed", {
		uuid: marcoMessage.uuid,
		autoResponder,
	});
	return true;
}

/**
 * Filter messages for idempotency - only return messages that haven't been
 * seen/heard in the idempotency window.
 */
export function filterMessagesForIdempotency(
	messages: Array<{ networkMessageId: string }>,
	state: AutoResponderState,
	windowMs: number = 10000, // 10 seconds
): Array<{ networkMessageId: string }> {
	return messages.filter((msg) => {
		// Skip if we've heard this from another autoResponder
		if (state.hasHeardMessage(msg.networkMessageId, windowMs)) {
			return false;
		}

		// Skip if we've already sent this
		if (state.hasSentMessage(msg.networkMessageId, windowMs)) {
			return false;
		}

		return true;
	});
}

/**
 * Reconstruct a TextMessage from a database row.
 * If the channel is currently encrypted, re-encrypts plaintext messages.
 */
export function reconstructTextMessage(
	dbMessage: LastNTextMessagesRow,
	channelId: NonEmptyString100,
	encryptionKey: string | undefined,
	encrypted: boolean,
): TextMessage | null {
	if (!dbMessage.networkMessageId || !dbMessage.content) {
		return null;
	}

	// Parse user data from JSON string
	let user: UserMessageData;
	try {
		user = JSON.parse(dbMessage.user || "{}");
	} catch {
		return null;
	}

	// Determine content and encryption status
	// Messages are stored as plaintext in the database (even if originally encrypted)
	let content: string | { nonce: string; ciphertext: string };
	let messageEncrypted: boolean;

	// Get plaintext content from database
	let plaintextContent: string;
	if (typeof dbMessage.content === "string") {
		plaintextContent = dbMessage.content;
	} else {
		// Content might be stored as JSON string, try to parse
		try {
			const parsed = JSON.parse(dbMessage.content);
			if (parsed.nonce && parsed.ciphertext) {
				// This shouldn't happen (messages are stored as plaintext),
				// but handle it gracefully
				content = parsed;
				messageEncrypted = true;
				return {
					uuid: dbMessage.createdBy || "",
					type: WsMessageType.TEXT,
					content,
					user,
					channelId,
					encrypted: messageEncrypted,
					networkMessageId: dbMessage.networkMessageId,
					networkTimestamp: dbMessage.networkTimestamp ?? "",
					autoResponder: true,
				};
			} else {
				plaintextContent = dbMessage.content;
			}
		} catch {
			plaintextContent = dbMessage.content;
		}
	}

	// Use shared encryption logic (same as MessageSender.tsx)
	const { content: messageContent, encrypted: messageEncryptedResult } =
		prepareMessageContent(plaintextContent, encrypted, encryptionKey);
	content = messageContent;
	messageEncrypted = messageEncryptedResult;

	return {
		uuid: dbMessage.createdBy || "",
		type: WsMessageType.TEXT,
		content,
		user,
		channelId,
		encrypted: messageEncrypted,
		networkMessageId: dbMessage.networkMessageId,
		networkTimestamp: dbMessage.networkTimestamp || String(Date.now()),
		autoResponder: true,
	};
}

/**
 * Reconstruct a DeleteMessage for a deleted message.
 * Includes the uuid of the original message creator for authorization checks.
 */
export function reconstructDeleteMessage(
	networkMessageId: string,
	channelId: NonEmptyString100,
	uuid?: string,
): DeleteMessage {
	return {
		type: WsMessageType.DELETE,
		networkMessageId,
		channelId,
		uuid,
		signature: null,
	};
}

/**
 * Reconstruct a ReactionMessage from a database row.
 * Note: Requires the networkMessageId from the associated message.
 */
export function reconstructReactionMessage(
	dbReaction: LastNReactionsRow,
	messageNetworkId: string,
	channelId: NonEmptyString100,
): ReactionMessage | null {
	if (!dbReaction.reaction || !dbReaction.createdBy) {
		return null;
	}

	return {
		uuid: dbReaction.createdBy,
		type: WsMessageType.REACTION,
		networkMessageId: messageNetworkId,
		networkTimestamp: dbReaction.networkTimestamp || String(Date.now()),
		reaction: dbReaction.reaction,
		channelId,
		isDeleted: dbReaction.isDeleted === sqliteTrue,
	};
}

/**
 * Calculate a random delay between minMs and maxMs.
 */
export function calculateRandomDelay(minMs: number, maxMs: number): number {
	return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
}

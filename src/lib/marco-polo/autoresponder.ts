import { type NonEmptyString100, sqliteTrue } from "@evolu/common";
import type { AutoResponderState } from "../../components/listeners/AutoResponderState";
import { useZustand } from "../../hooks/use-zustand";
import type {
	CurrentUserData,
	DeleteMessage,
	HistoricalUserData,
	MarcoPoloMessage,
	ReactionMessage,
	TextMessage,
	UserMessageData,
} from "../sockets";
import { WsMessageType } from "../sockets";
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
): boolean {
	// Must have autoResponder enabled
	const currentAutoResponder = useZustand.getState().autoResponder;
	if (!currentAutoResponder) {
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
 * Merge historical user data (from message) with current user data (from database).
 * Uses historical data for context fields (status, bio) and current data for
 * recognition/functionality fields (displayName, pfpUrl, publicNtfyShId).
 */
export function mergeUserData(
	historical: HistoricalUserData,
	current: CurrentUserData | null,
	fallback?: CurrentUserData,
): UserMessageData {
	return {
		// Historical fields: preserve context from when message was sent
		status: historical.status || "",
		bio: historical.bio || "",
		// Current fields: use latest for recognition and functionality
		// Fallback to historical data from message if current is not available
		displayName: current?.displayName || fallback?.displayName || "",
		pfpUrl: current?.pfpUrl || fallback?.pfpUrl || "",
		publicNtfyShId: current?.publicNtfyShId || fallback?.publicNtfyShId || "",
	};
}

/**
 * Reconstruct a TextMessage from a database row.
 * Uses hybrid approach: historical data for context (status, bio),
 * latest data for recognition (displayName, pfpUrl, publicNtfyShId).
 * 
 * @param dbMessage - The database message row containing historical user data
 * @param channelId - The channel ID for the message
 * @param latestUserData - Optional current user data from database (for recognition fields)
 * @returns Reconstructed TextMessage or null if invalid
 */
export function reconstructTextMessage(
	dbMessage: LastNTextMessagesRow,
	channelId: NonEmptyString100,
	latestUserData?: CurrentUserData | null,
): TextMessage | null {
	if (!dbMessage.networkMessageId || !dbMessage.content) {
		return null;
	}

	// Parse historical user data from JSON string stored in message
	let historicalUser: UserMessageData;
	try {
		historicalUser = JSON.parse(dbMessage.user || "{}");
	} catch {
		return null;
	}

	// Extract historical fields (status, bio) from message
	const historical: HistoricalUserData = {
		status: historicalUser.status || "",
		bio: historicalUser.bio || "",
	};

	// Extract current fields (displayName, pfpUrl, publicNtfyShId) from historical as fallback
	const historicalCurrent: CurrentUserData = {
		displayName: historicalUser.displayName || "",
		pfpUrl: historicalUser.pfpUrl || "",
		publicNtfyShId: historicalUser.publicNtfyShId || "",
	};

	// Merge: use latest if provided, otherwise fall back to historical
	const user = mergeUserData(historical, latestUserData ?? null, historicalCurrent);

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
				// but handle it gracefully if it was somehow stored as encrypted JSON
				// We don't have the key here to decrypt it anyway, so we'll just return null
				// or try to treat it as string
				return null;
			} else {
				plaintextContent = dbMessage.content;
			}
		} catch {
			plaintextContent = dbMessage.content;
		}
	}

	return {
		uuid: dbMessage.createdBy,
		type: WsMessageType.TEXT,
		content: plaintextContent,
		user,
		channelId,
		networkMessageId: dbMessage.networkMessageId,
		networkTimestamp: dbMessage.networkTimestamp || String(Date.now()),
		autoResponder: true,
		signature: null,
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
		signature: null,
	};
}

/**
 * Calculate a random delay between minMs and maxMs.
 */
export function calculateRandomDelay(minMs: number, maxMs: number): number {
	return Math.floor(Math.random() * (maxMs - minMs)) + minMs;
}

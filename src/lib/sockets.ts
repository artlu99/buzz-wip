import { connect, type IttySocket } from "itty-sockets";

export type WsMessage = {
	date: number; // Unix timestamp of original message
	uid: string; // unique user ID of the sending connection
	message: unknown; // your message payload
};

export enum WsMessageType {
	DOORBELL = "doorbell",
	STATUS = "status",
	REACTION = "reaction",
	TEXT = "text",
}

export enum TypingIndicatorType {
	TYPING = "typing",
	STOP_TYPING = "stop_typing",
}

export enum DoorbellType {
	OPEN = "hello",
	CLOSE = "bye",
}

export interface TypingIndicatorMessage {
	uuid?: string;
	type: WsMessageType.STATUS;
	presence: TypingIndicatorType;
	text?: string;
}

export interface DoorbellMessage {
	uuid?: string;
	type: WsMessageType.DOORBELL;
	message: DoorbellType;
}

export interface TextMessage {
	uuid?: string;
	type: WsMessageType.TEXT;
	content: string;
	createdBy: string;
	// Note: createdAt removed - we use envelope timestamp (e.date) instead for consistency
}

export interface ReactionMessage {
	uuid?: string;
	type: WsMessageType.REACTION;
	// Use message identifiers instead of local messageId for distributed systems
	// Use envelope timestamp (e.date) for messageCreatedAt when matching
	messageCreatedBy: string;
	messageContent: string;
	reaction: string;
	createdBy: string;
	isDeleted: boolean;
}

export function isTypingIndicatorMessage(
	message: unknown,
): message is TypingIndicatorMessage {
	return (
		typeof message === "object" &&
		message !== null &&
		"type" in message &&
		message.type === WsMessageType.STATUS &&
		"presence" in message &&
		(message.presence === TypingIndicatorType.TYPING ||
			message.presence === TypingIndicatorType.STOP_TYPING)
	);
}

export function isTextMessage(message: unknown): message is TextMessage {
	return (
		typeof message === "object" &&
		message !== null &&
		"type" in message &&
		message.type === WsMessageType.TEXT
	);
}

export function isDoorbellMessage(
	message: unknown,
): message is DoorbellMessage {
	return (
		typeof message === "object" &&
		message !== null &&
		"type" in message &&
		message.type === WsMessageType.DOORBELL &&
		"message" in message &&
		(message.message === DoorbellType.OPEN ||
			message.message === DoorbellType.CLOSE)
	);
}

export function isReactionMessage(
	message: unknown,
): message is ReactionMessage {
	return (
		typeof message === "object" &&
		message !== null &&
		"type" in message &&
		message.type === WsMessageType.REACTION &&
		"messageCreatedBy" in message &&
		"messageContent" in message &&
		"reaction" in message &&
		"createdBy" in message &&
		"isDeleted" in message &&
		typeof message.isDeleted === "boolean"
	);
}

export type TypingIndicatorWsMessage = WsMessage & {
	message: TypingIndicatorMessage;
};

export function isTypingIndicatorWsMessage(
	wsMessage: WsMessage,
): wsMessage is TypingIndicatorWsMessage {
	return isTypingIndicatorMessage(wsMessage.message);
}

// Time constants for message matching and de-duplication
export const TIME_ROUNDING_MS = 100; // Round timestamps to 100ms for matching

export class TypedWsClient {
	private socket: IttySocket;
	private seenMessages: Set<string> = new Set();
	private cleanupInterval: number | null = null;

	constructor(channelName: string) {
		this.socket = connect(channelName);
		// Clean up old message IDs every 10 seconds to prevent memory leaks
		this.cleanupInterval = window.setInterval(() => {
			// The Set will naturally handle cleanup as we only add recent messages
			// For a more sophisticated cleanup, we could track timestamps, but
			// the Set size should remain bounded by message frequency
			if (this.seenMessages.size > 1000) {
				this.seenMessages.clear();
			}
		}, 10000);
	}

	private getMessageKey(wsMessage: WsMessage): string | null {
		const { message, date } = wsMessage;

		// De-dup TEXT messages: sender + content + timestamp (use envelope timestamp for consistency)
		if (isTextMessage(message)) {
			const roundedTime =
				Math.floor(date / TIME_ROUNDING_MS) * TIME_ROUNDING_MS;
			return `text:${message.createdBy}:${message.content}:${roundedTime}`;
		}

		// De-dup REACTION messages: message identifiers + sender + reaction + timestamp (use envelope timestamp)
		if (isReactionMessage(message)) {
			const roundedTime =
				Math.floor(date / TIME_ROUNDING_MS) * TIME_ROUNDING_MS;
			return `reaction:${message.messageCreatedBy}:${message.messageContent}:${message.createdBy}:${message.reaction}:${message.isDeleted}:${roundedTime}`;
		}

		// Other message types don't need de-dup (STATUS, DOORBELL are idempotent or stateful)
		return null;
	}

	private isDuplicate(wsMessage: WsMessage): boolean {
		const key = this.getMessageKey(wsMessage);
		if (!key) return false;

		if (this.seenMessages.has(key)) return true;

		this.seenMessages.add(key);
		return false;
	}

	public on(event: WsMessageType, callback: (message: WsMessage) => void) {
		this.socket.on(event as string, (wsMessage: WsMessage) => {
			// De-duplicate before calling the callback
			if (this.isDuplicate(wsMessage)) {
				return; // Skip duplicate message
			}
			callback(wsMessage);
		});
	}

	public send(
		message:
			| TypingIndicatorMessage
			| DoorbellMessage
			| TextMessage
			| ReactionMessage,
	) {
		this.socket.send(message);
	}

	public destroy() {
		if (this.cleanupInterval !== null) {
			window.clearInterval(this.cleanupInterval);
		}
		this.seenMessages.clear();
	}
}

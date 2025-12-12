import { create } from "zustand";
import type { TextMessage } from "../lib/sockets";

interface UndecryptableMessage {
	message: TextMessage;
	receivedAt: number;
}

interface UndecryptableMessagesStore {
	messages: Array<UndecryptableMessage>;
	addMessage: (message: TextMessage) => void;
	clearAllMessages: () => void;
	getMessages: (channelId: string) => Array<UndecryptableMessage>;
}

export const useGarbledStore = create<UndecryptableMessagesStore>(
	(set, get) => ({
		messages: [],

		addMessage: (message: TextMessage) => {
			const now = Date.now();
			// Remove messages older than 1 hour
			const recentMessages = get().messages.filter(
				(m) => now - m.receivedAt < 3600000,
			);
			// Check if message already exists (by networkMessageId)
			const exists = recentMessages.find(
				(m) => m.message.networkMessageId === message.networkMessageId,
			);
			if (!exists) {
				set({
					messages: [...recentMessages, { message, receivedAt: now }],
				});
			}
		},

		clearAllMessages: () => set({ messages: [] }),

		getMessages: (channelId: string) =>
			get().messages.filter((m) => m.message.channelId === channelId),
	}),
);

import { create } from "zustand";
import type { KnownMessage } from "../lib/sockets";

interface UndecryptableMessage {
	message: KnownMessage;
	receivedAt: number;
}

interface UndecryptableMessagesStore {
	messages: Array<UndecryptableMessage>;
	addMessage: (message: KnownMessage) => void;
	clearAllMessages: () => void;
	getMessages: (channelId: string) => Array<UndecryptableMessage>;
	removeMessageByNetworkMessageId: (networkMessageId: string) => void;
}

export const useGarbledStore = create<UndecryptableMessagesStore>(
	(set, get) => ({
		messages: [],

		addMessage: (message: KnownMessage) => {
			const now = Date.now();
			// Remove messages older than 1 hour
			const recentMessages = get().messages.filter(
				(m) => now - m.receivedAt < 3600000,
			);
			// Check if message already exists (by networkMessageId if present)
			const exists = message.networkMessageId 
				? recentMessages.find((m) => m.message.networkMessageId === message.networkMessageId)
				: false;
				
			if (!exists) {
				set({
					messages: [...recentMessages, { message, receivedAt: now }],
				});
			}
		},

		clearAllMessages: () => set({ messages: [] }),

		getMessages: (channelId: string) =>
			get().messages.filter((m) => m.message.channelId === channelId),

		removeMessageByNetworkMessageId: (networkMessageId: string) => {
			set({ messages: get().messages.filter((m) => m.message.networkMessageId !== networkMessageId) });
		},
	}),
);

import { sqliteTrue } from "@evolu/common";
import { useEvolu, useQuery } from "@evolu/react";
import { useZustand } from "../hooks/use-zustand";
import { messagesForChannelQuery } from "../lib/local-first";

export const ClearMessagesElement = () => {
	const { channelId } = useZustand();
	const messages = useQuery(messagesForChannelQuery(channelId));
	const { update } = useEvolu();

	const handleClearAll = () => {
		if (
			!window.confirm(
				`Are you sure you want to clear all messages in ${channelId}? This cannot be undone.`,
			)
		) {
			return;
		}

		// Soft delete all messages
		messages?.forEach((msg) => {
			update("message", {
				id: msg.id,
				isDeleted: sqliteTrue,
			});
		});
	};

	return messages.length > 0 ? (
		<div className="mb-4 flex justify-end">
			<button
				type="button"
				onClick={handleClearAll}
				className="btn btn-sm btn-outline"
			>
				Clear All Messages
			</button>
		</div>
	) : null;
};

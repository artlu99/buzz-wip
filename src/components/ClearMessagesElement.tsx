import { sqliteTrue } from "@evolu/common";
import { useEvolu, useQuery } from "@evolu/react";
import { messagesQuery } from "../lib/local-first";

export const ClearMessagesElement = () => {
    const messages = useQuery(messagesQuery());
    	const { update } = useEvolu();

    const handleClearAll = () => {
		if (
			!window.confirm(
				"Are you sure you want to clear all messages? This cannot be undone.",
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

	return messages.length > 0 ? <div className="mb-4 flex justify-end">
					<button
						type="button"
						onClick={handleClearAll}
						className="btn btn-sm btn-outline"
					>
						Clear All Messages
					</button>
				</div> : null;
};

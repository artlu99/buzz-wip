import { NonEmptyString100, sqliteFalse, sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useZustand } from "../hooks/use-zustand";
import {
	allReactionsQuery,
	type MessageId,
	reactionsQuery,
	useEvolu,
} from "../lib/local-first";
import {
	availableReactions,
	type ReactionType,
	reactionTypeData,
	reactionTypeToEnum,
} from "../lib/reactions";
import type { ReactionMessage } from "../lib/sockets";
import { WsMessageType } from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";

interface MessageReactionsProps {
	messageId: MessageId; // Local database ID for querying reactions
	networkMessageId: string; // Network message ID for sending reaction messages
	isOwnMessage?: boolean;
}
export const MessageReactions = ({
	messageId,
	networkMessageId,
	isOwnMessage = false,
}: MessageReactionsProps) => {
	const socketClient = useSocket();
	const { insert, update } = useEvolu();
	const { channelId, uuid } = useZustand();
	const reactionsQueryResult = useQuery(reactionsQuery(messageId));
	const allReactionsQueryResult = useQuery(allReactionsQuery(messageId));

	if (!uuid) {
		console.error("Unable to react, uuid is not set");
		return;
	}

	const reactions = (reactionsQueryResult ?? []).map((reaction) => ({
		reaction: reactionTypeToEnum(reaction.reaction),
		by: reaction.createdBy,
		id: reaction.id,
	}));

	const handleReaction = async (
		messageId: MessageId,
		reaction: ReactionType,
	) => {
		const reactionString = NonEmptyString100.orThrow(reaction);
		const myReaction = reactions.find(
			(r) => r.by === uuid && r.reaction === reaction,
		);

		// Check for existing reaction (including deleted ones) for upsert
		const existingReaction = (allReactionsQueryResult ?? []).find(
			(r) =>
				r.createdBy === uuid &&
				r.reaction === reactionString &&
				r.isDeleted === sqliteTrue,
		);

		const isDeleted = !!myReaction;

		if (isDeleted) {
			// User has already reacted - delete the reaction
			update("reaction", {
				id: myReaction.id,
				isDeleted: sqliteTrue,
			});
		} else {
			// User has not reacted yet - upsert (insert or restore deleted)
			if (existingReaction) {
				update("reaction", {
					id: existingReaction.id,
					isDeleted: sqliteFalse,
				});
			} else {
				insert("reaction", {
					messageId: messageId,
					reaction: reactionString,
					channelId: channelId,
					createdBy: uuid,
				});
			}
		}

		// Send websocket message using networkMessageId for matching across distributed stores
		const reactionMessage: ReactionMessage = {
			uuid: uuid,
			type: WsMessageType.REACTION,
			networkMessageId: networkMessageId,
			reaction: reactionString,
			channelId: channelId,
			isDeleted: isDeleted,
		};
		socketClient.safeSend(reactionMessage);
	};

	const totalReactionCount = reactions.length;

	return (
		<div className={totalReactionCount > 0 ? "" : "opacity-50"}>
			<div className="flex items-center gap-1">
				{availableReactions.map((reaction) => {
					const reactionCount = reactions.filter(
						(r) => r.reaction === reaction,
					).length;
					const haveIReacted = reactions.some(
						(r) => r.by === uuid && r.reaction === reaction,
					);
					const iconData = reactionTypeData(reaction);
					const iconClass = haveIReacted ? iconData.filledIcon : iconData.icon;
					return (
						<div
							key={`${messageId}-${reaction}`}
							className="flex items-center gap-0.5"
						>
							<button
								type="button"
								className={`btn btn-xs btn-circle btn-ghost text-lg ${iconData.color} ${reactionCount > 0 ? "scale-110 transition-transform" : ""}`}
								onClick={() => handleReaction(messageId, reaction)}
								disabled={isOwnMessage}
							>
								<i className={iconClass} />
							</button>
							{reactionCount > 0 && (
								<span className="text-xs font-semibold min-w-[1rem] text-center">
									{reactionCount}
								</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
};

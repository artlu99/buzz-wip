import { NonEmptyString100, OwnerId, sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { EvoluIdenticon } from "@evolu/react-web";
import { alphabetical, unique } from "radash";
import invariant from "tiny-invariant";
import { useZustand } from "../hooks/use-zustand";
import { chosenIdenticonStyle } from "../lib/helpers";
import {
	allReactionsForChannelQuery,
	messagesForChannelQuery,
	useEvolu,
} from "../lib/local-first";
import {
	type DeleteMessage,
	UserMessageDataSchema,
	WsMessageType,
} from "../lib/sockets";
import { getDisplayTimestamp } from "../lib/timestamp-validation";
import { useSocket } from "../providers/SocketProvider";
import { MessageReactions } from "./MessageReactions";
import { ClickableDateSpan } from "./ui/ClickableDateSpan";

export const Bubbles = () => {
	const { channel, uuid } = useZustand();
	const { channelId } = channel;
	const { update } = useEvolu();
	const socketClient = useSocket();

	const messagesQueryResult = useQuery(messagesForChannelQuery(channelId));
	const reactionsQueryResult = useQuery(
		allReactionsForChannelQuery(
			NonEmptyString100.orThrow(channelId.slice(0, 100)),
		),
	);

	const handleDelete = async (item: (typeof messagesQueryResult)[0]) => {
		// Soft delete the message in local database
		update("message", {
			id: item.id,
			isDeleted: sqliteTrue,
		});
		// Soft delete the reactions
		(reactionsQueryResult ?? []).forEach((reaction) => {
			if (reaction.messageId !== item.id) return;
			update("reaction", {
				id: reaction.id,
				isDeleted: sqliteTrue,
			});
		});

		// Use updatedAt timestamp for DELETE (when message was deleted locally)
		const deleteMessage: DeleteMessage = {
			uuid: uuid,
			type: WsMessageType.DELETE,
			networkMessageId: item.networkMessageId,
			networkTimestamp: new Date(item.updatedAt).getTime().toString(),
			channelId: item.channelId,
			signature: null,
		};
		console.log("deleteMessage", deleteMessage);
		socketClient.safeSend(deleteMessage);
	};

	// Sort by display timestamp (uses networkTimestamp if valid, falls back to createdAt)
	const messages = alphabetical(
		unique(messagesQueryResult, (m) => m.networkMessageId),
		(m) => {
			const createdAt = new Date(m.createdAt).getTime();
			const displayTimestamp = getDisplayTimestamp(
				m.networkTimestamp ?? undefined,
				createdAt,
			);
			return displayTimestamp.toString();
		},
		"asc",
	);

	return messages.map((item, index) => {
		invariant(item.createdBy, "Message createdBy is required");
		const isMine = item.createdBy === uuid;
		const isEven = index % 2 === 0;

		const timestamp = new Date(item.createdAt).getTime();
		const ownerId = OwnerId.orThrow(item.createdBy);

		const validator = UserMessageDataSchema.safeParse(
			JSON.parse(item.user ?? "{}"),
		);
		if (!validator.success) {
			console.error("Failed to parse user data", validator.error);
			return null;
		}
		const user = validator.data;
		return ownerId ? (
			<div
				key={`${item.createdBy}-${new Date(item.createdAt).getTime()}`}
				className={`chat ${item.createdBy === uuid ? "chat-end" : "chat-start"}`}
			>
				<div className="chat-image">
					<div className="w-10 rounded-full">
						{user.pfpUrl ? (
							<img
								src={user.pfpUrl}
								alt="Profile"
								className="w-10 rounded-full"
							/>
						) : (
							<EvoluIdenticon
								id={ownerId}
								size={40}
								style={chosenIdenticonStyle}
							/>
						)}
					</div>
				</div>
				<div className="chat-header">{user.displayName ?? item.createdBy}</div>
				<div
					className={`chat-bubble ${
						isMine
							? "chat-bubble-success"
							: isEven
								? "chat-bubble-info"
								: "chat-bubble-primary"
					}`}
				>
					{item.content}
				</div>
				<div className="chat-footer flex items-center gap-2">
					<span className="opacity-50">
						<ClickableDateSpan timestamp={timestamp} />
					</span>
					{item.createdBy && (
						<MessageReactions
							messageId={item.id}
							networkMessageId={item.networkMessageId}
							isOwnMessage={isMine}
						/>
					)}
					{isMine && (
						<button
							type="button"
							onClick={() => handleDelete(item)}
							className="btn btn-ghost btn-xs opacity-50 hover:opacity-100"
							title="Delete message"
						>
							🗑️
						</button>
					)}
				</div>
			</div>
		) : (
			<div key={`${item.createdBy}-${new Date(item.createdAt).getTime()}`}>
				unknown
			</div>
		);
	});
};

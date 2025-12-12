import { NonEmptyString100, OwnerId, sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { EvoluIdenticon } from "@evolu/react-web";
import { alphabetical, unique } from "radash";
import { useState } from "react";
import invariant from "tiny-invariant";
import { useGarbledStore } from "../hooks/use-garbled";
import { useZustand } from "../hooks/use-zustand";
import { chosenIdenticonStyle } from "../lib/helpers";
import {
	allReactionsForChannelQuery,
	messagesForChannelQuery,
	useEvolu,
} from "../lib/local-first";
import {
	type DeleteMessage,
	type TextMessage,
	UserMessageDataSchema,
	WsMessageType,
} from "../lib/sockets";
import { getDisplayTimestamp } from "../lib/timestamp-validation";
import { useSocket } from "../providers/SocketProvider";
import { MessageDetailsModal } from "./MessageDetailsModal";
import { MessageReactions } from "./MessageReactions";
import { ClickableDateSpan } from "./ui/ClickableDateSpan";

export const Bubbles = () => {
	const { channel, uuid, verbose } = useZustand();
	const { channelId } = channel;
	const { update } = useEvolu();
	const socketClient = useSocket();
	const { getMessages } = useGarbledStore();
	const [selectedMessageId, setSelectedMessageId] = useState<
		string | undefined
	>();

	const messagesQueryResult = useQuery(messagesForChannelQuery(channelId));
	const reactionsQueryResult = useQuery(
		allReactionsForChannelQuery(
			NonEmptyString100.orThrow(channelId.slice(0, 100)),
		),
	);

	type MessageItem = (typeof messages)[0] | UndecryptableMessageItem;
	type UndecryptableMessageItem = {
		type: "undecryptable";
		message: TextMessage;
		timestamp: number;
		receivedAt: number;
	};
	// Type guard for undecryptable messages
	const isUndecryptable = (
		item: MessageItem,
	): item is UndecryptableMessageItem => {
		return "type" in item && item.type === "undecryptable";
	};

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

	// Combine regular messages with undecryptable messages
	const garbled = verbose
		? getMessages(channelId).map((m) => ({
				...m,
				timestamp: Number(m.message.networkTimestamp),
			}))
		: [];

	const allMessages: MessageItem[] = [
		...messages,
		...garbled.map((m) => ({
			type: "undecryptable" as const,
			message: m.message,
			timestamp: m.timestamp,
			receivedAt: m.receivedAt,
		})),
	];

	// Sort all messages by timestamp
	const sortedMessages = alphabetical(
		allMessages,
		(m) => {
			if (isUndecryptable(m)) {
				return m.timestamp.toString();
			}
			const createdAt = new Date(m.createdAt).getTime();
			const displayTimestamp = getDisplayTimestamp(
				m.networkTimestamp ?? undefined,
				createdAt,
			);
			return displayTimestamp.toString();
		},
		"asc",
	);

	const messageElements = sortedMessages.map((item, index) => {
		// Handle undecryptable messages
		if (isUndecryptable(item)) {
			const payload = item.message;
			const ownerId = OwnerId.orThrow(payload.uuid);
			const user = payload.user;
			const timestamp = item.timestamp;
			const isMine = payload.uuid === uuid;
			const isEven = index % 2 === 0;

			return (
				<div
					key={`undecryptable-${payload.networkMessageId}-${item.receivedAt}`}
					className={`chat ${isMine ? "chat-end" : "chat-start"}`}
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
					<div className="chat-header">
						{user.displayName ?? payload.uuid}
						<span className="text-xs opacity-50 ml-2">(encrypted)</span>
					</div>
					<div
						className={`chat-bubble ${
							isMine
								? "chat-bubble-warning"
								: isEven
									? "chat-bubble-warning"
									: "chat-bubble-warning"
						} opacity-70`}
					>
						<i className="ph-bold ph-lock mr-2" />
						<span className="italic">
							Unable to decrypt message (no key or decryption failed)
						</span>
					</div>
					<div className="chat-footer flex items-center gap-2">
						<span className="opacity-50">
							<ClickableDateSpan timestamp={timestamp} />
						</span>
					</div>
				</div>
			);
		}

		// Handle regular messages (existing logic)
		// TypeScript now knows this is a regular message
		const regularItem = item as (typeof messages)[0];
		invariant(regularItem.createdBy, "Message createdBy is required");
		const isMine = regularItem.createdBy === uuid;
		const isEven = index % 2 === 0;

		const timestamp = Number(regularItem.networkTimestamp);
		const ownerId = regularItem.createdBy
			? OwnerId.orThrow(regularItem.createdBy)
			: null;
		if (!ownerId) return null;

		const validator = UserMessageDataSchema.safeParse(
			JSON.parse(regularItem.user ?? "{}"),
		);
		if (!validator.success) {
			console.error("Failed to parse user data", validator.error);
			return null;
		}
		const user = validator.data;
		return ownerId ? (
			<div
				key={`${regularItem.createdBy}-${new Date(regularItem.createdAt).getTime()}`}
				className={`chat ${regularItem.createdBy === uuid ? "chat-end" : "chat-start"}`}
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
				<div className="chat-header">
					{user.displayName ?? regularItem.createdBy}
				</div>
				<button
					type="button"
					className={`chat-bubble ${
						isMine
							? "chat-bubble-success"
							: isEven
								? "chat-bubble-info"
								: "chat-bubble-primary"
					} cursor-pointer hover:opacity-90 transition-opacity text-left block`}
					onClick={() => setSelectedMessageId(regularItem.networkMessageId)}
				>
					{regularItem.content}
				</button>
				<div className="chat-footer flex items-center gap-2">
					<span className="opacity-50">
						<ClickableDateSpan timestamp={timestamp} />
					</span>
					{regularItem.createdBy && (
						<MessageReactions
							messageId={regularItem.id}
							networkMessageId={regularItem.networkMessageId}
							isOwnMessage={isMine}
						/>
					)}
					{isMine && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								handleDelete(regularItem);
							}}
							className="btn btn-ghost btn-xs opacity-50 hover:opacity-100"
							title="Delete message"
						>
							🗑️
						</button>
					)}
				</div>
			</div>
		) : (
			<div
				key={`${regularItem.createdBy}-${new Date(regularItem.createdAt).getTime()}`}
			>
				unknown
			</div>
		);
	});

	return (
		<>
			{messageElements}
			<MessageDetailsModal
				isOpen={!!selectedMessageId}
				onClose={() => setSelectedMessageId(undefined)}
				messageId={selectedMessageId}
			/>
		</>
	);
};

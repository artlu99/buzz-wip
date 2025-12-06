import type { OwnerId } from "@evolu/common";
import { sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { EvoluIdenticon } from "@evolu/react-web";
import { alphabetical, unique } from "radash";
import { useZustand } from "../hooks/use-zustand";
import { chosenIdenticonStyle } from "../lib/helpers";
import { messagesQuery, useEvolu } from "../lib/local-first";
import type { DeleteMessage } from "../lib/sockets";
import { WsMessageType } from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";
import { ClickableDateSpan } from "./ClickableDateSpan";
import { MessageReactions } from "./MessageReactions";

export const Bubbles = () => {
	const { displayName } = useZustand();
	const { update } = useEvolu();
	const socketClient = useSocket();

	const messagesQueryResult = useQuery(messagesQuery());

	const handleDelete = (item: typeof messagesQueryResult[0]) => {
		// Soft delete the message in local database
		update("message", {
			id: item.id,
			isDeleted: sqliteTrue,
		});

		// Send DELETE message over websocket
		const deleteMessage: DeleteMessage = {
			uuid: displayName,
			type: WsMessageType.DELETE,
			messageCreatedBy: item.createdBy,
			messageContent: item.content,
			createdBy: displayName,
		};
		try {
			socketClient.send(deleteMessage);
		} catch (err) {
			console.error("Failed to send delete message", err);
		}
	};

	const messages = alphabetical(
		unique(messagesQueryResult, (m) => `${m.createdBy}-${m.createdAt}`),
		(m) => m.createdAt,
		"asc",
	);

	return messages.map((item, index) => {
		const isMine = item.createdBy === displayName;
		const isEven = index % 2 === 0;

		const timestamp = new Date(item.createdAt).getTime();
		const ownerId = item.createdBy as OwnerId;
		return ownerId ? (
			<div
				key={`${item.createdBy}-${new Date(item.createdAt).getTime()}`}
				className={`chat ${item.createdBy === displayName ? "chat-end" : "chat-start"}`}
			>
				<div className="chat-image">
					<div className="w-10 rounded-full">
						<EvoluIdenticon
							id={ownerId}
							size={40}
							style={chosenIdenticonStyle}
						/>
					</div>
				</div>
				<div className="chat-header">{item.createdBy}</div>
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
							messageCreatedBy={item.createdBy}
							messageContent={item.content}
							isOwnMessage={isMine}
						/>
					)}
					{isMine && (
						<button
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

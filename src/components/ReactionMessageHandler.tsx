import { NonEmptyString100, sqliteFalse, sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useRef } from "react";
import { useZustand } from "../hooks/use-zustand";
import {
	allReactionsForChannelQuery,
	messagesQuery,
	useEvolu,
} from "../lib/local-first";
import {
	isReactionMessage,
	type ReactionMessage,
	type WsMessage,
	WsMessageType,
} from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";

export const ReactionMessageHandler = () => {
	const socketClient = useSocket();
	const { insert, update } = useEvolu();
	const { channelId, uuid } = useZustand();
	const allReactions = useQuery(allReactionsForChannelQuery(channelId));
	const allMessages = useQuery(messagesQuery());

	// Use refs to ensure handler always reads latest values from Evolu
	const allReactionsRef = useRef(allReactions);
	allReactionsRef.current = allReactions;
	const allMessagesRef = useRef(allMessages);
	allMessagesRef.current = allMessages;

	useEffect(() => {
		const handler = (e: WsMessage) => {
			if (!isReactionMessage(e.message)) return;

			const payload: ReactionMessage = e.message;

			// Early return if not for current channel
			if (payload.channelId !== channelId) {
				return;
			}

			if (payload.uuid === uuid) {
				return;
			}

			// Always read latest values from Evolu via refs
			const currentReactions = allReactionsRef.current ?? [];
			const currentMessages = allMessagesRef.current ?? [];

			// Find the message by networkMessageId to get the local message id
			const localMessage = currentMessages.find(
				(msg) => msg.networkMessageId === payload.networkMessageId,
			);

			if (!localMessage) {
				console.warn("[REACTION] Message not found:", {
					networkMessageId: payload.networkMessageId,
					channelId: payload.channelId,
				});
				return;
			}

			// Find the reaction by matching all criteria: local messageId, createdBy, and reaction type
			const existingReaction = currentReactions.find(
				(r) =>
					r.messageId === localMessage.id &&
					r.createdBy === payload.uuid &&
					String(r.reaction) === String(payload.reaction),
			);

			if (payload.isDeleted) {
				if (existingReaction && existingReaction.isDeleted !== sqliteTrue) {
					update("reaction", {
						id: existingReaction.id,
						isDeleted: sqliteTrue,
					});
				}
			} else {
				if (existingReaction) {
					if (existingReaction.isDeleted === sqliteTrue) {
						update("reaction", {
							id: existingReaction.id,
							isDeleted: sqliteFalse,
						});
					}
				} else {
					insert("reaction", {
						messageId: localMessage.id,
						reaction: NonEmptyString100.orThrow(payload.reaction.slice(0, 100)),
						channelId: NonEmptyString100.orThrow(
							payload.channelId.slice(0, 100),
						),
						createdBy: payload.uuid,
					});
				}
			}
		};

		socketClient.on(WsMessageType.REACTION, handler);
	}, [socketClient, insert, update, uuid, channelId]);

	return null;
};

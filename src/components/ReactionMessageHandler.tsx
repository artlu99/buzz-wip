import type { NonEmptyString100, OwnerId } from "@evolu/common";
import { sqliteFalse, sqliteTrue } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useRef } from "react";
import { useZustand } from "../hooks/use-zustand";
import {
	allReactionsForAllMessagesQuery,
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
	const { displayName } = useZustand();
	const allReactions = useQuery(allReactionsForAllMessagesQuery());
	const allMessages = useQuery(messagesQuery());

	// Use refs to ensure handler always reads latest values from Evolu
	// Update refs synchronously on every render to ensure they're always current
	const allReactionsRef = useRef(allReactions);
	const allMessagesRef = useRef(allMessages);
	allReactionsRef.current = allReactions;
	allMessagesRef.current = allMessages;

	useEffect(() => {
		const handler = (e: WsMessage) => {
			if (!isReactionMessage(e.message)) return;

			const payload: ReactionMessage = e.message;

			if (payload.createdBy === displayName) return;

			// Always read latest values from Evolu via refs
			const currentMessages = allMessagesRef.current ?? [];
			const currentReactions = allReactionsRef.current ?? [];

			const localMessage = currentMessages.find(
				(msg) =>
					msg.createdBy === payload.messageCreatedBy &&
					msg.content === payload.messageContent,
			);

			if (!localMessage) return;

			// Find the reaction by matching all three criteria: messageId, createdBy, and reaction type
			// Ensure string comparison by converting both to strings
			const existingReaction = currentReactions.find(
				(r) =>
					r.messageId === localMessage.id &&
					r.createdBy === payload.createdBy &&
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
						reaction: payload.reaction as NonEmptyString100,
						createdBy: payload.createdBy as OwnerId,
					});
				}
			}
		};

		socketClient.on(WsMessageType.REACTION, handler);
	}, [socketClient, insert, update, displayName]);

	return null;
};

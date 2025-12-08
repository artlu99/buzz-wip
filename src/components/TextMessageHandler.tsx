import {
	createIdFromString,
	NonEmptyString100,
	NonEmptyString1000,
	OwnerId,
	String100,
	String1000,
} from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useRef } from "react";
import invariant from "tiny-invariant";
import { useZustand } from "../hooks/use-zustand";
import { messagesForChannelQuery, useEvolu } from "../lib/local-first";
import {
	isTextMessage,
	type TextMessage,
	type WsMessage,
	WsMessageType,
} from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";

export const TextMessageHandler = () => {
	const socketClient = useSocket();
	const { insert, upsert } = useEvolu();
	const { channelId, uuid } = useZustand();

	const allMessages = useQuery(messagesForChannelQuery(channelId));
	const allMessagesRef = useRef(allMessages);
	allMessagesRef.current = allMessages;

	useEffect(() => {
		const handler = (e: WsMessage) => {
			if (!isTextMessage(e.message)) {
				return;
			}
			const payload: TextMessage = e.message;
			invariant(payload.uuid, "Text message has no uuid");

			if (payload.channelId !== channelId) return;
			if (payload.uuid === uuid) return;

			invariant(
				payload.encrypted === false,
				"Text messages must be unencrypted",
			);

			invariant(
				typeof payload.content === "string",
				"Content must be a string",
			);

			const networkMessageId = NonEmptyString100.orThrow(
				payload.networkMessageId.slice(0, 100),
			);
			// check if the message already exists in the database
			// this logic will handle 99.9% of non-race conditions
			const existingMessage = allMessagesRef.current?.find(
				(m) => m.networkMessageId === networkMessageId,
			);
			if (existingMessage) {
				return;
			}

			const json = JSON.stringify(payload.user);
			const userItem = NonEmptyString1000.orThrow(json);

			insert("message", {
				content: NonEmptyString1000.orThrow(payload.content.slice(0, 1000)),
				user: userItem,
				channelId: NonEmptyString100.orThrow(
					payload.channelId.slice(0, 100),
				),
				createdBy: OwnerId.orThrow(payload.uuid),
				networkMessageId: networkMessageId,
			});

			const networkUuid = NonEmptyString100.orThrow(payload.uuid);
			const displayName = String100.orThrow(
				payload.user.displayName?.slice(0, 100) ?? "<none>",
			);
			const pfpUrl = String1000.orThrow(
				payload.user.pfpUrl?.slice(0, 1000) ?? "<none>",
			);
			const bio = String1000.orThrow(payload.user.bio?.slice(0, 1000) ?? "");
			upsert("user", {
				id: createIdFromString(payload.uuid),
				networkUuid,
				displayName,
				pfpUrl,
				bio,
			});
		};

		socketClient.on(WsMessageType.TEXT, handler);
	}, [socketClient, channelId, uuid, insert, upsert]);

	return null;
};

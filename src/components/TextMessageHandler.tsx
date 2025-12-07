import { NonEmptyString100, NonEmptyString1000, OwnerId } from "@evolu/common";
import { useEffect } from "react";
import invariant from "tiny-invariant";
import { useZustand } from "../hooks/use-zustand";
import { useEvolu } from "../lib/local-first";
import {
	isTextMessage,
	type TextMessage,
	type WsMessage,
	WsMessageType,
} from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";

export const TextMessageHandler = () => {
	const socketClient = useSocket();
	const { insert } = useEvolu();
	const { channelName, displayName } = useZustand();

	useEffect(() => {
		const handler = (e: WsMessage) => {
			if (!isTextMessage(e.message)) {
				return;
			}
			const payload: TextMessage = e.message;

			if (payload.channelName !== channelName) return;
			if (payload.createdBy === displayName) return;

			invariant(
				payload.encrypted === false,
				"Text messages must be unencrypted",
			);

			const networkMessageId = NonEmptyString100.orThrow(
				payload.networkMessageId.slice(0, 100),
			);
			insert("message", {
				content: NonEmptyString1000.orThrow(payload.content.slice(0, 1000)),
				channelName: NonEmptyString100.orThrow(
					payload.channelName.slice(0, 100),
				),
				createdBy: OwnerId.orThrow(payload.createdBy),
				networkMessageId: networkMessageId,
			});
		};

		socketClient.on(WsMessageType.TEXT, handler);
	}, [socketClient, channelName, displayName, insert]);

	return null;
};

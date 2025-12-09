import {
	createIdFromString,
	NonEmptyString100,
	String100,
	String1000,
} from "@evolu/common";
import { useEffect } from "react";
import invariant from "tiny-invariant";
import { useZustand } from "../hooks/use-zustand";
import { useEvolu } from "../lib/local-first";
import {
	type ChannelData,
	isMarcoPoloMessage,
	type MarcoPoloMessage,
	type UserMessageData,
	type WsMessage,
	WsMessageType,
} from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";

export const MarcoPoloMessageHandler = () => {
	const socketClient = useSocket();
	const { upsert } = useEvolu();
	const { channelId, encryptionKey, uuid, user, setEncryptionKey } =
		useZustand();

	useEffect(() => {
		// Short-circuit if uuid is missing
		if (!uuid) return;

		const handler = (e: WsMessage) => {
			if (!isMarcoPoloMessage(e.message)) {
				return;
			}
			const payload: MarcoPoloMessage = e.message;
			invariant(payload.channelId, "Marco Polo message has no channel name");

			if (payload.channelId !== channelId) return;

			// handle Marco messages
			if (
				payload.message.user === undefined &&
				payload.message.channel === undefined
			) {
				const iam: UserMessageData = {
					...user,
				};
				const thisChannel: ChannelData = {
					id: channelId,
					publicUselessEncryptionKey: encryptionKey,
				};
				const message: MarcoPoloMessage = {
					type: WsMessageType.MARCO_POLO,
					channelId: channelId,
					message: { user: iam, channel: thisChannel },
				};
				socketClient.safeSend(message);
				return;
			}

			// handle Polo messages
			invariant(payload.uuid, "Marco Polo message has no uuid");
			const networkUuid = NonEmptyString100.orThrow(payload.uuid);
			const displayName = String100.orThrow(
				payload.message.user?.displayName?.slice(0, 100) ?? "<none>",
			);
			const pfpUrl = String1000.orThrow(
				payload.message.user?.pfpUrl?.slice(0, 1000) ?? "<none>",
			);
			const bio = String1000.orThrow(
				payload.message.user?.bio?.slice(0, 1000) ?? "",
			);
			if (payload.message.channel?.publicUselessEncryptionKey) {
				setEncryptionKey(
					payload.message.channel?.publicUselessEncryptionKey?.slice(0, 1000),
				);
			}

			upsert("user", {
				id: createIdFromString(networkUuid),
				networkUuid,
				displayName,
				pfpUrl,
				bio,
			});
			const id = createIdFromString(channelId);
			upsert("channel", {
				id,
				name: String100.orThrow(
					payload.message.channel?.name?.slice(0, 100) ?? channelId,
				),
				description: String1000.orThrow(
					payload.message.channel?.description?.slice(0, 1000) ?? "",
				),
				pfpUrl: String1000.orThrow(
					payload.message.channel?.pfpUrl?.slice(0, 1000) ?? "",
				),
				encryptionKey: String1000.orThrow(
					payload.message.channel?.publicUselessEncryptionKey?.slice(0, 1000) ??
						"",
				),
			});
		};

		socketClient.on(WsMessageType.MARCO_POLO, handler);
	}, [
		socketClient,
		channelId,
		encryptionKey,
		uuid,
		user,
		setEncryptionKey,
		upsert,
	]);

	return null;
};

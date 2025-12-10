import {
	createIdFromString,
	NonEmptyString100,
	String100,
	String1000,
} from "@evolu/common";
import { useEffect, useRef } from "react";
import invariant from "tiny-invariant";
import { useZustand } from "../../hooks/use-zustand";
import { useEvolu } from "../../lib/local-first";
import {
	type ChannelData,
	isMarcoPoloMessage,
	type MarcoPoloMessage,
	type UserMessageData,
	type WsMessage,
	WsMessageType,
} from "../../lib/sockets";
import { useSocket } from "../../providers/SocketProvider";

const PRUNE_INTERVAL_MS = 60000; // 1 minute
const STALE_THRESHOLD_MS = 600000; // 10 minutes

export const MarcoPoloMessageHandler = () => {
	const socketClient = useSocket();
	const { upsert } = useEvolu();
	const {
		channel,
		room,
		uuid,
		user,
		pruneStaleEntries,
		setEncryptionKey,
		setRoom,
	} = useZustand();

	const { channelId, encryptionKey } = channel;

	// Periodic pruning of stale room entries
	useEffect(() => {
		if (!uuid) return;

		const interval = setInterval(() => {
			pruneStaleEntries(STALE_THRESHOLD_MS);
		}, PRUNE_INTERVAL_MS);

		return () => clearInterval(interval);
	}, [uuid, pruneStaleEntries]);

	const uuidRef = useRef(uuid);
	uuidRef.current = uuid;
	const channelIdRef = useRef(channelId);
	channelIdRef.current = channelId;
	const userRef = useRef(user);
	userRef.current = user;
	const encryptionKeyRef = useRef(encryptionKey);
	encryptionKeyRef.current = encryptionKey;
	const roomRef = useRef(room);
	roomRef.current = room;

	useEffect(() => {
		// Short-circuit if uuid is missing
		if (!uuidRef.current) return;

		const handler = (e: WsMessage) => {
			if (!isMarcoPoloMessage(e.message)) {
				return;
			}
			const payload: MarcoPoloMessage = e.message;
			invariant(payload.channelId, "Marco Polo message has no channel name");

			if (payload.channelId !== channelIdRef.current) return;

			// respond to Marco messages
			if (
				payload.message.user === undefined &&
				payload.message.channel === undefined
			) {
				const iam: UserMessageData = {
					...userRef.current,
				};
				const thisChannel: ChannelData = {
					id: channelIdRef.current,
					publicUselessEncryptionKey: encryptionKey,
				};
				const message: MarcoPoloMessage = {
					type: WsMessageType.MARCO_POLO,
					channelId: channelIdRef.current,
					uuid: uuidRef.current,
					message: { user: iam, channel: thisChannel },
				};
				socketClient.safeSend(message);
				return;
			}

			// handle Polo messages
			invariant(payload.uuid, "Marco Polo message has no uuid");
			const networkUuid = NonEmptyString100.orThrow(payload.uuid);

			// Prune stale entries when a new user joins
			pruneStaleEntries(STALE_THRESHOLD_MS);

			// Update room with latest timestamp for this uuid (Record automatically keeps latest)
			setRoom({
				...roomRef.current,
				[networkUuid]: Date.now(),
			});

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
			const id = createIdFromString(channelIdRef.current);
			upsert("channel", {
				id,
				name: String100.orThrow(
					payload.message.channel?.name?.slice(0, 100) ?? channelIdRef.current,
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
		encryptionKey,
		pruneStaleEntries,
		setEncryptionKey,
		setRoom,
		upsert,
	]);

	return null;
};

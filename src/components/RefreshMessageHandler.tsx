import { useEffect } from "react";
import invariant from "tiny-invariant";
import { useZustand } from "../hooks/use-zustand";
import {
	isRefreshMessage,
	type RefreshMessage,
	type WsMessage,
	WsMessageType,
} from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";

export const RefreshMessageHandler = () => {
	const socketClient = useSocket();
	const { channelId, uuid } = useZustand();

	useEffect(() => {
		// Short-circuit if uuid is missing
		if (!uuid) return;

		const handler = (e: WsMessage) => {
			if (!isRefreshMessage(e.message)) {
				return;
			}
			const payload: RefreshMessage = e.message;
			invariant(payload.channelId, "Refresh message has no channel name");

			if (payload.channelId !== channelId) return;

			// get the messages, reactions, and deletes from my own replay history
			console.log("refresh messages", payload.channelId);
			// only give the last REFRESH_MAX_MESSAGE
			// only for the last REFRESH_LOOKBACK day
			// send the messages, reactions, and deletes back across sockets
		};

		socketClient.on(WsMessageType.TEXT, handler);
	}, [socketClient, channelId, uuid]);

	return null;
};

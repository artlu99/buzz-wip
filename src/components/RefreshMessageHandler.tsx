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
	const { channelName, uuid } = useZustand();

	useEffect(() => {
		// Short-circuit if uuid is missing
		if (!uuid) return;

		const handler = (e: WsMessage) => {
			if (!isRefreshMessage(e.message)) {
				return;
			}
			const payload: RefreshMessage = e.message;
			invariant(payload.channelName, "Refresh message has no channel name");

			if (payload.channelName !== channelName) return;

			// get the messages, reactions, and deletes from my own replay history
			console.log("refresh messages", payload.channelName);
			// only give the last REFRESH_MAX_MESSAGE
			// only for the last REFRESH_LOOKBACK day
			// send the messages, reactions, and deletes back across sockets
		};

		socketClient.on(WsMessageType.TEXT, handler);
	}, [socketClient, channelName, uuid]);

	return null;
};

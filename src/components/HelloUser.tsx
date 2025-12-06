import type { OwnerId } from "@evolu/common";
import { EvoluIdenticon } from "@evolu/react-web";
import { useEffect, useState } from "react";
import { chosenIdenticonStyle } from "../lib/helpers";
import {
	type DoorbellMessage,
	DoorbellType,
	isDoorbellMessage,
	type WsMessage,
	WsMessageType,
} from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";

export const HelloUser = () => {
	const [hello, setHello] = useState<WsMessage | null>(null);
	const socketClient = useSocket();

	useEffect(() => {
		socketClient.on(WsMessageType.DOORBELL, (e: WsMessage) => {
			if (!isDoorbellMessage(e.message)) {
				return;
			}
			const payload: DoorbellMessage = e.message;

			if (payload.message === DoorbellType.OPEN) {
				setHello(e);
			} else if (payload.message === DoorbellType.CLOSE) {
				setHello(null);
			}
		});
	}, [socketClient]);

	const payload = hello?.message as DoorbellMessage | undefined;
	const uuid = payload?.uuid ?? "unknown";
	const timestamp = new Date(hello?.date ?? 0).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	return hello ? (
		<div className="chat chat-start">
			<div className="chat-header">
				<div className="w-4 h-4 inline-block">
					<EvoluIdenticon
						id={uuid as OwnerId}
						size={16}
						style={chosenIdenticonStyle}
					/>
				</div>
				entered the room
			</div>
			<div className="chat-footer opacity-50">{timestamp}</div>
		</div>
	) : null;
};

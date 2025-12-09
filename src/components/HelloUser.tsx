import { NonEmptyString100 } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useState } from "react";
import { userQuery } from "../lib/local-first";
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
	const uuid = payload?.uuid;
	const timestamp = new Date(hello?.date ?? 0).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	// Query user data only if uuid is available
	// When uuid is undefined, use a placeholder ID (query will return empty results)
	const user = useQuery(
		userQuery(
			NonEmptyString100.orThrow((uuid ?? "uninitialized").slice(0, 100)),
		),
	);

	// Don't render if uuid is missing
	if (!uuid) {
		return null;
	}

	// At this point, uuid is guaranteed to be defined
	const displayName = user?.[0]?.displayName ?? uuid;

	return (
		<div className="chat chat-start">
			<div className="chat-header">
				<span className="">{displayName} entered the room...</span>
			</div>
			<div className="chat-footer opacity-50">{timestamp}</div>
		</div>
	);
};

import type { OwnerId } from "@evolu/common";
import { EvoluIdenticon } from "@evolu/react-web";
import { useEffect, useState } from "react";
import {
	isTypingIndicatorWsMessage,
	TypingIndicatorType,
	type TypingIndicatorWsMessage,
	type WsMessage,
	WsMessageType,
} from "../lib/sockets";
import { useSocket } from "../providers/SocketProvider";
import { chosenIdenticonStyle } from "../lib/helpers";

const STALE_TIME = 5000; // 5 seconds

export const TypingIndicators = () => {
	const [typingIndicators, setTypingIndicators] = useState<
		TypingIndicatorWsMessage[]
	>([]);
	const socketClient = useSocket();

	useEffect(() => {
		socketClient.on(WsMessageType.STATUS, (e: WsMessage) => {
			if (!isTypingIndicatorWsMessage(e)) {
				return;
			}
			const payload = e.message;
			const id = payload.uuid ?? "unknown";

			if (payload.presence === TypingIndicatorType.TYPING) {
				setTypingIndicators((prev) => {
					const withoutExisting = prev.filter(
						(item) => item.message.uuid !== id,
					);
					const withoutStale = [...withoutExisting, e].filter(
						(item) => Date.now() < new Date(item.date).getTime() + STALE_TIME,
					);
					return withoutStale;
				});
			} else if (payload.presence === TypingIndicatorType.STOP_TYPING) {
				// Immediately remove the typing indicator for this user
				setTypingIndicators((prev) =>
					prev.filter((item) => item.message.uuid !== id),
				);
			}
		});
	}, [socketClient]);

	return typingIndicators
		.filter((item) => item.message.presence === TypingIndicatorType.TYPING)
		.map((indicator) => (
			<div key={`${indicator.message.uuid}`} className="chat chat-start">
				<div className="chat-header">
					<div className="w-4 h-4 inline-block">
						<EvoluIdenticon
							id={indicator.message.uuid as OwnerId}
							size={16}
							style={chosenIdenticonStyle}
						/>
					</div>
					started typing...
				</div>
				<div className="chat-footer opacity-50">
					<time className="text-xs ml-2">
						{new Date(indicator.date).toLocaleTimeString()}
					</time>
				</div>
			</div>
		));
};

import { OwnerId } from "@evolu/common";
import { EvoluIdenticon } from "@evolu/react-web";
import { useEffect, useState } from "react";
import invariant from "tiny-invariant";
import { useZustand } from "../../hooks/use-zustand";
import { chosenIdenticonStyle } from "../../lib/helpers";
import {
	isTypingIndicatorMessage,
	type KnownMessage,
	type TypingIndicatorMessage,
	TypingIndicatorType,
	type WsMessage,
	WsMessageType,
} from "../../lib/sockets";
import { useSocket } from "../../providers/SocketProvider";

const STALE_TIME = 5000; // 5 seconds

export const TypingIndicators = () => {
	const [typingIndicators, setTypingIndicators] = useState<
		WsMessage<TypingIndicatorMessage>[]
	>([]);
	const socketClient = useSocket();

	useEffect(() => {
		if (!socketClient) return;
		socketClient.on(WsMessageType.STATUS, (e: WsMessage<KnownMessage>) => {
			if (!isTypingIndicatorMessage(e.message)) {
				return;
			}
			const payload: TypingIndicatorMessage = e.message;

			// add payload.uuid to room
			useZustand.getState().setRoom({
				...useZustand.getState().room,
				[payload.uuid ?? "unknown"]: Date.now(),
			});

			if (payload.presence === TypingIndicatorType.TYPING) {
				setTypingIndicators((prev) => {
					const withoutExisting = prev.filter(
						(item) => item.message.uuid !== payload.uuid,
					);
					const typedMessage: WsMessage<TypingIndicatorMessage> = {
						...e,
						message: payload,
					};
					const withoutStale = [...withoutExisting, typedMessage].filter(
						(item) => Date.now() < new Date(item.date).getTime() + STALE_TIME,
					);
					return withoutStale;
				});
			} else if (payload.presence === TypingIndicatorType.STOP_TYPING) {
				// Immediately remove the typing indicator for this user
				setTypingIndicators((prev) =>
					prev.filter((item) => item.message.uuid !== payload.uuid),
				);
			}
		});
	}, [socketClient]);

	return typingIndicators
		.filter(
			(item) =>
				item.message.uuid &&
				item.message.presence === TypingIndicatorType.TYPING,
		)
		.map((indicator) => {
			invariant(indicator.message.uuid, "Typing indicator must have a uuid");
			return (
				<div key={`${indicator.message.uuid}`} className="chat chat-start">
					<div className="chat-header">
						<div className="w-4 h-4 inline-block">
							<EvoluIdenticon
								id={OwnerId.orThrow(indicator.message.uuid)}
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
			);
		});
};

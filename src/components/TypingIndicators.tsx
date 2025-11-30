import { useEffect, useState } from "react";
import { useSocket } from "../providers/SocketProvider";
import {
  TypingIndicatorType,
  WsMessageType,
  isTypingIndicatorMessage,
  type TypingIndicatorMessage,
  type WsMessage,
} from "../lib/sockets";

const STALE_TIME = 5000; // 5 seconds

export const TypingIndicators = () => {
  const [typingIndicators, setTypingIndicators] = useState<WsMessage[]>([]);
  const socketClient = useSocket();

  useEffect(() => {
    socketClient.on(WsMessageType.STATUS, (e: WsMessage) => {
      if (!isTypingIndicatorMessage(e.message)) {
        return;
      }
      const payload: TypingIndicatorMessage = e.message;
      const id = payload.uuid ?? "unknown";

      if (payload.presence === TypingIndicatorType.TYPING) {
        setTypingIndicators((prev) => {
          const withoutExisting = prev.filter(
            (item) => item.message.uuid !== id
          );
          const withoutStale = [...withoutExisting, e].filter(
            (item) =>
              new Date().getTime() < new Date(item.date).getTime() + STALE_TIME
          );
          return withoutStale;
        });
      } else if (payload.presence === TypingIndicatorType.STOP_TYPING) {
        // Immediately remove the typing indicator for this user
        setTypingIndicators((prev) =>
          prev.filter((item) => item.message.uuid !== id)
        );
      }
    });
  }, []);

  return typingIndicators
    .filter(
      (item) =>
        item.message?.type === WsMessageType.STATUS &&
        item.message?.presence === TypingIndicatorType.TYPING
    )
    .map((indicator) => (
      <div key={`${indicator.message.uuid}`} className="chat chat-start">
        <div className="chat-header">
          {indicator.message.uuid}
          <time className="text-xs opacity-50 ml-2">
            {new Date(indicator.date).toLocaleTimeString()}
          </time>
        </div>
        <div className="chat-bubble chat-bubble-info">Typing...</div>
        <div className="chat-footer opacity-50">disappears after 5 seconds</div>
      </div>
    ));
};

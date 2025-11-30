import { connect, type IttySocket } from "itty-sockets";

export type WsMessage = {
  date: number; // Unix timestamp of original message
  uid: String; // unique user ID of the sending connection
  message: any; // your message payload
};

export enum WsMessageType {
  DOORBELL = "doorbell",
  STATUS = "status",
  REACTION = "reaction",
  TEXT = "text",
}

export enum TypingIndicatorType {
  TYPING = "typing",
  STOP_TYPING = "stop_typing",
}

export enum DoorbellType {
  OPEN = "hello",
  CLOSE = "bye",
}

export interface TypingIndicatorMessage {
  uuid?: string;
  type: WsMessageType.STATUS;
  presence: TypingIndicatorType;
  text?: string;
}

export interface DoorbellMessage {
  uuid?: string;
  type: WsMessageType.DOORBELL;
  text: DoorbellType;
}

export function isTypingIndicatorMessage(
  message: any
): message is TypingIndicatorMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === WsMessageType.STATUS &&
    "presence" in message &&
    (message.presence === TypingIndicatorType.TYPING ||
      message.presence === TypingIndicatorType.STOP_TYPING)
  );
}

export class TypedWsClient {
  private socket: IttySocket;

  constructor(channelName: string) {
    this.socket = connect(channelName);
  }

  public on(event: WsMessageType, callback: (message: WsMessage) => void) {
    this.socket.on(event as string, callback);
  }

  public send(message: TypingIndicatorMessage | DoorbellMessage) {
    this.socket.send(message);
  }
}

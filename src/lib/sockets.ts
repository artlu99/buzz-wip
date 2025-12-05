import { connect, type IttySocket } from "itty-sockets";

export type WsMessage = {
  date: number; // Unix timestamp of original message
  uid: string; // unique user ID of the sending connection
  message: unknown; // your message payload
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
  message: DoorbellType;
}

export interface TextMessage {
  uuid?: string;
  type: WsMessageType.TEXT;
  content: string;
  createdAt: number;
  createdBy: string;
}

export function isTypingIndicatorMessage(
  message: unknown
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

export function isTextMessage(message: unknown): message is TextMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === WsMessageType.TEXT
  );
}

export function isDoorbellMessage(
  message: unknown
): message is DoorbellMessage {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === WsMessageType.DOORBELL &&
    "message" in message &&
    (message.message === DoorbellType.OPEN || message.message === DoorbellType.CLOSE)
  );
}

export type TypingIndicatorWsMessage = WsMessage & {
  message: TypingIndicatorMessage;
};

export function isTypingIndicatorWsMessage(
  wsMessage: WsMessage
): wsMessage is TypingIndicatorWsMessage {
  return isTypingIndicatorMessage(wsMessage.message);
}

export class TypedWsClient {
  private socket: IttySocket;

  constructor(channelName: string) {
    this.socket = connect(channelName);
  }

  public on(event: WsMessageType, callback: (message: WsMessage) => void) {
    this.socket.on(event as string, callback);
  }

  public send(message: TypingIndicatorMessage | DoorbellMessage | TextMessage) {
    this.socket.send(message);
  }
}

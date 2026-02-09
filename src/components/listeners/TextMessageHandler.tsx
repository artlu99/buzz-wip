import {
	createIdFromString,
	NonEmptyString100,
	NonEmptyString1000,
	OwnerId,
	String100,
	String1000,
} from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useRef } from "react";
import invariant from "tiny-invariant";
import { useGarbledStore } from "../../hooks/use-garbled";
import { useZustand } from "../../hooks/use-zustand";
import { messagesForChannelQuery, useEvolu } from "../../lib/local-first";
import {
	isEncryptedMessage,
	isTextMessage,
	type KnownMessage,
	type TextMessage,
	type WsMessage,
	WsMessageType,
} from "../../lib/sockets";
import { decryptMessagePayload } from "../../lib/symmetric-encryption";
import {
	getSafeNetworkTimestamp,
	validateNetworkTimestamp,
} from "../../lib/timestamp-validation";
import { useSocket } from "../../providers/SocketProvider";

export const TextMessageHandler = () => {
	const socketClient = useSocket();
	const { insert, upsert } = useEvolu();
	const { channel } = useZustand();
	const { channelId } = channel;

	const allMessages = useQuery(messagesForChannelQuery(channelId));
	const allMessagesRef = useRef(allMessages);
	allMessagesRef.current = allMessages;

	useEffect(() => {
		if (!socketClient) return;
		const handler = (e: WsMessage<KnownMessage>) => {
			let message = e.message;

			// Handle encryption at the top level
			if (isEncryptedMessage(message)) {
				const state = useZustand.getState();
				const encryptionKey = state.channel.encryptionKey;
				if (!encryptionKey) {
					// message is encrypted but no decryption key is set
					console.log("[TEXT HANDLER] Encrypted message but no key available", {
						networkMessageId: message.networkMessageId,
					});
					useGarbledStore.getState().addMessage(message);
					return;
				}
				const decrypted = decryptMessagePayload<TextMessage>(
					message,
					encryptionKey,
				);
				if (!decrypted) {
					console.warn("[TEXT HANDLER] Unable to decrypt message", {
						networkMessageId: message.networkMessageId,
						hasKey: !!encryptionKey,
					});
					useGarbledStore.getState().addMessage(message);
					return;
				}
				message = decrypted;
				console.log("[TEXT HANDLER] Successfully decrypted message", {
					networkMessageId: message.networkMessageId,
					isAutoResponder:
						"autoResponder" in message ? message.autoResponder : false,
				});
			}

			if (!isTextMessage(message)) {
				console.log("[TEXT HANDLER] Not a text message", {
					type: "type" in message ? message.type : "unknown",
					networkMessageId:
						"networkMessageId" in message
							? message.networkMessageId
							: "unknown",
				});
				return;
			}
			const payload: TextMessage = message;
			invariant(payload.uuid, "Text message has no uuid");

			// Use getState() to read current values without subscribing
			const state = useZustand.getState();
			const currentChannelId = state.channel.channelId;
			const currentUuid = state.uuid;

			if (payload.channelId !== currentChannelId) {
				console.log("[TEXT HANDLER] Wrong channel", {
					payloadChannel: payload.channelId,
					currentChannel: currentChannelId,
					networkMessageId: payload.networkMessageId,
				});
				return;
			}

			const uuid = payload.uuid;
			if (uuid === currentUuid) {
				console.log("[TEXT HANDLER] Own message, skipping", {
					networkMessageId: payload.networkMessageId,
					isAutoResponder:
						"autoResponder" in payload ? payload.autoResponder : false,
				});
				return;
			}

			const content = payload.content;
			const user = payload.user;

			const networkMessageId = NonEmptyString100.orThrow(
				payload.networkMessageId.slice(0, 100),
			);
			// check if the message already exists in the database
			// this logic will handle 99.9% of non-race conditions
			const existingMessage = allMessagesRef.current?.find(
				(m) => m.networkMessageId === networkMessageId,
			);
			if (existingMessage) {
				console.log("[TEXT HANDLER] Message already exists, skipping", {
					networkMessageId,
					isAutoResponder: payload.autoResponder,
					existingId: existingMessage.id,
				});
				return;
			}

			console.log("[TEXT HANDLER] Processing new message", {
				networkMessageId,
				isAutoResponder: payload.autoResponder,
				uuid: payload.uuid,
				hasContent: !!content,
			});

			const json = JSON.stringify(user);
			const userItem = NonEmptyString1000.orThrow(json);

			// Validate and get safe network timestamp
			const timestampValidation = validateNetworkTimestamp(
				payload.networkTimestamp,
				Date.now(),
			);
			if (!timestampValidation.valid && timestampValidation.reason) {
				console.warn("[TEXT HANDLER] Invalid networkTimestamp:", {
					networkMessageId,
					reason: timestampValidation.reason,
					originalTimestamp: timestampValidation.originalTimestamp,
				});
			}
			const safeNetworkTimestamp = getSafeNetworkTimestamp(
				payload.networkTimestamp,
				Date.now(),
			);

			// Use current functions from closure
			insert("message", {
				content: NonEmptyString1000.orThrow(content.slice(0, 1000)),
				user: userItem,
				channelId: NonEmptyString100.orThrow(payload.channelId.slice(0, 100)),
				createdBy: OwnerId.orThrow(uuid),
				networkMessageId: networkMessageId,
				networkTimestamp: safeNetworkTimestamp,
				signature: payload.signature ?? "",
			});
			if (user && user.displayName !== payload.uuid) {
				const networkUuid = NonEmptyString100.orThrow(uuid);
				const displayName = String100.orThrow(
					user.displayName?.slice(0, 100) ?? "<none>",
				);
				const pfpUrl = String1000.orThrow(
					user.pfpUrl?.slice(0, 1000) ?? "<none>",
				);
				const bio = String1000.orThrow(user.bio?.slice(0, 1000) ?? "");
				const status = String100.orThrow(user.status?.slice(0, 100) ?? "");
				const publicNtfyShId = String100.orThrow(
					user.publicNtfyShId?.slice(0, 100) ?? "",
				);
				upsert("user", {
					id: createIdFromString(uuid),
					networkUuid,
					displayName,
					pfpUrl,
					bio,
					status,
					publicNtfyShId,
					privateNtfyShId: String100.orThrow(""),
					publicEthereumAddress: String100.orThrow(""),
				});
			}
		};

		socketClient.on(WsMessageType.TEXT, handler);
		// Only re-register when socketClient changes, not when encryptionKey/channelId/uuid change
		// The handler reads from refs, so it always has the latest values
	}, [socketClient, insert, upsert]);

	return null;
};

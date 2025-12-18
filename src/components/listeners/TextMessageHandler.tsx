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
	isTextMessage,
	type KnownMessage,
	type TextMessage,
	type UserMessageData,
	UserMessageDataSchema,
	type WsMessage,
	WsMessageType,
} from "../../lib/sockets";
import {
	decryptMessageContent,
	isSerializedEncryptedData,
	SerializedEncryptedDataSchema,
} from "../../lib/symmetric-encryption";
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
		const handler = (e: WsMessage<KnownMessage>) => {
			if (!isTextMessage(e.message)) {
				return;
			}
			const payload: TextMessage = e.message;
			invariant(payload.uuid, "Text message has no uuid");

			// Use getState() to read current values without subscribing
			const state = useZustand.getState();
			const currentChannelId = state.channel.channelId;
			const currentUuid = state.uuid;
			const currentEncryptionKey = state.channel.encryptionKey;

			if (payload.channelId !== currentChannelId) return;

			if (payload.encrypted && !currentEncryptionKey) {
				// message is encrypted but no decryption key is set
				useGarbledStore.getState().addMessage(payload);
				return;
			}

			let uuid: string | undefined;
			if (isSerializedEncryptedData(payload.uuid)) {
				uuid = decryptMessageContent(
					payload.uuid,
					currentEncryptionKey ?? "won't work",
				);
			} else {
				uuid = payload.uuid;
			}

			if (uuid === currentUuid) return;
			if (!uuid) {
				console.warn("[TEXT HANDLER] Unable to decrypt uuid", { payload });
				useGarbledStore.getState().addMessage(payload);
				return;
			}

			let content: string | undefined;
			if (typeof payload.content === "string") {
				content = payload.content;
			} else {
				if (!currentEncryptionKey) {
					useGarbledStore.getState().addMessage(payload);
					return;
				}

				content = decryptMessageContent(payload.content, currentEncryptionKey);
				if (!content) {
					useGarbledStore.getState().addMessage(payload);
					return;
				}
			}

			let user: UserMessageData | undefined;
			if (payload.user && !isSerializedEncryptedData(payload.user)) {
				user = payload.user;
			} else {
				const validatedEncryptedUser = SerializedEncryptedDataSchema.safeParse(
					payload.user,
				);
				if (validatedEncryptedUser.success) {
					if (currentEncryptionKey) {
						const decryptedUser = decryptMessageContent(
							validatedEncryptedUser.data,
							currentEncryptionKey,
						);
						if (decryptedUser) {
							const validator = UserMessageDataSchema.safeParse(decryptedUser);
							if (validator.success) {
								user = {
									...validator.data,
									status: validator.data.status ?? "",
									publicNtfyShId: validator.data.publicNtfyShId ?? "",
								};
							} else {
								console.warn("[TEXT HANDLER] Invalid user data", {
									decryptedUser,
									validator: validator.error,
								});
								user = {
									displayName: uuid ?? "<encrypted>",
									pfpUrl: "",
									bio: "",
									status: "",
									publicNtfyShId: "",
								};
							}
						}
					} else {
						user = {
							displayName: uuid ?? "<encrypted>",
							pfpUrl: "",
							bio: "",
							status: "",
							publicNtfyShId: "",
						};
					}
				}
			}

			const networkMessageId = NonEmptyString100.orThrow(
				payload.networkMessageId.slice(0, 100),
			);
			// check if the message already exists in the database
			// this logic will handle 99.9% of non-race conditions
			const existingMessage = allMessagesRef.current?.find(
				(m) => m.networkMessageId === networkMessageId,
			);
			if (existingMessage) {
				return;
			}

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
				});
			}
		};

		socketClient.on(WsMessageType.TEXT, handler);
		// Only re-register when socketClient changes, not when encryptionKey/channelId/uuid change
		// The handler reads from refs, so it always has the latest values
	}, [socketClient, insert, upsert]);

	return null;
};

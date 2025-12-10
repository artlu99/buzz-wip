import {
	createIdFromString,
	createRandomBytes,
	createSymmetricCrypto,
	type EncryptionKey,
	NonEmptyString100,
	NonEmptyString1000,
	OwnerId,
	String100,
	String1000,
} from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useRef } from "react";
import invariant from "tiny-invariant";
import { useZustand } from "../../hooks/use-zustand";
import { Base64ToUint8Array } from "../../lib/helpers";
import { messagesForChannelQuery, useEvolu } from "../../lib/local-first";
import {
	isTextMessage,
	type TextMessage,
	type WsMessage,
	WsMessageType,
} from "../../lib/sockets";
import { useSocket } from "../../providers/SocketProvider";

export const TextMessageHandler = () => {
	const socketClient = useSocket();
	const { insert, upsert } = useEvolu();
	const { channel, uuid } = useZustand();
	const { channelId, encryptionKey } = channel;

	const allMessages = useQuery(messagesForChannelQuery(channelId));
	const allMessagesRef = useRef(allMessages);
	allMessagesRef.current = allMessages;

	// Use refs to always read the latest values without re-registering the handler
	const channelIdRef = useRef(channelId);
	const encryptionKeyRef = useRef(encryptionKey);
	const uuidRef = useRef(uuid);
	const insertRef = useRef(insert);
	const upsertRef = useRef(upsert);

	// Keep refs in sync with current values (using useEffect is more React-idiomatic)
	useEffect(() => {
		channelIdRef.current = channelId;
		encryptionKeyRef.current = encryptionKey;
		uuidRef.current = uuid;
		insertRef.current = insert;
		upsertRef.current = upsert;
	}, [channelId, encryptionKey, uuid, insert, upsert]);

	useEffect(() => {
		const handler = (e: WsMessage) => {
			if (!isTextMessage(e.message)) {
				return;
			}
			const payload: TextMessage = e.message;
			invariant(payload.uuid, "Text message has no uuid");

			// Read from refs to get the latest values
			if (payload.channelId !== channelIdRef.current) return;
			if (payload.uuid === uuidRef.current) return;

			let content: string | undefined;
			if (typeof payload.content === "string") {
				content = payload.content;
			} else {
				const currentEncryptionKey = encryptionKeyRef.current;
				if (!currentEncryptionKey) {
					return;
				}

				const symmetricEncryptionKey = Base64ToUint8Array(
					currentEncryptionKey ?? "",
				) as EncryptionKey;

				const { ciphertext, nonce } = payload.content;

				const randomBytes = createRandomBytes();
				const crypt = createSymmetricCrypto({
					randomBytes,
				});

				const decryptedContent = crypt.decrypt(
					Base64ToUint8Array(ciphertext),
					symmetricEncryptionKey,
					Base64ToUint8Array(nonce),
				);

				if (decryptedContent.ok) {
					content = new TextDecoder().decode(decryptedContent.value);
				}
			}
			if (!content) {
				return;
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

			const json = JSON.stringify(payload.user);
			const userItem = NonEmptyString1000.orThrow(json);

			// Use refs to get the latest functions
			insertRef.current("message", {
				content: NonEmptyString1000.orThrow(content.slice(0, 1000)),
				user: userItem,
				channelId: NonEmptyString100.orThrow(payload.channelId.slice(0, 100)),
				createdBy: OwnerId.orThrow(payload.uuid),
				networkMessageId: networkMessageId,
			});

			const networkUuid = NonEmptyString100.orThrow(payload.uuid);
			const displayName = String100.orThrow(
				payload.user.displayName?.slice(0, 100) ?? "<none>",
			);
			const pfpUrl = String1000.orThrow(
				payload.user.pfpUrl?.slice(0, 1000) ?? "<none>",
			);
			const bio = String1000.orThrow(payload.user.bio?.slice(0, 1000) ?? "");
			upsertRef.current("user", {
				id: createIdFromString(payload.uuid),
				networkUuid,
				displayName,
				pfpUrl,
				bio,
			});
		};

		socketClient.on(WsMessageType.TEXT, handler);
		// Only re-register when socketClient changes, not when encryptionKey/channelId/uuid change
		// The handler reads from refs, so it always has the latest values
	}, [socketClient]);

	return null;
};

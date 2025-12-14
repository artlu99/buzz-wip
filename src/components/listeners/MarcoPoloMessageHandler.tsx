import {
	createIdFromString,
	NonEmptyString100,
	String100,
	String1000,
} from "@evolu/common";
import { useEffect, useMemo, useRef } from "react";
import invariant from "tiny-invariant";
import { lru } from "tiny-lru";
import { useZustand } from "../../hooks/use-zustand";
import { useAutoResponder } from "../../hooks/useAutoResponder";
import { useEvolu } from "../../lib/local-first";
import {
	isMarcoPoloMessage,
	type MarcoPoloMessage,
	type UserMessageData,
	type WsMessage,
	WsMessageType,
} from "../../lib/sockets";
import {
	decryptMessageContent,
	prepareMessageContent,
	SerializedEncryptedDataSchema,
} from "../../lib/symmetric-encryption";
import { useSocket } from "../../providers/SocketProvider";

export const MarcoPoloMessageHandler = () => {
	const socketClient = useSocket();
	const { upsert } = useEvolu();
	const { uuid, setEncryptionKey, setRoom, channel, lockdown } = useZustand();

	// Memoize autoresponder options to prevent re-creating on every render
	// Read from Zustand state directly (not getState()) to ensure reactivity
	const autoResponderOptions = useMemo(
		() => ({
			socketClient,
			channelId: channel.channelId,
			uuid: uuid,
			encryptionKey: channel.encryptionKey,
			encrypted: channel.encrypted,
		}),
		[
			socketClient,
			channel.channelId,
			uuid,
			channel.encryptionKey,
			channel.encrypted,
		],
	);

	// Use autoresponder hook for Marco message handling
	useAutoResponder(autoResponderOptions);

	// No periodic pruning needed - room entries are filtered on read via getActiveRoom()
	// The room state persists stale entries for recovery, but they're filtered when accessed

	// LRU cache for Marco response deduplication
	// Max 100 entries with 1s TTL - automatically evicts expired entries
	// Key: uuid (the user we're responding to), Value: timestamp (not used, just for existence check)
	const marcoResponseCacheRef = useRef(lru<number>(100, 1000, true)); // max=100, ttl=1s, resetTtl=true

	// Track encryption key and lockdown to proactively broadcast changes
	const lastEncryptionKeyRef = useRef<string | undefined>(
		channel.encryptionKey,
	);
	const lastLockdownRef = useRef<boolean>(lockdown);
	const isInitialMountRef = useRef(true);

	// Proactively broadcast encryption key changes via Polo messages
	useEffect(() => {
		if (!uuid) return;
		if (isInitialMountRef.current) {
			// Don't broadcast on initial mount
			isInitialMountRef.current = false;
			lastEncryptionKeyRef.current = channel.encryptionKey;
			lastLockdownRef.current = lockdown;
			return;
		}

		const currentState = useZustand.getState();
		const currentEncryptionKey = channel.encryptionKey;
		const currentLockdown = lockdown;
		const currentChannelId = channel.channelId;

		// Check if encryption key or lockdown changed
		const keyChanged = currentEncryptionKey !== lastEncryptionKeyRef.current;
		const lockdownChanged = currentLockdown !== lastLockdownRef.current;

		// Only broadcast if:
		// 1. Key changed AND we're not in lockdown (so we can share the new key)
		// 2. Lockdown changed from true to false (so we can share the key again)
		// Don't broadcast when entering lockdown (undefined key is ignored by receivers anyway)
		const shouldBroadcast =
			(keyChanged && !currentLockdown) ||
			(lockdownChanged && !currentLockdown && currentEncryptionKey);

		if (shouldBroadcast) {
			console.log(
				"[MARCO HANDLER] Encryption key or lockdown changed, broadcasting Polo message",
				{
					keyChanged,
					lockdownChanged,
					currentEncryptionKey: currentEncryptionKey ? "***" : undefined,
					currentLockdown,
				},
			);

			// Update refs
			lastEncryptionKeyRef.current = currentEncryptionKey;
			lastLockdownRef.current = currentLockdown;

			// Broadcast Polo message with updated channel data
			const iam: UserMessageData = {
				...currentState.user,
			};
			const { content: encryptedIam, encrypted: isEncryptedIam } =
				prepareMessageContent(
					JSON.stringify(iam),
					currentState.channel.encrypted,
					currentState.channel.encryptionKey,
				);

			const thisChannel = useZustand
				.getState()
				.createChannelData(currentChannelId);
			const message: MarcoPoloMessage = {
				type: WsMessageType.MARCO_POLO,
				channelId: currentChannelId,
				uuid: uuid,
				message: {
					user: lockdown
						? undefined
						: isEncryptedIam && typeof encryptedIam !== "string"
							? encryptedIam
							: iam,
					channel: thisChannel,
				},
			};
			socketClient.safeSend(message);
		} else if (keyChanged || lockdownChanged) {
			// Update refs even if we don't broadcast (to track state)
			lastEncryptionKeyRef.current = currentEncryptionKey;
			lastLockdownRef.current = currentLockdown;
		}
	}, [socketClient, uuid, channel.encryptionKey, channel.channelId, lockdown]);

	useEffect(() => {
		// Short-circuit if uuid is missing
		if (!uuid) return;

		const currentEncryptionKey = channel.encryptionKey;

		const handler = (e: WsMessage) => {
			if (!isMarcoPoloMessage(e.message)) {
				return;
			}
			const payload: MarcoPoloMessage = e.message;
			invariant(payload.channelId, "Marco Polo message has no channel name");

			const state = useZustand.getState();
			const currentChannelId = state.channel.channelId;
			if (payload.channelId !== currentChannelId) return;

			// respond to Marco messages
			if (
				payload.message.user === undefined &&
				payload.message.channel === undefined
			) {
				// Prevent duplicate Marco responses using LRU cache with TTL
				// Key: our uuid (we're responding as ourselves)
				const responseKey = state.uuid;
				if (
					responseKey &&
					marcoResponseCacheRef.current.get(responseKey) !== undefined
				) {
					console.log(
						"[MARCO HANDLER] Skipping duplicate Marco response (within TTL)",
					);
					return;
				}

				const iam: UserMessageData = {
					...state.user,
				};
				// Use Zustand method to create channel data (respects lockdown, reads fresh state)
				const thisChannel = useZustand
					.getState()
					.createChannelData(currentChannelId);
				const message: MarcoPoloMessage = {
					type: WsMessageType.MARCO_POLO,
					channelId: currentChannelId,
					uuid: state.uuid,
					message: { user: iam, channel: thisChannel },
				};
				socketClient.safeSend(message);
				// Store in cache (TTL handles expiration automatically)
				if (responseKey) {
					marcoResponseCacheRef.current.set(responseKey, Date.now());
				}
				return;
			}

			// handle Polo messages
			invariant(payload.uuid, "Marco Polo message has no uuid");
			const networkUuid = NonEmptyString100.orThrow(payload.uuid);

			// Update room with latest timestamp for this uuid (Record automatically keeps latest)
			// Stale entries are filtered on read via getActiveRoom(), no need to prune proactively
			setRoom({
				...state.room,
				[networkUuid]: Date.now(),
			});

			// Only accept encryption key if not in lockdown (read fresh state)
			if (payload.message.channel?.publicUselessEncryptionKey) {
				const currentState = useZustand.getState();
				if (!currentState.lockdown) {
					setEncryptionKey(
						payload.message.channel?.publicUselessEncryptionKey?.slice(0, 1000),
					);
				}
			}

			let user: UserMessageData | undefined;
			const validatedEncryptedUser = SerializedEncryptedDataSchema.safeParse(
				payload.message.user,
			);
			if (validatedEncryptedUser.success) {
				if (currentEncryptionKey) {
					const decryptedUser = decryptMessageContent(
						validatedEncryptedUser.data,
						currentEncryptionKey,
					);
					if (decryptedUser) {
						user = JSON.parse(decryptedUser) as UserMessageData;
					}
				} else {
					user = {
						displayName: payload.uuid,
						pfpUrl: "",
						bio: "",
						status: "",
						publicNtfyShId: "",
					};
				}
			} else {
				// plaintext user data
				user = payload.message.user as UserMessageData;
			}
			if (user && user.displayName !== payload.uuid) {
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
					id: createIdFromString(networkUuid),
					networkUuid,
					displayName,
					pfpUrl,
					bio,
					status,
					publicNtfyShId,
					privateNtfyShId: String100.orThrow(""),
				});
			}

			const id = createIdFromString(currentChannelId);
			upsert("channel", {
				id,
				name: String100.orThrow(
					payload.message.channel?.name?.slice(0, 100) ?? currentChannelId,
				),
				description: String1000.orThrow(
					payload.message.channel?.description?.slice(0, 1000) ?? "",
				),
				pfpUrl: String1000.orThrow(
					payload.message.channel?.pfpUrl?.slice(0, 1000) ?? "",
				),
			});
		};

		socketClient.on(WsMessageType.MARCO_POLO, handler);
		// Handler reads fresh state via getState(), so lockdown doesn't need to be in dependencies
	}, [socketClient, uuid, channel, setRoom, setEncryptionKey, upsert]);

	return null;
};

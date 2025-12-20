import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useZustand } from "../hooks/use-zustand";
import { createSaltedHash } from "../lib/salted-hashing";
import { DoorbellType, TypedWsClient, WsMessageType } from "../lib/sockets";

const SocketContext = createContext<TypedWsClient | null | undefined>(
	undefined,
);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
	const { channel, wssServer } = useZustand();
	// Extract values to prevent effect from running when channel object reference changes
	const channelId = channel.channelId;
	const channelSalt = channel.channelSalt;
	const [socketClient, setSocketClient] = useState<TypedWsClient | null>(null);
	const previousClientRef = useRef<TypedWsClient | null>(null);
	const previousChannelIdRef = useRef<string | null>(null);
	const previousChannelSaltRef = useRef<string | undefined>(undefined);
	const connectionHashRef = useRef<string | null>(null);
	const isInitializingRef = useRef<boolean>(false);

	useEffect(() => {
		// Ensure we're in a browser environment
		if (typeof window === "undefined" || typeof document === "undefined") {
			return;
		}

		// Calculate the connection hash key (synchronously check if we already have it)
		const connectionKey = `${channelId}-${channelSalt ?? ""}-${wssServer}`;

		// STRICT guard: Only recreate socket if channelId, channelSalt, or wssServer actually changed
		// AND we don't already have a client for this exact connection key
		// AND we're not already initializing
		if (
			previousChannelIdRef.current === channelId &&
			previousChannelSaltRef.current === channelSalt &&
			previousClientRef.current !== null &&
			connectionHashRef.current === connectionKey
		) {
			// Connection already exists for this exact configuration - do nothing
			return;
		}

		// Prevent concurrent initializations
		if (isInitializingRef.current) {
			console.log(
				"[SocketProvider] Already initializing, skipping duplicate init",
			);
			return;
		}

		isInitializingRef.current = true;
		let isCancelled = false;

		const initSocket = async () => {
			// Read uuid fresh from Zustand
			const currentUuid = useZustand.getState().uuid;

			// Calculate the salted hash for the actual connection
			const connectionChannelId = await createSaltedHash(
				channelId,
				channelSalt ?? "",
			);

			if (isCancelled) return;

			// Cleanup previous client if it exists
			if (previousClientRef.current) {
				const previousUuid = useZustand.getState().uuid;
				if (previousUuid) {
					try {
						previousClientRef.current.safeSend({
							type: WsMessageType.DOORBELL,
							uuid: previousUuid,
							message: DoorbellType.CLOSE,
							channelId: previousChannelIdRef.current ?? channelId,
						});
					} catch (err) {
						console.log("Could not send bye message on channel change:", err);
					}
				}
				previousClientRef.current.destroy();
			}

			// Create new socket client
			const client = new TypedWsClient(connectionChannelId, wssServer);

			// Send "open" doorbell to the new channel
			if (currentUuid) {
				client.safeSend({
					type: WsMessageType.DOORBELL,
					uuid: currentUuid,
					message: DoorbellType.OPEN,
					channelId: channelId,
				});
			}

			setSocketClient(client);
			previousClientRef.current = client;
			previousChannelIdRef.current = channelId;
			previousChannelSaltRef.current = channelSalt;
			connectionHashRef.current = connectionKey;
			isInitializingRef.current = false;
		};

		initSocket().catch((err) => {
			console.error("[SocketProvider] Error initializing socket:", err);
			isInitializingRef.current = false;
		});

		return () => {
			isCancelled = true;
			isInitializingRef.current = false;
		};
		// Only depend on the actual primitive values, not object references
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [channelId, channelSalt, wssServer]);

	// Separate effect for unmount cleanup only
	useEffect(() => {
		return () => {
			if (previousClientRef.current) {
				const client = previousClientRef.current;
				const currentUuid = useZustand.getState().uuid;
				const lastChannelId = previousChannelIdRef.current;
				if (currentUuid && lastChannelId) {
					try {
						client.safeSend({
							type: WsMessageType.DOORBELL,
							uuid: currentUuid,
							message: DoorbellType.CLOSE,
							channelId: lastChannelId,
						});
					} catch (err) {
						// Socket might already be closed, which is fine
					}
				}
				client.destroy();
				previousClientRef.current = null;
			}
		};
	}, []); // Empty deps = only on unmount

	// Always provide the context, even if socketClient is null (for SSR or during init)
	return (
		<SocketContext.Provider value={socketClient}>
			{children}
		</SocketContext.Provider>
	);
};

export const useSocket = () => {
	const socket = useContext(SocketContext);
	if (socket === undefined) {
		throw new Error("useSocket must be used within SocketProvider");
	}
	return socket;
};

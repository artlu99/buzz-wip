import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useZustand } from "../hooks/use-zustand";
import { DoorbellType, TypedWsClient, WsMessageType } from "../lib/sockets";

const SocketContext = createContext<TypedWsClient | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
	const { channel, uuid, wssServer } = useZustand();
	const { channelId } = channel;
	// Create socket client synchronously on initial mount if in browser
	const [socketClient, setSocketClient] = useState<TypedWsClient | null>(() => {
		if (typeof window === "undefined" || typeof document === "undefined") {
			return null;
		}
		return new TypedWsClient(channelId, wssServer);
	});
	const previousClientRef = useRef<TypedWsClient | null>(null);
	const isInitialMountRef = useRef(true);
	const previouschannelIdRef = useRef(channelId);

	// Initialize previousClientRef with the initial socket client
	if (isInitialMountRef.current && socketClient) {
		previousClientRef.current = socketClient;
	}

	useEffect(() => {
		// Ensure we're in a browser environment
		if (typeof window === "undefined" || typeof document === "undefined") {
			return;
		}

		// Skip if this is the initial mount (socket already created in useState)
		if (isInitialMountRef.current) {
			isInitialMountRef.current = false;
			previouschannelIdRef.current = channelId;
			return;
		}

		// Only recreate socket if channelId actually changed
		if (previouschannelIdRef.current === channelId) {
			return;
		}

		// Send bye message to previous channel before switching
		if (previousClientRef.current && uuid) {
			try {
				previousClientRef.current.safeSend({
					type: WsMessageType.DOORBELL,
					uuid: uuid,
					message: DoorbellType.CLOSE,
					channelId: previouschannelIdRef.current,
				});
			} catch (err) {
				// Socket might already be closed, which is fine
				console.log("Could not send bye message on channel change:", err);
			}
			// Destroy the previous client
			previousClientRef.current.destroy();
		}

		// Create new socket client for the channel
		const client = new TypedWsClient(channelId, wssServer);
		setSocketClient(client);
		previousClientRef.current = client;
		previouschannelIdRef.current = channelId;

		// Cleanup: send bye message and destroy the socket client when component unmounts
		return () => {
			if (client && uuid) {
				try {
					client.safeSend({
						type: WsMessageType.DOORBELL,
						uuid: uuid,
						message: DoorbellType.CLOSE,
						channelId: channelId,
					});
				} catch (err) {
					// Socket might already be closed, which is fine
					console.log("Could not send bye message on unmount:", err);
				}
			}
			client.destroy();
		};
	}, [channelId, uuid, wssServer]);

	// Always provide the context, even if socketClient is null (for SSR)
	return (
		<SocketContext.Provider value={socketClient}>
			{children}
		</SocketContext.Provider>
	);
};

export const useSocket = () => {
	const socket = useContext(SocketContext);
	if (!socket) {
		throw new Error("useSocket must be used within SocketProvider");
	}
	return socket;
};

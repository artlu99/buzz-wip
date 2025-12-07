import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useZustand } from "../hooks/use-zustand";
import { DoorbellType, TypedWsClient, WsMessageType } from "../lib/sockets";

const SocketContext = createContext<TypedWsClient | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
	const { channelName, displayName } = useZustand();
	// Create socket client synchronously on initial mount if in browser
	const [socketClient, setSocketClient] = useState<TypedWsClient | null>(() => {
		if (typeof window === "undefined" || typeof document === "undefined") {
			return null;
		}
		return new TypedWsClient(channelName);
	});
	const previousClientRef = useRef<TypedWsClient | null>(null);
	const isInitialMountRef = useRef(true);
	const previousChannelNameRef = useRef(channelName);

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
			previousChannelNameRef.current = channelName;
			return;
		}

		// Only recreate socket if channelName actually changed
		if (previousChannelNameRef.current === channelName) {
			return;
		}

		// Send bye message to previous channel before switching
		if (previousClientRef.current && displayName) {
			try {
				previousClientRef.current.send({
					type: WsMessageType.DOORBELL,
					uuid: displayName,
					message: DoorbellType.CLOSE,
					channelName: previousChannelNameRef.current,
				});
			} catch (err) {
				// Socket might already be closed, which is fine
				console.log("Could not send bye message on channel change:", err);
			}
			// Destroy the previous client
			previousClientRef.current.destroy();
		}

		// Create new socket client for the channel
		const client = new TypedWsClient(channelName);
		setSocketClient(client);
		previousClientRef.current = client;
		previousChannelNameRef.current = channelName;

		// Cleanup: send bye message and destroy the socket client when component unmounts
		return () => {
			if (client && displayName) {
				try {
					client.send({
						type: WsMessageType.DOORBELL,
						uuid: displayName,
						message: DoorbellType.CLOSE,
						channelName: channelName,
					});
				} catch (err) {
					// Socket might already be closed, which is fine
					console.log("Could not send bye message on unmount:", err);
				}
			}
			client.destroy();
		};
	}, [channelName, displayName]);

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

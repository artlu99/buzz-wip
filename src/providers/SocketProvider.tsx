import { createContext, useContext, useMemo } from "react";
import { TypedWsClient } from "../lib/sockets";

const channelName = "buzz-543212345";

const SocketContext = createContext<TypedWsClient | null>(null);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
	// Create socket client only in browser context, after component mounts
	const socketClient = useMemo(() => {
		// Ensure we're in a browser environment
		if (typeof window === "undefined" || typeof document === "undefined") {
			return null;
		}
		return new TypedWsClient(channelName);
	}, []);

	if (!socketClient) {
		// Return children without socket if not in browser context
		return <>{children}</>;
	}

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

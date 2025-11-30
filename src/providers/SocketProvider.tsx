import { createContext, useContext } from "react";
import { TypedWsClient } from "../lib/sockets";

const channelName = "buzz-543212345";

const socketClient = new TypedWsClient(channelName);

const SocketContext = createContext(socketClient);

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <SocketContext.Provider value={socketClient}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

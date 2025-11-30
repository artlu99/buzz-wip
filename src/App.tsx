import { EvoluProvider } from "@evolu/react";
import { Suspense, useEffect } from "react";
import { Link, Route } from "wouter";
import { AuthActions } from "./components/AuthActions";
import { AvailableReactions } from "./components/AvailableReactions";
import { OwnerActions } from "./components/OwnerActions";
import { Todos } from "./components/Todos";
import { useZustand } from "./hooks/use-zustand";
import { evoluInstance } from "./lib/local-first";
import {
  DoorbellType,
  TypingIndicatorMessage,
  TypingIndicatorType,
  WsMessageType,
} from "./lib/sockets";
import { useSocket } from "./providers/SocketProvider";
import { Bubbles } from "./components/Bubbles";
import { TypingIndicators } from "./components/TypingIndicators";
import { TextEntry } from "./components/TextEntry";

/**
 * Subscribe to unexpected Evolu errors (database, network, sync issues). These
 * should not happen in normal operation, so always log them for debugging. Show
 * users a friendly error message instead of technical details.
 */
evoluInstance.subscribeError(() => {
  const error = evoluInstance.getError();
  if (!error) return;

  alert("🚨 Evolu error occurred! Check the console.");
  console.error(error);
});

function App() {
  const socketClient = useSocket();
  const { displayName } = useZustand();

  useEffect(() => {
    socketClient.send({
      type: WsMessageType.DOORBELL,
      uuid: displayName,
      text: DoorbellType.OPEN,
    });
  }, [displayName]);

  const handleTyping = () => {
    // const timestamp = new Date().toISOString();

    const message: TypingIndicatorMessage = {
      uuid: displayName,
      type: WsMessageType.STATUS,
      presence: TypingIndicatorType.TYPING,
    };
    try {
      socketClient.send(message);
    } catch (err) {
      console.error("Failed to send typing indicator", err);
    }
  };

  const handleStopTyping = () => {
    const message: TypingIndicatorMessage = {
      uuid: displayName,
      type: WsMessageType.STATUS,
      presence: TypingIndicatorType.STOP_TYPING,
    };
    try {
      socketClient.send(message);
    } catch (err) {
      console.error("Failed to send stop_typing indicator", err);
    }
  };

  return (
    <div className="">
      <Suspense fallback={<div>Initiating...</div>}>
        <div className="min-h-screen px-8 py-8">
          <div className="mx-auto max-w-md">
            <div className="mb-2 flex items-center justify-between pb-4">
              <h1 className="w-full text-center text-xl font-semibold text-gray-900">
                <Link href="/">Buzz | artlu99</Link>
              </h1>
              <p className="text-sm text-gray-500">
                <Link href="/db">{displayName}</Link>
              </p>
            </div>

            <EvoluProvider value={evoluInstance}>
              {/*
            Suspense delivers great UX (no loading flickers) and DX (no loading
            states to manage). Highly recommended with Evolu.
          */}
              <Suspense>
                <Route path="/">
                  <AvailableReactions />
                  <Bubbles />
                  <TypingIndicators />
                  <TextEntry
                    onTyping={handleTyping}
                    onStopTyping={handleStopTyping}
                  />
                </Route>
                <Route path="/db">
                  <Todos />
                  <OwnerActions />
                  <AuthActions />
                </Route>
              </Suspense>
            </EvoluProvider>
          </div>
        </div>
      </Suspense>
    </div>
  );
}

export default App;

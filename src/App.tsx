import { EvoluProvider } from "@evolu/react";
import { Suspense, useEffect } from "react";
import { Link, Route } from "wouter";
import { AuthActions } from "./components/AuthActions";
import { AvailableReactions } from "./components/AvailableReactions";
import { Bubbles } from "./components/Bubbles";
import { ClearMessagesElement } from "./components/ClearMessagesElement";
import { HelloUser } from "./components/HelloUser";
import { MessageSender } from "./components/MessageSender";
import { OwnerActions } from "./components/OwnerActions";
import { ReactionMessageHandler } from "./components/ReactionMessageHandler";
import { TextMessageHandler } from "./components/TextMessageHandler";
import { TypingIndicators } from "./components/TypingIndicators";
import { useZustand } from "./hooks/use-zustand";
import { evoluInstance } from "./lib/local-first";
import { DoorbellType, WsMessageType } from "./lib/sockets";
import { useSocket } from "./providers/SocketProvider";

function App() {
	const socketClient = useSocket();
	const { displayName, setDisplayName } = useZustand();

	useEffect(() => {
		const getAppOwner = async () => {
			const appOwner = await evoluInstance.appOwner;
			if (appOwner) {
				setDisplayName(appOwner.id.toString());
			}
		};
		getAppOwner();
	}, [setDisplayName]);

	useEffect(() => {
		socketClient.send({
			type: WsMessageType.DOORBELL,
			uuid: displayName,
			message: DoorbellType.OPEN,
		});
	}, [displayName, socketClient]);

	// Send "bye" message when browser/tab closes
	useEffect(() => {
		const handleBeforeUnload = () => {
			try {
				socketClient.send({
					type: WsMessageType.DOORBELL,
					uuid: displayName,
					message: DoorbellType.CLOSE,
				});
			} catch (err) {
				// Socket might already be closed, which is fine
				console.log("Could not send bye message:", err);
			}
		};

		// Also handle visibility change (tab switching, minimizing)
		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				try {
					socketClient.send({
						type: WsMessageType.DOORBELL,
						uuid: displayName,
						message: DoorbellType.CLOSE,
					});
				} catch (err) {
					console.log("Could not send bye message on visibility change:", err);
				}
			}
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [displayName, socketClient]);

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
							<TextMessageHandler />
							<ReactionMessageHandler />
							<Suspense>
								<Route path="/">
									<ClearMessagesElement />
									<AvailableReactions />
									<HelloUser />
									<Bubbles />
									<TypingIndicators />
									<MessageSender />
								</Route>
								<Route path="/db">
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

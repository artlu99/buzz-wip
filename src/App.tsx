import { EvoluProvider } from "@evolu/react";
import { Suspense, useEffect } from "react";
import { Link, Route } from "wouter";
import { AuthActions } from "./components/AuthActions";
import { AvailableReactions } from "./components/AvailableReactions";
import { Bubbles } from "./components/Bubbles";
import { ClearMessagesElement } from "./components/ClearMessagesElement";
import { DeleteMessageHandler } from "./components/listeners/DeleteMessageHandler";
import { HelloUser } from "./components/listeners/HelloUser";
import { MarcoPoloMessageHandler } from "./components/listeners/MarcoPoloMessageHandler";
import { ReactionMessageHandler } from "./components/listeners/ReactionMessageHandler";
import { TextMessageHandler } from "./components/listeners/TextMessageHandler";
import { TypingIndicators } from "./components/listeners/TypingIndicators";
import { MessageSender } from "./components/MessageSender";
import { MultiSelectorBlock } from "./components/MultiSelectorBlock";
import { NavBar } from "./components/NavBar";
import { OwnerActions } from "./components/OwnerActions";
import { ProfileEditor } from "./components/ProfileEditor";
import { AutoResponderToggle } from "./components/ui/AutoResponderToggle";
import { useZustand } from "./hooks/use-zustand";
import { evoluInstance } from "./lib/local-first";
import { DoorbellType, WsMessageType } from "./lib/sockets";
import PWABadge from "./PWABadge";
import { AudioProvider } from "./providers/AudioProvider";
import { useSocket } from "./providers/SocketProvider";

function App() {
	const socketClient = useSocket();
	const { channel, uuid, setRoom, setUuid } = useZustand();
	const { channelId } = channel;

	useEffect(() => {
		const getAppOwner = async () => {
			const appOwner = await evoluInstance.appOwner;
			if (appOwner) {
				setUuid(appOwner.id);
				setRoom({ [appOwner.id]: Date.now() });
			}
		};
		getAppOwner();
	}, [setRoom, setUuid]);

	useEffect(() => {
		if (!uuid) return;
		socketClient.safeSend({
			type: WsMessageType.DOORBELL,
			uuid: uuid,
			message: DoorbellType.OPEN,
			channelId: channelId,
		});

		// send a Marco message to everyone to let them know we're here
		socketClient.safeSend({
			type: WsMessageType.MARCO_POLO,
			uuid: uuid,
			message: {},
			channelId: channelId,
		});
	}, [channelId, socketClient, uuid]);

	// Send "bye" message when browser/tab closes
	useEffect(() => {
		if (!uuid) return;
		const handleBeforeUnload = () => {
			socketClient.safeSend({
				type: WsMessageType.DOORBELL,
				uuid: uuid,
				message: DoorbellType.CLOSE,
				channelId: channelId,
			});
		};

		// Also handle visibility change (tab switching, minimizing)
		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				socketClient.safeSend({
					type: WsMessageType.DOORBELL,
					uuid: uuid,
					message: DoorbellType.CLOSE,
					channelId: channelId,
				});
			}
		};

		window.addEventListener("beforeunload", handleBeforeUnload);
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [channelId, uuid, socketClient]);

	return (
		<div className="min-h-screen px-8 py-2">
			<Suspense fallback={<div>Connecting...</div>}>
				<AudioProvider>
					<NavBar />
					<div className="mx-auto max-w-md">
						<EvoluProvider value={evoluInstance}>
							{/* Header */}
							<div className="mb-2 flex items-center justify-between pb-4">
								<AutoResponderToggle />
								<h1 className="w-full text-start text-xl font-semibold text-gray-900">
									<Link href="/">
										<img
											src="/icon.svg"
											alt="Buzz"
											className="w-6 h-6 inline-block align-top mx-2"
										/>
										Buzz
									</Link>
								</h1>

								<MultiSelectorBlock />
							</div>

							{/* Message handlers */}
							<TextMessageHandler />
							<ReactionMessageHandler />
							<DeleteMessageHandler />
							<MarcoPoloMessageHandler />

							{/* routes */}
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
									<ProfileEditor />
									<OwnerActions />
									<AuthActions />
								</Route>
							</Suspense>
						</EvoluProvider>
					</div>
				</AudioProvider>
			</Suspense>
			<PWABadge />
		</div>
	);
}

export default App;

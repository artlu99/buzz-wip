import { EvoluProvider } from "@evolu/react";
import { Suspense, useEffect } from "react";
import { Link, Route, useLocation } from "wouter";
import { AuthActions } from "./components/AuthActions";
import { AvailableReactions } from "./components/AvailableReactions";
import { Bubbles } from "./components/Bubbles";
import { HelpPage } from "./components/HelpPage";
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
import { UserModals } from "./components/UserModals";
import { AudioToggle } from "./components/ui/AudioToggle";
import { LockdownToggle } from "./components/ui/LockdownToggle";
import { SaltSelector } from "./components/ui/SaltSelector";
import { SocketServerSelector } from "./components/ui/SocketServerSelector";
import { VerboseToggle } from "./components/ui/VerboseToggle";
import { useZustand } from "./hooks/use-zustand";
import { evoluInstance } from "./lib/local-first";
import { DoorbellType, WsMessageType } from "./lib/sockets";
import { AudioProvider } from "./providers/AudioProvider";
import { useSocket } from "./providers/SocketProvider";

// import PWABadge from "./PWABadge";

function App() {
	const [location] = useLocation();
	const socketClient = useSocket();
	const { channel, uuid, setRoom, setUuid } = useZustand();
	const { channelId } = channel;

	const isHomePage = location === "/";

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
		if (!uuid || !socketClient) return;

		// Note: The socketClient now handles joining the salted channel URL.
		// The Marco message still contains the plaintext channelId for app-level matching.

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
		if (!uuid || !socketClient) return;
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
		<div className="min-h-screen">
			<Suspense fallback={<div>Initializing or reconnecting...</div>}>
				<AudioProvider>
					<NavBar />
					<div className="mx-auto max-w-md px-8 py-2">
						<EvoluProvider value={evoluInstance}>
							{/* Header */}
							<div className="mb-2 flex items-center justify-between pb-4">
								<h1 className="w-full text-start text-xl font-semibold text-base-content">
									<Link href={isHomePage ? "/profile" : "/"}>
										<img
											src="/icon.svg"
											alt="Buzz"
											className="w-6 h-6 inline-block align-top mx-2 dark:invert"
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
							<Suspense fallback={<div>Connecting...</div>}>
								<Route path="/">
									<UserModals />
									<AvailableReactions />
									<HelloUser />
									<Bubbles />
									<TypingIndicators />
									<MessageSender />
								</Route>
								<Route path="/profile">
									<ProfileEditor />
								</Route>
								<Route path="/about">
									<HelpPage />
								</Route>
								<Route path="/settings">
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
										<LockdownToggle />
										<VerboseToggle />
										<AudioToggle />
										<SaltSelector />
										<SocketServerSelector />
										<div className="col-span-2">
											<OwnerActions />
										</div>
										<div className="col-span-2">
											<AuthActions />
										</div>
									</div>
								</Route>
							</Suspense>
						</EvoluProvider>
					</div>
				</AudioProvider>
			</Suspense>

			{/* <PWABadge /> */}
		</div>
	);
}

export default App;

import { EvoluProvider } from "@evolu/react";
import { Suspense, useEffect } from "react";
import { Link, Route } from "wouter";
import { AuthActions } from "./components/AuthActions";
import { AvailableReactions } from "./components/AvailableReactions";
import { Bubbles } from "./components/Bubbles";
import { ClearMessagesElement } from "./components/ClearMessagesElement";
import { DeleteMessageHandler } from "./components/DeleteMessageHandler";
import { HelloUser } from "./components/HelloUser";
import { MarcoPoloMessageHandler } from "./components/MarcoPoloMessageHandler";
import { MessageSender } from "./components/MessageSender";
import { MultiSelectorBlock } from "./components/MultiSelectorBlock";
import { NavBar } from "./components/NavBar";
import { OwnerActions } from "./components/OwnerActions";
import { ProfileEditor } from "./components/ProfileEditor";
import { ReactionMessageHandler } from "./components/ReactionMessageHandler";
import { TextMessageHandler } from "./components/TextMessageHandler";
import { TypingIndicators } from "./components/TypingIndicators";
import { useZustand } from "./hooks/use-zustand";
import { evoluInstance } from "./lib/local-first";
import { DoorbellType, WsMessageType } from "./lib/sockets";
import { useSocket } from "./providers/SocketProvider";

function App() {
	const socketClient = useSocket();
	const { channelId, encryptionKey, user, uuid, setUuid } = useZustand();

	useEffect(() => {
		const getAppOwner = async () => {
			const appOwner = await evoluInstance.appOwner;
			if (appOwner) {
				setUuid(appOwner.id);
			}
		};
		getAppOwner();
	}, [setUuid]);

	useEffect(() => {
		if (!uuid) return;
		socketClient.safeSend({
			type: WsMessageType.DOORBELL,
			uuid: uuid,
			message: DoorbellType.OPEN,
			channelId: channelId,
		});
		socketClient.safeSend({
			type: WsMessageType.MARCO_POLO,
			uuid: uuid,
			message: {
				user: user,
				channel: { id: channelId, publicUselessEncryptionKey: encryptionKey },
			},
			channelId: channelId,
		});
	}, [channelId, encryptionKey, socketClient, uuid, user]);

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
		<div className="">
			<NavBar />
			<Suspense fallback={<div>Initiating...</div>}>
				<div className="min-h-screen px-8 py-8">
					<div className="mx-auto max-w-md">
						<div className="mb-2 flex items-center justify-between pb-4">
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
							<EvoluProvider value={evoluInstance}>
								<MultiSelectorBlock />
							</EvoluProvider>
						</div>

						<EvoluProvider value={evoluInstance}>
							<TextMessageHandler />
							<ReactionMessageHandler />
							<DeleteMessageHandler />
							<MarcoPoloMessageHandler />
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
				</div>
			</Suspense>
		</div>
	);
}

export default App;

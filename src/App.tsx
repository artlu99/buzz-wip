import { NonEmptyString100 } from "@evolu/common";
import { EvoluProvider } from "@evolu/react";
import { debounce } from "radash";
import { Suspense, useEffect } from "react";
import { Link, Route } from "wouter";
import { AuthActions } from "./components/AuthActions";
import { AvailableReactions } from "./components/AvailableReactions";
import { Bubbles } from "./components/Bubbles";
import { ClearMessagesElement } from "./components/ClearMessagesElement";
import { DeleteMessageHandler } from "./components/DeleteMessageHandler";
import { HelloUser } from "./components/HelloUser";
import { MessageSender } from "./components/MessageSender";
import { NavBar } from "./components/NavBar";
import { OwnerActions } from "./components/OwnerActions";
import { ProfileEditor } from "./components/ProfileEditor";
import { ReactionMessageHandler } from "./components/ReactionMessageHandler";
import { RefreshMessageHandler } from "./components/RefreshMessageHandler";
import { TextMessageHandler } from "./components/TextMessageHandler";
import { TypingIndicators } from "./components/TypingIndicators";
import { useZustand } from "./hooks/use-zustand";
import { evoluInstance } from "./lib/local-first";
import { DoorbellType, WsMessageType } from "./lib/sockets";
import { useSocket } from "./providers/SocketProvider";

function App() {
	const socketClient = useSocket();
	const { channelName, user, uuid, setChannelName, setUuid } = useZustand();

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
		socketClient.send({
			type: WsMessageType.DOORBELL,
			uuid: uuid,
			message: DoorbellType.OPEN,
			channelName: channelName,
		});
	}, [channelName, uuid, socketClient]);

	// Send "bye" message when browser/tab closes
	useEffect(() => {
		if (!uuid) return;
		const handleBeforeUnload = () => {
			try {
				socketClient.send({
					type: WsMessageType.DOORBELL,
					uuid: uuid,
					message: DoorbellType.CLOSE,
					channelName: channelName,
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
						uuid: uuid,
						message: DoorbellType.CLOSE,
						channelName: channelName,
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
	}, [channelName, uuid, socketClient]);

	const handleChannelChange = debounce(
		{ delay: 500 },
		(channelName: string) => {
			if (channelName.length === 0) return;
			setChannelName(NonEmptyString100.orThrow(channelName.slice(0, 100)));
		},
	);

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
							<div className="flex flex-col items-center gap-2">
								<p className="text-sm text-gray-500">
									<input
										className="input input-ghost"
										type="text"
										value={channelName}
										onChange={(e) => handleChannelChange(e.target.value)}
									/>
								</p>
								<p className="text-sm text-gray-500">
									<Link href="/db">{user?.displayName}</Link>
								</p>
							</div>
						</div>

						<EvoluProvider value={evoluInstance}>
							<TextMessageHandler />
							<ReactionMessageHandler />
							<DeleteMessageHandler />
							<RefreshMessageHandler />
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

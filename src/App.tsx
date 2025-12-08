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

const DISALLOW_ENCRYPTION = true;

function App() {
	const socketClient = useSocket();
	const {
		channelId,
		encrypted,
		user,
		uuid,
		setChannelId,
		setUuid,
		toggleEncryption,
	} = useZustand();

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
			channelId: channelId,
		});
	}, [channelId, uuid, socketClient]);

	// Send "bye" message when browser/tab closes
	useEffect(() => {
		if (!uuid) return;
		const handleBeforeUnload = () => {
			try {
				socketClient.send({
					type: WsMessageType.DOORBELL,
					uuid: uuid,
					message: DoorbellType.CLOSE,
					channelId: channelId,
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
						channelId: channelId,
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
	}, [channelId, uuid, socketClient]);

	const handleChannelChange = debounce(
		{ delay: 500 },
		(channelId: string) => {
			if (channelId.length === 0) return;
			setChannelId(NonEmptyString100.orThrow(channelId.slice(0, 100)));
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
								<div className="flex flex-row items-center">
									<div className="flex flex-col gap-1">
										<label
											htmlFor="channel-name"
											className="text-base-content text-sm"
										>
											<i className="ph-bold ph-hash mr-1" />
											Channel Name
										</label>
										<div className="relative">
											<button
												type="button"
												className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
												onClick={toggleEncryption}
												disabled={DISALLOW_ENCRYPTION || !uuid}
											>
												<i
													className={`ph-bold ${encrypted ? "ph-shield-slash" : "ph-shield"} text-gray-500`}
												/>
											</button>
											<input
												id="channel-name"
												className="input input-ghost pr-10"
												type="text"
												value={channelId}
												onChange={(e) => handleChannelChange(e.target.value)}
											/>
										</div>
									</div>
								</div>
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

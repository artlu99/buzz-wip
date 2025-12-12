import { useEffect } from "react";
import { Link } from "wouter";
import { useZustand } from "../hooks/use-zustand";

export const HelpPage = () => {
	const { channel } = useZustand();
	const { channelId, encrypted, encryptionKey } = channel;

	// Scroll to anchor on mount if hash is present
	useEffect(() => {
		const hash = window.location.hash;
		if (hash) {
			const element = document.querySelector(hash);
			if (element) {
				setTimeout(() => {
					element.scrollIntoView({ behavior: "smooth", block: "start" });
				}, 100);
			}
		}
	}, []);

	return (
		<div className="prose prose-sm max-w-none py-4">
			<div className="mb-6">
				<p className="text-base-content/70">
					Buzz is <strong>an ephemeral messaging app</strong> for public and
					private messages that never touch a central server. Your information
					stays local and private, while becoming local and private to others
					who see it.
				</p>
			</div>

			<div className="space-y-6">
				<section>
					<h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
						<i className="ph-bold ph-question"></i>
						Tips & Tricks
					</h2>
					<div className="space-y-2 text-base-content/80">
						<ul className="list-disc list-inside space-y-1 ml-4">
							<li>Use the same room ID with friends to create group chats</li>
							<li>
								Protect sensitive conversations by sharing an encryption key
							</li>
							<li>
								Your profile picture and bio help others identify you in
								conversations. No technical proof yet (
								<span className="text-xs uppercase">coming soon</span>)
							</li>
							<li>Sync messages across devices by sharing a mnemonic</li>
						</ul>
					</div>
				</section>

				<section>
					<h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
						<i className="ph-bold ph-chat-circle" />
						Getting Started
					</h2>
					<div className="space-y-2 text-base-content/80">
						<p>
							Buzz organizes conversations into <strong>Rooms</strong>. You are
							in the "{channelId}" room. Switch rooms by typing a name at the
							top of the app.
						</p>
						<p>
							<strong>Your Appearance:</strong> You are assigned a unique
							identifier + mnemonic, stored on your device. You can customize
							your appearance (name, bio, profile picture) in the{" "}
							<Link to="/db" className="link link-primary">
								Profile
							</Link>{" "}
							section. This gets broadcast to everyone.
						</p>
					</div>
				</section>

				<section>
					<h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
						<i className="ph-bold ph-cloud-slash" />
						Hidden Conversations
					</h2>
					<div className="space-y-2 text-base-content/80">
						<p>
							When you choose to be hidden, your messages are encrypted with a
							shared key.
						</p>
						<p>
							<strong>How it works:</strong> New messages you send in this room
							are currently <strong>{encrypted ? "private" : "public"}</strong>.
							You can toggle this by{" "}
							{encryptionKey ? "" : "creating a shared key and"} clicking on the{" "}
							<em>{encrypted ? "cloud" : "megaphone"}</em> icon.
						</p>
						<p>
							Buzz securely generates an ephemeral key, and by default{" "}
							<strong>shares it with everyone in the room</strong>. Message
							contents are encrypted for transport, and decrypted using this
							shared key.
						</p>
						<p>
							<em>
								<strong>
									Each user stores messages in plaintext on their local device.
								</strong>
							</em>
						</p>
						<p>
							The encryption is fragile by design, as{" "}
							<em>messages belong to everyone who has seen them</em>. Keys are
							meant to be disposable, and convenient to rotate (1 click and it's
							ready to use!). The only requirement is that someone happens to be
							listening in real time.
						</p>
					</div>
				</section>

				<section>
					<h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
						<i className="ph-bold ph-robot"></i>
						Auto Responder
					</h2>
					<div className="space-y-2 text-base-content/80">
						<p>
							The Auto Responder feature uses a "Marco Polo" mechanism to
							automatically share recent messages with new joiners in a room.
						</p>
						<p>
							<strong>How it works:</strong> When enabled, Buzz automatically
							responds to "Marco" messages by sending the last 500 messages and
							reactions in the room. This helps new joiners and re-joiners to
							catch up on conversations.
						</p>
						<p>
							<em>
								It can be useful to run an Auto Responder in an always-online
								desktop browser, synced to a mobile device as the same user.
							</em>
						</p>
						<p>Toggle the Auto Responder on/off using the navigation bar.</p>
					</div>
				</section>

				<section id="buzzing-people">
					<h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
						<i className="ph-bold ph-bell"></i>
						Buzzing People
					</h2>
					<div className="space-y-2 text-base-content/80">
						<p>
							You can notify other users even when they're not actively in a
							room by using the <strong>public notification channel</strong>{" "}
							feature.
						</p>
						<p>
							<strong>Setting up your notification channel:</strong> Go to your{" "}
							<Link to="/db" className="link link-primary">
								Profile
							</Link>{" "}
							and enter your public notification channel ID in the "Notification
							Channels" field. This uses the{" "}
							<a
								href="https://ntfy.sh"
								target="_blank"
								rel="noopener noreferrer"
								className="link link-primary"
							>
								ntfy.sh
							</a>{" "}
							service to send push notifications to your devices.
						</p>
						<p>
							<strong>How to buzz someone:</strong> Open the{" "}
							<strong>Room Users</strong> modal (click the "Room Users" button
							on the main page). If a user has set up their public notification
							channel, you'll see a bell icon (🔔) next to their name. Click it
							to send them a notification that will appear on their devices,
							even if they're not currently viewing the room.
						</p>
						<p>
							<em>
								This is useful for getting someone's attention or alerting them
								that there's activity in a room they might want to check out.
							</em>
						</p>
					</div>
				</section>

				<section>
					<h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
						<i className="ph-bold ph-database"></i>
						Local-First Architecture
					</h2>
					<div className="space-y-2 text-base-content/80">
						<p>
							Buzz is built with a local-first approach. All your messages,
							reactions, and user data are stored locally on your device. This
							means:
						</p>
						<ul className="list-disc list-inside space-y-1 ml-4">
							<li>
								Data leaves your device when you send or react to a message
							</li>
							<li>You can access your chat history offline</li>
							<li>No central server can read or store your messages</li>
							<li>You can synchronize your data with other devices</li>
						</ul>
					</div>
				</section>

				<section>
					<h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
						<i className="ph-bold ph-warning"></i>
						Technical Considerations
					</h2>
					<div className="space-y-2 text-base-content/80">
						<p>
							We use secure websockets (wss) on the public{" "}
							<a
								href="https://ittysockets.com/"
								target="_blank"
								rel="noopener noreferrer"
								className="link link-primary"
							>
								itty.ws
							</a>{" "}
							server. This should be considered more untrustworthy than
							Telegram, WhatsApp, or X.
						</p>
						<p>
							Users who need more privacy must{" "}
							<Link to="/settings" className="link link-primary">
								turn off shared secret broadcasting
							</Link>{" "}
							("Lockdown Mode"), and exchange secrets via separate channels.
							This{" "}
							<a
								href="https://dele.to/alternatives"
								target="_blank"
								rel="noopener noreferrer"
								className="link link-primary"
							>
								page
							</a>{" "}
							lists some interesting methods.
						</p>

						<p>
							Presently, users who already know each other should be able to
							communicate using Buzz, even if transport is adversarial. In the
							near future, Buzz will enable self-verifying containers for
							strangers to communicate securely.
						</p>
					</div>
				</section>

				<section>
					<h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
						<i className="ph-bold ph-code"></i>
						Open Source
					</h2>
					<div className="space-y-2 text-base-content/80">
						<p>
							<strong>Buzz</strong> is open source and available on{" "}
							<a
								href="https://github.com/artlu99/buzz-wip"
								target="_blank"
								rel="noopener noreferrer"
								className="link link-primary"
							>
								GitHub
							</a>
							. Contributions and feedback welcome!
						</p>
					</div>
				</section>

				<div className="pt-4 border-t">
					<Link to="/" className="btn btn-primary">
						Back to Chat
					</Link>
				</div>
			</div>
		</div>
	);
};

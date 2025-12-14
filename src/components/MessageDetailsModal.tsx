import { NonEmptyString100, OwnerId } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { EvoluIdenticon } from "@evolu/react-web";
import { fetcher } from "itty-fetcher";
import { useMemo } from "react";
import toast from "react-hot-toast";
import { useZustand } from "../hooks/use-zustand";
import { chosenIdenticonStyle } from "../lib/helpers";
import {
	messagesForChannelQuery,
	reactionsForNetworkMessageIdQuery,
	userQuery,
} from "../lib/local-first";
import {
	type ReactionType,
	reactionTypeData,
	reactionTypeToEnum,
} from "../lib/reactions";
import { UserMessageDataSchema } from "../lib/sockets";

const api = fetcher({ base: "https://ntfy.sh" });

interface MessageDetailsModalProps {
	isOpen: boolean;
	onClose: () => void;
	messageId?: string; // networkMessageId
}

// Helper component to query a single user
const UserQuery = ({
	uuid,
	children,
}: {
	uuid: string;
	children: (
		user: {
			uuid: string;
			displayName: string;
			pfpUrl?: string;
			bio?: string;
			status?: string;
			publicNtfyShId?: string;
		} | null,
	) => React.ReactNode;
}) => {
	const user = useQuery(
		userQuery(NonEmptyString100.orThrow(uuid.slice(0, 100))),
	);
	const userData = user?.[0];
	return (
		<>
			{children(
				userData
					? {
							uuid: userData.id,
							displayName: userData.displayName ?? uuid,
							pfpUrl: userData.pfpUrl,
							bio: userData.bio,
							status: userData.status,
							publicNtfyShId: userData.publicNtfyShId,
						}
					: null,
			)}
		</>
	);
};

export const MessageDetailsModal = ({
	isOpen,
	onClose,
	messageId,
}: MessageDetailsModalProps) => {
	const { channel, user, uuid } = useZustand();
	const { channelId } = channel;

	// Get all messages to find the specific message
	const messages = useQuery(messagesForChannelQuery(channelId));

	// Find the message by networkMessageId
	const message = useMemo(() => {
		if (!messageId || !messages) return null;
		return messages.find((m) => m.networkMessageId === messageId);
	}, [messageId, messages]);

	// Get reactions for this message
	// Use placeholder if messageId is not available (query will return empty results)
	const reactions = useQuery(
		reactionsForNetworkMessageIdQuery(
			NonEmptyString100.orThrow((messageId ?? "uninitialized").slice(0, 100)),
		),
	);

	// Group reactions by type
	const reactionsByType = useMemo(() => {
		if (!reactions) return new Map<ReactionType, string[]>();

		const grouped = new Map<ReactionType, string[]>();

		reactions.forEach((reaction) => {
			if (!reaction.createdBy) return;
			const reactionType = reactionTypeToEnum(reaction.reaction);
			const existing = grouped.get(reactionType) ?? [];
			if (!existing.includes(reaction.createdBy)) {
				grouped.set(reactionType, [...existing, reaction.createdBy]);
			}
		});

		return grouped;
	}, [reactions]);

	// Parse message sender data
	const senderData = useMemo(() => {
		if (!message || !message.createdBy) return null;

		let displayName: string = message.createdBy;
		let pfpUrl: string | undefined;
		let bio: string | undefined;
		let status: string | undefined;
		let publicNtfyShId: string | undefined;
		if (message.user) {
			try {
				const userData = UserMessageDataSchema.parse(JSON.parse(message.user));
				displayName = userData.displayName ?? message.createdBy;
				pfpUrl = userData.pfpUrl;
				bio = userData.bio;
				status = userData.status;
				publicNtfyShId = userData.publicNtfyShId;
			} catch {
				// Invalid user data, use defaults
			}
		}

		return {
			uuid: message.createdBy,
			displayName,
			pfpUrl,
			bio,
			status,
			publicNtfyShId,
		};
	}, [message]);

	if (!isOpen || !messageId || !message) return null;

	const ownerId = message.createdBy ? OwnerId.orThrow(message.createdBy) : null;

	const doBuzz = (publicNtfyShId: string) => {
		return (
			<button
				type="button"
				className="btn btn-ghost btn-circle"
				onClick={() => {
					api.post(`/${publicNtfyShId}`, {
						message: `Buzz from ${user.displayName}`,
					});
					toast.success(`You have Buzz'd ${user.displayName}!`);
				}}
			>
				<i className="ph-bold ph-bell" />
			</button>
		);
	};

	return (
		<dialog
			className="modal modal-open"
			onClick={onClose}
			onKeyDown={(e) => e.stopPropagation()}
		>
			<article
				className="modal-box max-w-md"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<h3 className="text-lg font-bold mb-4">Message Details</h3>

				{/* Message Content */}
				<div className="mb-6 p-4 rounded-lg bg-base-200">
					<p className="text-base-content">{message.content}</p>
				</div>

				{/* Sender */}
				<div className="mb-6">
					<h4 className="text-sm font-semibold text-base-content/80 mb-3">
						Sent by
					</h4>
					{ownerId && senderData && (
						<UserQuery uuid={senderData.uuid}>
							{(userData) => {
								const displayName =
									userData?.displayName && userData.displayName !== "<none>"
										? userData.displayName
										: senderData.displayName;
								const pfpUrl =
									userData?.pfpUrl && userData.pfpUrl !== "<none>"
										? userData.pfpUrl
										: senderData.pfpUrl;
								const bio =
									userData?.bio && userData.bio !== "<none>"
										? userData.bio
										: senderData.bio;
								const status =
									userData?.status && userData.status !== "<none>"
										? userData.status
										: senderData.status;
								const publicNtfyShId =
									userData?.publicNtfyShId &&
									userData.publicNtfyShId !== "<none>"
										? userData.publicNtfyShId
										: senderData.publicNtfyShId;

								return (
									<div className="flex items-center gap-3 p-3 rounded-lg bg-base-200">
										<div className="flex-shrink-0">
											{pfpUrl ? (
												<img
													src={pfpUrl}
													alt={displayName}
													className="w-12 h-12 rounded-full object-cover ring-2 ring-base-300"
												/>
											) : (
												<EvoluIdenticon
													id={ownerId}
													size={48}
													style={chosenIdenticonStyle}
												/>
											)}
										</div>
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<span className="font-medium text-base-content truncate">
													{displayName}
												</span>
												{senderData.uuid === uuid && (
													<span className="badge badge-primary badge-sm">
														You
													</span>
												)}
											</div>
											{bio && (
												<p className="text-sm text-base-content/70 truncate">
													{bio}
												</p>
											)}
											{status && status !== "<none>" && (
												<p className="text-sm text-base-content/70 truncate">
													{status}
												</p>
											)}
											{publicNtfyShId && publicNtfyShId !== "<none>" && (
												<p className="text-sm text-base-content/70 truncate">
													Buzz me: {doBuzz(publicNtfyShId)}
												</p>
											)}
										</div>
									</div>
								);
							}}
						</UserQuery>
					)}
				</div>

				{/* Reactions by Type */}
				<div className="mb-4">
					<h4 className="text-sm font-semibold text-base-content/80 mb-3">
						Reactions
					</h4>
					{reactionsByType.size === 0 ? (
						<p className="text-base-content/70 text-center py-4">
							No reactions yet
						</p>
					) : (
						<div className="space-y-4">
							{Array.from(reactionsByType.entries()).map(
								([reactionType, userIds]) => {
									const iconData = reactionTypeData(reactionType);
									return (
										<div key={reactionType} className="space-y-2">
											<div className="flex items-center gap-2">
												<i
													className={`${iconData.filledIcon} ${iconData.color} text-xl`}
												/>
												<span className="font-medium text-base-content">
													{iconData.label}
												</span>
												<span className="text-xs text-base-content/70">
													({userIds.length})
												</span>
											</div>
											<div className="space-y-1 pl-8">
												{userIds.map((userId) => {
													const userOwnerId = OwnerId.orThrow(userId);
													return (
														<UserQuery key={userId} uuid={userId}>
															{(userData) => {
																const displayName =
																	userData?.displayName &&
																	userData.displayName !== "<none>"
																		? userData.displayName
																		: userId;
																const pfpUrl =
																	userData?.pfpUrl &&
																	userData.pfpUrl !== "<none>"
																		? userData.pfpUrl
																		: undefined;
																const bio =
																	userData?.bio && userData.bio !== "<none>"
																		? userData.bio
																		: undefined;
																const status =
																	userData?.status &&
																	userData.status !== "<none>"
																		? userData.status
																		: undefined;
																const publicNtfyShId =
																	userData?.publicNtfyShId &&
																	userData.publicNtfyShId !== "<none>"
																		? userData.publicNtfyShId
																		: undefined;

																return (
																	<div className="flex items-center gap-2 p-2 rounded hover:bg-base-200 transition-colors">
																		<div className="flex-shrink-0">
																			{pfpUrl ? (
																				<img
																					src={pfpUrl}
																					alt={displayName}
																					className="w-8 h-8 rounded-full object-cover"
																				/>
																			) : (
																				<EvoluIdenticon
																					id={userOwnerId}
																					size={32}
																					style={chosenIdenticonStyle}
																				/>
																			)}
																		</div>
																		<div className="flex-1 min-w-0">
																			<div className="flex items-center gap-2">
																				<span className="text-sm font-medium text-base-content truncate">
																					{displayName}
																				</span>
																				{userId === uuid && (
																					<span className="badge badge-primary badge-xs">
																						You
																					</span>
																				)}
																			</div>
																			{bio && (
																				<p className="text-xs text-base-content/70 truncate">
																					{bio}
																				</p>
																			)}
																			{status && status !== "<none>" && (
																				<p className="text-sm text-base-content/70 truncate">
																					{status}
																				</p>
																			)}
																			{publicNtfyShId &&
																				publicNtfyShId !== "<none>" && (
																					<p className="text-sm text-base-content/70 truncate">
																						Buzz me: {doBuzz(publicNtfyShId)}
																					</p>
																				)}
																		</div>
																	</div>
																);
															}}
														</UserQuery>
													);
												})}
											</div>
										</div>
									);
								},
							)}
						</div>
					)}
				</div>

				<div className="modal-action">
					<button type="button" className="btn" onClick={onClose}>
						Close
					</button>
				</div>
			</article>
			<form
				method="dialog"
				className="modal-backdrop"
				onClick={onClose}
				onKeyDown={(e) => e.stopPropagation()}
			>
				<button type="button">close</button>
			</form>
		</dialog>
	);
};

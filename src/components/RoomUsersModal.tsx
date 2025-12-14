import { NonEmptyString100, OwnerId } from "@evolu/common";
import { useQuery } from "@evolu/react";
import { EvoluIdenticon } from "@evolu/react-web";
import { fetcher } from "itty-fetcher";
import { useMemo } from "react";
import { toast } from "react-hot-toast";
import { useZustand } from "../hooks/use-zustand";
import { chosenIdenticonStyle } from "../lib/helpers";
import { userQuery } from "../lib/local-first";

const api = fetcher({ base: "https://ntfy.sh" });

interface RoomUsersModalProps {
	isOpen: boolean;
	onClose: () => void;
}

// Helper component to query a single user
const UserQuery = ({
	uuid,
	children,
}: {
	uuid: string;
	children: (
		user: {
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

export const RoomUsersModal = ({ isOpen, onClose }: RoomUsersModalProps) => {
	const { uuid, user } = useZustand();

	// Get active room users (filter out stale entries)
	const activeRoom = useZustand.getState().getActiveRoom(600000); // 10 minutes
	const roomUuids = Object.keys(activeRoom);

	// Combine user data with room timestamps
	const usersWithData = useMemo(() => {
		return roomUuids
			.map((roomUuid) => {
				const timestamp = activeRoom[roomUuid];
				return {
					uuid: roomUuid,
					timestamp,
					isMe: roomUuid === uuid,
				};
			})
			.sort((a, b) => {
				// Sort: self first, then by timestamp (most recent first)
				if (a.isMe) return -1;
				if (b.isMe) return 1;
				return b.timestamp - a.timestamp;
			});
	}, [roomUuids, activeRoom, uuid]);

	if (!isOpen) return null;

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
				<h3 className="text-lg font-bold mb-4">
					Users in Room ({usersWithData.length})
				</h3>
				<div className="space-y-2 max-h-96 overflow-y-auto">
					{usersWithData.length === 0 ? (
						<p className="text-base-content/70 text-center py-8">
							No users currently in the room
						</p>
					) : (
						usersWithData.map((user) => {
							const ownerId = OwnerId.orThrow(user.uuid);
							return (
								<UserQuery key={user.uuid} uuid={user.uuid}>
									{(userData) => {
										const displayName = userData?.displayName ?? user.uuid;
										const pfpUrl = userData?.pfpUrl;
										const bio = userData?.bio;
										const status = userData?.status;
										const publicNtfyShId = userData?.publicNtfyShId;
										return (
											<div className="flex items-center gap-3 p-3 rounded-lg hover:bg-base-200 transition-colors">
												<div className="flex-shrink-0">
													{pfpUrl && pfpUrl !== "<none>" ? (
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
														{user.isMe && (
															<span className="badge badge-primary badge-sm">
																You
															</span>
														)}
													</div>
													{bio && bio !== "<none>" && (
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
							);
						})
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

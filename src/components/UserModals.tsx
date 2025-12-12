import { useState } from "react";
import { RoomUsersModal } from "./RoomUsersModal";

export const UserModals = () => {
	const [isRoomUsersOpen, setIsRoomUsersOpen] = useState(false);

	return (
		<>
			<div className="flex gap-2 mb-4">
				<button
					type="button"
					className="btn btn-outline btn-sm flex-1"
					onClick={() => setIsRoomUsersOpen(true)}
				>
					<i className="ph-bold ph-users"></i>
					Room Users
				</button>
			</div>
			<RoomUsersModal
				isOpen={isRoomUsersOpen}
				onClose={() => setIsRoomUsersOpen(false)}
			/>
		</>
	);
};

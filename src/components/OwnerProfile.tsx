import type { OwnerId } from "@evolu/common";
import { EvoluIdenticon } from "@evolu/react-web";
import type { FC } from "react";
import { chosenIdenticonStyle } from "../lib/helpers";

export const OwnerProfile: FC<{
	ownerId: OwnerId;
	username: string;
	handleLoginClick?: (ownerId: OwnerId) => void;
}> = ({ ownerId, username, handleLoginClick }) => {
	return (
		<div className="flex justify-between gap-3">
			<div className="flex items-center gap-3">
				<EvoluIdenticon id={ownerId} size={24} style={chosenIdenticonStyle} />
				<span className="text-sm font-medium text-base-content">
					{username}
				</span>
				<span className="text-xs text-base-content/50 italic">{ownerId}</span>
			</div>
			{handleLoginClick && (
				<button
					type="button"
					className="btn btn-primary w-full"
					onClick={() => handleLoginClick(ownerId)}
				>
					Login
				</button>
			)}
		</div>
	);
};

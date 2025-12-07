import { availableReactions, reactionTypeData } from "../lib/reactions";

export const AvailableReactions = () => {
	return availableReactions.map((reaction) => (
		<button
			key={reaction}
			type="button"
			className={`btn btn-xs btn-circle btn-ghost text-lg ${reactionTypeData(reaction).color}`}
			disabled={true}
		>
			<i className={reactionTypeData(reaction).icon} />
		</button>
	));
};

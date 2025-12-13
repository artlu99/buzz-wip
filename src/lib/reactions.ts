import type { NonEmptyString100 } from "@evolu/common";

export enum ReactionType {
	CUBE = "cube",
	LIKE = "like",
	LOL = "haha",
	READ_RECEIPT = "read_receipt",
	CUSTOM = "custom",
}

export const availableReactions = Object.values(ReactionType).slice(0, 4);

export const reactionTypeToEnum = (
	reaction: NonEmptyString100,
): ReactionType => {
	switch (reaction) {
		case ReactionType.CUBE:
			return ReactionType.CUBE;
		case ReactionType.LIKE:
			return ReactionType.LIKE;
		case ReactionType.LOL:
			return ReactionType.LOL;
		case ReactionType.READ_RECEIPT:
			return ReactionType.READ_RECEIPT;
		case ReactionType.CUSTOM:
			return ReactionType.CUSTOM;
		default:
			throw new Error(`Invalid reaction type: ${reaction}`);
	}
};

const reactionTypeToIcon: Record<ReactionType, string> = {
	[ReactionType.CUBE]: "ph-bold ph-cube",
	[ReactionType.LIKE]: "ph-bold ph-heart",
	[ReactionType.LOL]: "ph-bold ph-smiley",
	[ReactionType.READ_RECEIPT]: "ph-bold ph-check",
	[ReactionType.CUSTOM]: "ph-bold ph-gear",
};

const reactionTypeToFilledIcon: Record<ReactionType, string> = {
	[ReactionType.CUBE]: "ph-fill ph-cube",
	[ReactionType.LIKE]: "ph-fill ph-heart",
	[ReactionType.LOL]: "ph-fill ph-smiley",
	[ReactionType.READ_RECEIPT]: "ph-bold ph-check-circle",
	[ReactionType.CUSTOM]: "ph-fill ph-gear",
};

const reactionTypeToLabel: Record<ReactionType, string> = {
	[ReactionType.CUBE]: "Cube",
	[ReactionType.LIKE]: "Like",
	[ReactionType.LOL]: "Haha",
	[ReactionType.READ_RECEIPT]: "Read Receipt",
	[ReactionType.CUSTOM]: "Custom",
};

const reactionTypeToColor: Record<ReactionType, string> = {
	[ReactionType.CUBE]: "text-info",
	[ReactionType.LIKE]: "text-error",
	[ReactionType.LOL]: "text-warning",
	[ReactionType.READ_RECEIPT]: "text-success",
	[ReactionType.CUSTOM]: "text-base-content/30",
};

export const reactionTypeData = (
	reaction: ReactionType,
): { icon: string; filledIcon: string; label: string; color: string } => {
	return {
		icon: reactionTypeToIcon[reaction],
		filledIcon: reactionTypeToFilledIcon[reaction],
		label: reactionTypeToLabel[reaction],
		color: reactionTypeToColor[reaction],
	};
};

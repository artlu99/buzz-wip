import type { kysely, NonEmptyString100 } from "@evolu/common";
import { evoluInstance } from "../local-first";

// limit for autoresponder catch-up messages
// Target: 500 messages for good catch-up while maintaining performance
export const AUTORESPONDER_MESSAGE_LIMIT = 500;

/**
 * Query builder for last N TEXT messages in a channel (including deleted).
 * Messages are ordered by updatedAt DESC to capture most recent state changes.
 * This is read-only - does not modify the database.
 */
export const lastNTextMessagesQuery = (
	channelId: NonEmptyString100,
	limit: number = AUTORESPONDER_MESSAGE_LIMIT,
) =>
	evoluInstance.createQuery((db) =>
		db
			.selectFrom("message")
			.select([
				"id",
				"content",
				"user",
				"channelId",
				"createdBy",
				"createdAt",
				"updatedAt",
				"networkMessageId",
				"networkTimestamp",
				"isDeleted",
			])
			.where("channelId", "is", channelId)
			// Include deleted messages - they represent diffs
			.$narrowType<{
				content: kysely.NotNull;
				channelId: kysely.NotNull;
				networkMessageId: kysely.NotNull;
			}>()
			.orderBy("updatedAt", "desc")
			.limit(limit),
	);
export type LastNTextMessagesRow = ReturnType<
	typeof lastNTextMessagesQuery
>["Row"];

/**
 * Query builder for last N REACTION messages in a channel (including deleted).
 * Reactions are ordered by updatedAt DESC to capture most recent state changes.
 * This is read-only - does not modify the database.
 */
export const lastNReactionsQuery = (
	channelId: NonEmptyString100,
	limit: number = AUTORESPONDER_MESSAGE_LIMIT,
) =>
	evoluInstance.createQuery((db) =>
		db
			.selectFrom("reaction")
			.select([
				"id",
				"reaction",
				"channelId",
				"createdBy",
				"updatedAt",
				"isDeleted",
				"messageId",
				"networkTimestamp",
			])
			.where("channelId", "is", channelId)
			// Include deleted reactions - they represent diffs
			.$narrowType<{ reaction: kysely.NotNull }>()
			.orderBy("updatedAt", "desc")
			.limit(limit),
	);
export type LastNReactionsRow = ReturnType<typeof lastNReactionsQuery>["Row"];

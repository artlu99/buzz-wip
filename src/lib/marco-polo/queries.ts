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
 * This includes a join with the message table to get networkMessageId.
 * Only includes reactions where the message has a networkMessageId.
 * This is read-only - does not modify the database.
 */
export const lastNReactionsQuery = (
	channelId: NonEmptyString100,
	limit: number = AUTORESPONDER_MESSAGE_LIMIT,
) =>
	evoluInstance.createQuery((db) =>
		db
			.selectFrom("reaction")
			.innerJoin("message", "message.id", "reaction.messageId")
			.select([
				"reaction.id",
				"reaction.reaction",
				"reaction.channelId",
				"reaction.createdBy",
				"reaction.updatedAt",
				"reaction.isDeleted",
				"reaction.messageId",
				"reaction.networkTimestamp",
				"message.networkMessageId",
			])
			.where("reaction.channelId", "is", channelId)
			.where("message.networkMessageId", "is not", null)
			// Include deleted reactions - they represent diffs
			.$narrowType<{ reaction: kysely.NotNull; networkMessageId: kysely.NotNull }>()
			.orderBy("reaction.updatedAt", "desc")
			.limit(limit),
	);
export type LastNReactionsRow = ReturnType<typeof lastNReactionsQuery>["Row"];

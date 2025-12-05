import {
	createEvolu,
	id,
	type kysely,
	NonEmptyString100,
	nullOr,
	OwnerId,
	SimpleName,
	SqliteBoolean,
	sqliteTrue,
} from "@evolu/common";
import { createUseEvolu } from "@evolu/react";
import { evoluReactWebDeps, localAuth } from "@evolu/react-web";

const TodoId = id("Todo");
export const MessageId = id("Message");

export const Schema = {
	todo: {
		id: TodoId,
		title: NonEmptyString100,
		isCompleted: nullOr(SqliteBoolean),
	},
	message: {
		id: MessageId,
		content: NonEmptyString100,
		createdBy: OwnerId,
	},
};

// Namespace for the current app (scopes databases, passkeys, etc.)
export const service = "pwa-react-151125";

// N.B.: this is a top-level await
const authResult = await localAuth.getOwner({ service });

// Create Evolu instance for the React web platform.
export const evoluInstance = createEvolu(evoluReactWebDeps)(Schema, {
	name: SimpleName.orThrow(`${service}-${authResult?.owner?.id ?? "guest"}`),
	encryptionKey: authResult?.owner?.encryptionKey,
	externalAppOwner: authResult?.owner,

	transports: [
		{ type: "WebSocket", url: "wss://evolu-relay-1.artlu.xyz" },
		{ type: "WebSocket", url: "wss://evolu-relay-2.artlu.xyz" },
		{ type: "WebSocket", url: "wss://free.evoluhq.com" },
	],
});

/**
 * Subscribe to unexpected Evolu errors (database, network, sync issues). These
 * should not happen in normal operation, so always log them for debugging. Show
 * users a friendly error message instead of technical details.
 */
evoluInstance.subscribeError(() => {
	const error = evoluInstance.getError();
	if (!error) return;

	alert("🚨 Evolu error occurred! Check the console.");
	console.error(error);
});

export const useEvolu = createUseEvolu(evoluInstance);

export const messagesQuery = (ownerId?: OwnerId) =>
	// Columns createdAt, updatedAt, isDeleted are auto-added to all tables.

	// Soft delete: filter out deleted rows.

	// Like with GraphQL, all columns except id are nullable in queries
	// (even if defined without nullOr in the schema) to allow schema
	// evolution without migrations. Filter nulls with where + $narrowType.

	evoluInstance.createQuery((db) =>
		ownerId
			? db
					.selectFrom("message")
					.select(["id", "content", "createdBy", "createdAt"])
					.where("createdBy", "is", ownerId)
					.where("isDeleted", "is not", sqliteTrue)
					.$narrowType<{ content: kysely.NotNull }>()
					.orderBy("createdAt")
			: db
					.selectFrom("message")
					.select(["id", "content", "createdBy", "createdAt"])
					.where("isDeleted", "is not", sqliteTrue)
					.$narrowType<{ content: kysely.NotNull }>()
					.orderBy("createdAt"),
	);
export type MessagesRow = ReturnType<typeof messagesQuery>["Row"];

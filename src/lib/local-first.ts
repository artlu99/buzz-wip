import {
	createEvolu,
	id,
	type kysely,
	NonEmptyString100,
	nullOr,
	SimpleName,
	SqliteBoolean,
	sqliteTrue,
} from "@evolu/common";
import { createUseEvolu } from "@evolu/react";
import { evoluReactWebDeps, localAuth } from "@evolu/react-web";

const TodoId = id("Todo");

export const Schema = {
	todo: {
		id: TodoId,
		title: NonEmptyString100,
		isCompleted: nullOr(SqliteBoolean),
	},
};

// Namespace for the current app (scopes databases, passkeys, etc.)
export const service = "pwa-react-151125";

// Note: this is a top-level await
export const authResult = await localAuth.getOwner({ service });
export const ownerIds = await localAuth.getProfiles({ service });

// Create Evolu instance for the React web platform.
export const evoluInstance = createEvolu(evoluReactWebDeps)(Schema, {
	name: SimpleName.orThrow(`${service}-${authResult?.owner?.id ?? "guest"}`),
	encryptionKey: authResult?.owner?.encryptionKey,
	externalAppOwner: authResult?.owner,

	transports: [
		{ type: "WebSocket", url: "wss://evolu-relay.artlu.xyz" },
		{ type: "WebSocket", url: "wss://free.evoluhq.com" },
	],
});

export const useEvolu = createUseEvolu(evoluInstance);

export const todosQuery = evoluInstance.createQuery((db) =>
	db
		// Type-safe SQL: try autocomplete for table and column names.
		.selectFrom("todo")
		.select(["id", "title", "isCompleted"])
		// Soft delete: filter out deleted rows.
		.where("isDeleted", "is not", sqliteTrue)
		// Like with GraphQL, all columns except id are nullable in queries
		// (even if defined without nullOr in the schema) to allow schema
		// evolution without migrations. Filter nulls with where + $narrowType.
		.where("title", "is not", null)
		.$narrowType<{ title: kysely.NotNull }>()
		// Columns createdAt, updatedAt, isDeleted are auto-added to all tables.
		.orderBy("createdAt"),
);

// Extract the row type from the query for type-safe component props.
export type TodosRow = typeof todosQuery.Row;

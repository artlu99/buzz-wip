import {
	createFormatTypeError,
	type DateIso,
  type IdenticonStyle,
	type MaxLengthError,
	type MinLengthError,
	type NonEmptyString100,
	type OwnerId,
} from "@evolu/common";
import { sift } from "radash";
import type { MessagesRow } from "./local-first";
import { isTextMessage, type WsMessage } from "./sockets";

export const chosenIdenticonStyle: IdenticonStyle = "sutnar";

export function pluralize(count: number, word: string, plural: string = "s") {
	return count === 1 ? word : `${word}${plural}`;
}

export const formatTypeError = createFormatTypeError<
	MinLengthError | MaxLengthError
>((error): string => {
	switch (error.type) {
		case "MinLength":
			return `Text must be at least ${error.min} character${error.min === 1 ? "" : "s"} long`;
		case "MaxLength":
			return `Text is too long (maximum ${error.max} characters)`;
	}
});

// Use string as key type, as OwnerId is a branded type that doesn't accept string literals directly
export const profilePictures: Record<string, [string, string]> = {
	"1": [
		"Obi-Wan Kenobi",
		"https://img.daisyui.com/images/profile/demo/kenobee@192.webp",
	],
	"2": [
		"Anakin Skywalker",
		"https://img.daisyui.com/images/profile/demo/anakeen@192.webp",
	],
};

const wsMessagesTestFixture: WsMessage[] = [
	{
		date: new Date("2025-11-26T12:45:00").getTime(),
		uid: "1",
		message: {
			type: "text",
			uuid: "1",
			content: "You were the Chosen One!",
		},
	},
	{
		date: new Date("2025-11-26T12:46:00").getTime(),
		uid: "2",
		message: {
			type: "text",
			uuid: "2",
			content: "Ok, Unc",
		},
	},
];

export const messagesTestFixture: MessagesRow[] = sift(
	wsMessagesTestFixture.map((ws) => {
		if (!isTextMessage(ws.message)) {
			return undefined;
		}
		return {
			id: ws.message.uuid as string as unknown as MessagesRow["id"],
			content: ws.message.content as NonEmptyString100,
			createdBy: ws.uid as OwnerId,
			createdAt: new Date(ws.date).toISOString() as DateIso,
		} as MessagesRow;
	}),
);

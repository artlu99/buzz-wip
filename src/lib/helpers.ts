import { createFormatTypeError, type MaxLengthError, type MinLengthError } from "@evolu/common";
import type { WsMessage } from "./sockets";

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

export const messagesTestFixture: WsMessage[] = [
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

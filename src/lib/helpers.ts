import {
	createFormatTypeError,
	type IdenticonStyle,
	type MaxLengthError,
	type MinLengthError,
} from "@evolu/common";

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

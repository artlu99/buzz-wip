import {
	createFormatTypeError,
	type IdenticonStyle,
	type MaxLengthError,
	type MinLengthError,
} from "@evolu/common";

export const chosenIdenticonStyle: IdenticonStyle = "sutnar";

export function pluralize(count: number, word: string, plural: string = `${word}s`) {
	return `${count} ${count === 1 ? word : plural}`;
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

export const isValidHttpUrl = (urlString: string): boolean => {
	try {
		const url = new URL(urlString);
		// Only allow http and https protocols
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
};

/**
 * Serialize binary data using base64 encoding (modern standard for binary in JSON).
 * Helper to convert Uint8Array to base64 efficiently (handles large arrays).
 */
export const uint8ArrayToBase64 = (bytes: Uint8Array): string => {
	let binary = "";
	const len = bytes.byteLength;
	for (let i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
};

/**
 * Convert base64 string to Uint8Array.
 */
export const Base64ToUint8Array = (base64: string): Uint8Array => {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
};

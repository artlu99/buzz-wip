import { uint8ArrayToBase64 } from "./helpers";

/**
 * Modern, browser-safe salted hash using Web Crypto API.
 * This is the fastest native way to hash data in the browser.
 */
export async function createSaltedHash(data: string, salt: string): Promise<string> {
	const encoder = new TextEncoder();
	const dataUint8 = encoder.encode(`${data}-|-${salt}`);
	const hashBuffer = await crypto.subtle.digest("SHA-256", dataUint8);

	// Convert ArrayBuffer to Uint8Array for the base64 helper
	return uint8ArrayToBase64(new Uint8Array(hashBuffer));
}

/**
 * Safely send a message via socket with error handling.
 * Used in multiple places to avoid repeating try/catch blocks.
 */
export function safeSend<T>(
	socketClient: { send: (message: T) => void },
	message: T,
	errorMessage: string,
): void {
	try {
		socketClient.send(message);
	} catch (err) {
		console.error(errorMessage, err);
	}
}


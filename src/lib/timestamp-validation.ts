/**
 * Timestamp validation utilities for network timestamps.
 * 
 * Network timestamps are untrusted and can be spoofed, so we validate them
 * against reasonable bounds and use local timestamps as fallback.
 */

// Maximum allowed future timestamp (accounts for clock skew and network delay)
const MAX_FUTURE_MS = 60 * 1000; // 60 seconds

// Maximum allowed age for messages (prevents replay attacks with old timestamps)
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Maximum allowed clock skew for DELETE timestamps
const MAX_DELETE_SKEW_MS = 5 * 60 * 1000; // 5 minutes

export interface TimestampValidationResult {
	valid: boolean;
	reason?: string;
	clampedTimestamp?: number; // Timestamp clamped to valid range
	originalTimestamp?: number; // Original timestamp value
}

/**
 * Validate a network timestamp string.
 * 
 * @param networkTimestamp - Stringified Unix timestamp from network
 * @param localTimestamp - Current local timestamp (defaults to Date.now())
 * @returns Validation result with clamped timestamp if invalid
 */
export function validateNetworkTimestamp(
	networkTimestamp: string,
	localTimestamp: number = Date.now(),
): TimestampValidationResult {
	const timestamp = parseInt(networkTimestamp, 10);

	if (Number.isNaN(timestamp)) {
		return {
			valid: false,
			reason: "Invalid timestamp format - not a number",
			originalTimestamp: undefined,
		};
	}

	const now = localTimestamp;
	const age = now - timestamp;
	const future = timestamp - now;

	if (future > MAX_FUTURE_MS) {
		// Timestamp too far in future - clamp to max future
		return {
			valid: false,
			reason: `Timestamp too far in future: ${future}ms (max: ${MAX_FUTURE_MS}ms)`,
			clampedTimestamp: now + MAX_FUTURE_MS,
			originalTimestamp: timestamp,
		};
	}

	if (age > MAX_AGE_MS) {
		// Timestamp too old - clamp to max age
		return {
			valid: false,
			reason: `Timestamp too old: ${age}ms (max: ${MAX_AGE_MS}ms)`,
			clampedTimestamp: now - MAX_AGE_MS,
			originalTimestamp: timestamp,
		};
	}

	return {
		valid: true,
		clampedTimestamp: timestamp,
		originalTimestamp: timestamp,
	};
}

/**
 * Get a display timestamp for ordering messages.
 * Uses networkTimestamp if valid, otherwise falls back to local timestamp.
 * 
 * @param networkTimestamp - Stringified Unix timestamp from network (optional)
 * @param localTimestamp - Local timestamp (e.g., from createdAt)
 * @returns Timestamp to use for display/ordering
 */
export function getDisplayTimestamp(
	networkTimestamp: string | undefined,
	localTimestamp: number,
): number {
	if (!networkTimestamp) {
		return localTimestamp;
	}

	const validation = validateNetworkTimestamp(networkTimestamp, Date.now());

	if (validation.valid && validation.clampedTimestamp !== undefined) {
		return validation.clampedTimestamp;
	}

	// Invalid timestamp - use local timestamp as fallback
	if (validation.clampedTimestamp !== undefined) {
		// Use clamped timestamp if available (slightly out of bounds)
		return validation.clampedTimestamp;
	}

	return localTimestamp;
}

/**
 * Validate DELETE message timestamp against the target message's updatedAt.
 * 
 * @param deleteTimestamp - Timestamp from DELETE message (optional)
 * @param messageUpdatedAt - UpdatedAt timestamp from the message being deleted
 * @returns Whether the DELETE timestamp is valid
 */
export function validateDeleteTimestamp(
	deleteTimestamp: string | undefined,
	messageUpdatedAt: number | string,
): { valid: boolean; reason?: string } {
	if (!deleteTimestamp) {
		// No timestamp provided - allow (will use local updatedAt)
		return { valid: true };
	}

	const deleteTs = parseInt(deleteTimestamp, 10);
	if (Number.isNaN(deleteTs)) {
		return {
			valid: false,
			reason: "Invalid DELETE timestamp format",
		};
	}

	const updatedAt =
		typeof messageUpdatedAt === "string"
			? new Date(messageUpdatedAt).getTime()
			: messageUpdatedAt;

	const diff = Math.abs(deleteTs - updatedAt);

	if (diff > MAX_DELETE_SKEW_MS) {
		return {
			valid: false,
			reason: `DELETE timestamp mismatch: ${diff}ms (max skew: ${MAX_DELETE_SKEW_MS}ms)`,
		};
	}

	return { valid: true };
}

/**
 * Get a safe timestamp for storing in the database.
 * Validates and clamps the network timestamp if needed.
 * 
 * @param networkTimestamp - Stringified Unix timestamp from network
 * @param localTimestamp - Local timestamp as fallback
 * @returns Safe timestamp string to store
 */
export function getSafeNetworkTimestamp(
	networkTimestamp: string | undefined,
	localTimestamp: number = Date.now(),
): string {
	if (!networkTimestamp) {
		return String(localTimestamp);
	}

	const validation = validateNetworkTimestamp(networkTimestamp, localTimestamp);

	if (validation.valid && validation.clampedTimestamp !== undefined) {
		return String(validation.clampedTimestamp);
	}

	// Invalid timestamp - use local timestamp
	if (validation.clampedTimestamp !== undefined) {
		// Use clamped timestamp if available
		return String(validation.clampedTimestamp);
	}

	return String(localTimestamp);
}

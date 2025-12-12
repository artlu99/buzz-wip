import { useRef } from "react";
import { lru } from "tiny-lru";

export interface AutoResponderState {
	// Cooldown tracking
	isInCooldown: (uuid: string, windowMs: number) => boolean;
	updateCooldown: (uuid: string) => void;

	// Blocklist
	isBlocked: (uuid: string) => boolean;
	blockUUID: (uuid: string, timeoutMs: number) => void;

	// Idempotency tracking
	hasHeardMessage: (networkMessageId: string, windowMs: number) => boolean;
	hasSentMessage: (networkMessageId: string, windowMs: number) => boolean;
	recordHeardMessage: (networkMessageId: string) => void;
	recordSentMessage: (networkMessageId: string) => void;

	// Scheduled autoresponses
	scheduleAutoresponse: (
		uuid: string,
		timeoutId: ReturnType<typeof setTimeout>,
	) => void;
	cancelAutoresponse: (uuid: string) => ReturnType<typeof setTimeout> | null;
	cancelAllAutoresponses: () => Array<ReturnType<typeof setTimeout>>;

	// Spam tracking
	recordMarcoMessage: (uuid: string) => void;
	recordAutoresponse: (uuid: string) => void;
}

interface TrackerEntry {
	count: number;
	firstSeen: number;
}

/**
 * Custom hook that provides AutoResponderState with all LRU caches.
 * All state is managed in LRU caches for automatic memory management.
 */
export function useAutoResponderState(): AutoResponderState {
	// Small caches (100 entries) with TTL
	// Cooldown: 30 seconds TTL (matches isInCooldown windowMs)
	const autoresponseCooldownRef = useRef(lru<number>(100, 30000));
	const scheduledAutoResponsesRef = useRef(
		lru<ReturnType<typeof setTimeout>>(100),
	);

	// Large caches (1000 entries) with TTL
	// Idempotency: 10 seconds TTL (matches hasHeardMessage/hasSentMessage windowMs)
	const heardFromOthersRef = useRef(lru<number>(1000, 10000));
	const sentByUsRef = useRef(lru<number>(1000, 10000));
	// Blocklist: variable timeout, use max 5 minutes TTL as safety
	const blocklistRef = useRef(lru<number>(1000, 300000));

	// Medium caches (500 entries) with TTL
	// Marco tracking: 10 seconds TTL
	const marcoCountTrackerRef = useRef(lru<TrackerEntry>(500, 10000));
	// Autoresponse tracking: 30 seconds TTL
	const autoresponseCountTrackerRef = useRef(lru<TrackerEntry>(500, 30000));

	return {
		// Cooldown tracking
		// TTL handles expiration automatically - if get() returns undefined, it's expired
		isInCooldown: (uuid: string, _windowMs: number): boolean => {
			const timestamp = autoresponseCooldownRef.current.get(uuid);
			return timestamp !== undefined && typeof timestamp === "number";
		},

		updateCooldown: (uuid: string): void => {
			autoresponseCooldownRef.current.set(uuid, Date.now());
		},

		// Blocklist
		// TTL handles expiration automatically, but we still need to check blockedUntil timestamp
		// since block duration is variable
		isBlocked: (uuid: string): boolean => {
			const blockedUntil = blocklistRef.current.get(uuid);
			if (blockedUntil === undefined || typeof blockedUntil !== "number") {
				return false;
			}
			const now = Date.now();
			if (now >= blockedUntil) {
				// Expired, remove it (TTL may have already removed it, but check anyway)
				blocklistRef.current.delete(uuid);
				console.log("[AUTORESPONDER STATE] Block expired for UUID:", {
					uuid,
					blockedUntil: new Date(blockedUntil).toISOString(),
					now: new Date(now).toISOString(),
				});
				return false;
			}
			const remainingMs = blockedUntil - now;
			console.log("[AUTORESPONDER STATE] UUID is blocked:", {
				uuid,
				blockedUntil: new Date(blockedUntil).toISOString(),
				remainingSeconds: Math.round(remainingMs / 1000),
			});
			return true;
		},

		blockUUID: (uuid: string, timeoutMs: number): void => {
			const blockedUntil = Date.now() + timeoutMs;
			blocklistRef.current.set(uuid, blockedUntil);
			console.log("[AUTORESPONDER STATE] Blocking UUID:", {
				uuid,
				timeoutMs,
				blockedUntil: new Date(blockedUntil).toISOString(),
				reason: "Manual block (via blockUUID)",
			});
		},

		// Idempotency tracking
		// TTL handles expiration automatically - if get() returns undefined, it's expired
		hasHeardMessage: (networkMessageId: string, _windowMs: number): boolean => {
			const timestamp = heardFromOthersRef.current.get(networkMessageId);
			return timestamp !== undefined && typeof timestamp === "number";
		},

		hasSentMessage: (networkMessageId: string, _windowMs: number): boolean => {
			const timestamp = sentByUsRef.current.get(networkMessageId);
			return timestamp !== undefined && typeof timestamp === "number";
		},

		recordHeardMessage: (networkMessageId: string): void => {
			heardFromOthersRef.current.set(networkMessageId, Date.now());
		},

		recordSentMessage: (networkMessageId: string): void => {
			sentByUsRef.current.set(networkMessageId, Date.now());
		},

		// Scheduled autoresponses
		scheduleAutoresponse: (
			uuid: string,
			timeoutId: ReturnType<typeof setTimeout>,
		): void => {
			scheduledAutoResponsesRef.current.set(uuid, timeoutId);
		},

		cancelAutoresponse: (
			uuid: string,
		): ReturnType<typeof setTimeout> | null => {
			const timeoutId = scheduledAutoResponsesRef.current.get(uuid);
			if (timeoutId !== undefined && typeof timeoutId !== "string") {
				scheduledAutoResponsesRef.current.delete(uuid);
				return timeoutId;
			}
			return null;
		},

		cancelAllAutoresponses: (): Array<ReturnType<typeof setTimeout>> => {
			const timeouts: Array<ReturnType<typeof setTimeout>> = [];
			const keys = Array.from(scheduledAutoResponsesRef.current.keys());
			for (const uuid of keys) {
				const timeoutId = scheduledAutoResponsesRef.current.get(uuid);
				if (timeoutId !== undefined && typeof timeoutId !== "string") {
					timeouts.push(timeoutId);
					scheduledAutoResponsesRef.current.delete(uuid);
				}
			}
			return timeouts;
		},

		// Spam tracking
		// TTL handles expiration automatically - if entry is undefined, it expired
		recordMarcoMessage: (uuid: string): void => {
			const now = Date.now();
			const entry = marcoCountTrackerRef.current.get(uuid);

			if (
				entry === undefined ||
				typeof entry !== "object" ||
				!("count" in entry)
			) {
				// Entry expired or doesn't exist - start fresh
				marcoCountTrackerRef.current.set(uuid, {
					count: 1,
					firstSeen: now,
				});
			} else {
				// Entry still valid (TTL ensures it's within window)
				marcoCountTrackerRef.current.set(uuid, {
					count: entry.count + 1,
					firstSeen: entry.firstSeen,
				});
			}

			// Marco message tracking (logging only - no blocking)
			// Blocking disabled: new browsers legitimately send multiple Marco messages
			// during initial connection/reconnects. Idempotency and cooldown provide
			// sufficient protection against spam.
			const current = marcoCountTrackerRef.current.get(uuid);
			if (current && typeof current === "object" && "count" in current) {
				console.log("[AUTORESPONDER STATE] Marco message tracked:", {
					uuid,
					count: current.count,
					timeWindowMs: now - current.firstSeen,
				});
			}
		},

		recordAutoresponse: (uuid: string): void => {
			const now = Date.now();
			const entry = autoresponseCountTrackerRef.current.get(uuid);

			if (
				entry === undefined ||
				typeof entry !== "object" ||
				!("count" in entry)
			) {
				// Entry expired or doesn't exist - start fresh
				autoresponseCountTrackerRef.current.set(uuid, {
					count: 1,
					firstSeen: now,
				});
			} else {
				// Entry still valid (TTL ensures it's within window)
				autoresponseCountTrackerRef.current.set(uuid, {
					count: entry.count + 1,
					firstSeen: entry.firstSeen,
				});
			}

			// Autoresponse tracking (logging only - no blocking)
			// Blocking disabled: idempotency and cooldown provide sufficient protection.
			// New browsers may legitimately trigger multiple autoresponses during catch-up.
			const current = autoresponseCountTrackerRef.current.get(uuid);
			if (current && typeof current === "object" && "count" in current) {
				console.log("[AUTORESPONDER STATE] Autoresponse tracked:", {
					uuid,
					count: current.count,
					timeWindowMs: now - current.firstSeen,
				});
			}
		},
	};
}

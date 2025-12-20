import { useRef } from "react";
import { lru } from "tiny-lru";

export interface AutoResponderState {
	// Cooldown tracking
	isInCooldown: (uuid: string, windowMs: number) => boolean;
	updateCooldown: (uuid: string) => void;

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
	};
}

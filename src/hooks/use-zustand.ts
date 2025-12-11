import { NonEmptyString100, type OwnerId } from "@evolu/common";
import { create } from "zustand";
import { combine, createJSONStorage, persist } from "zustand/middleware";
import type { ChannelData, UserMessageData } from "../lib/sockets";

export const useZustand = create(persist(combine({
	channel: {
		channelId: NonEmptyString100.orThrow("buzz-54321"),
		encrypted: false,
		encryptionKey: undefined as string | undefined
	},
	user: {
		displayName: "Anonymous Bee 🐝",
		pfpUrl: "",
		bio: "",
		status: "",
		notificationChannel: "",
		autoResponder: false
	} as UserMessageData,
	lockdown: false,
	playSounds: false,
	room: {} as Record<string, number>, // uuid -> unixTimestamp
	uuid: undefined as OwnerId | undefined
}, (set, get) => (
	{
		setChannelId: (channelId: NonEmptyString100) => set({ channel: { ...get().channel, channelId } }),
		setEncrypted: (encrypted: boolean) => set({ channel: { ...get().channel, encrypted } }),
		setEncryptionKey: (encryptionKey: string | undefined) => set({ channel: { ...get().channel, encryptionKey } }),
		setUser: (
			displayName: string,
			pfpUrl: string = "",
			bio: string = "",
			status: string = "",
			notificationChannel: string = "",
		) => set(
			{ user: { ...get().user, displayName, pfpUrl, bio, status, notificationChannel } }
		),
		toggleAutoResponder: () => set({ user: { ...get().user, autoResponder: !get().user.autoResponder } }),
		setLockdown: (lockdown: boolean) => set({ lockdown }),
		togglePlaySounds: () => set({ playSounds: !get().playSounds }),
		setRoom: (room: Record<string, number>) => set({ room: { ...room } }),
		setUuid: (uuid: OwnerId | undefined) => set(
			{ uuid }
		),
		getActiveRoom: (maxAgeMs: number = 600000) => {
			const { room, uuid } = get();
			const now = Date.now();
			// Filter out stale entries, but always keep self
			return Object.fromEntries(
				Object.entries(room).filter(([uuidKey, timestamp]) => {
					return now - timestamp < maxAgeMs || uuidKey === uuid;
				})
			);
		},
		// Create ChannelData with encryption key, respecting lockdown setting
		// Always reads fresh state to avoid stale closures
		createChannelData: (channelId: string): ChannelData => {
			const { lockdown, channel } = get();
			return {
				id: channelId,
				// Respect lockdown: if true, don't include encryption key
				publicUselessEncryptionKey: lockdown
					? undefined
					: channel.encryptionKey,
			};
		},
	}
)),
	{
		name: "buzz-store", storage: createJSONStorage(() => localStorage),
		partialize: (state) => ({
			...state,
			channel: {
				...state.channel,
				encryptionKey: undefined, // Don't persist encryption keys - they must be re-shared via Polo messages
			},
		}),
	}
))

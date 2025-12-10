import { NonEmptyString100, type OwnerId } from "@evolu/common";
import { create } from "zustand";
import { combine, createJSONStorage, persist } from "zustand/middleware";
import type { UserMessageData } from "../lib/sockets";

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
		togglePlaySounds: () => set({ playSounds: !get().playSounds }),
		setRoom: (room: Record<string, number>) => set({ room: { ...room } }),
		setUuid: (uuid: OwnerId | undefined) => set(
			{ uuid }
		),
		pruneStaleEntries: (maxAgeMs: number = 60000) => {
			const { room, uuid } = get();
			const now = Date.now();
			const pruned = Object.fromEntries(
				Object.entries(room).filter(([uuidKey, timestamp]) => {
					// Keep entries that are not stale, and always keep self
					return now - timestamp < maxAgeMs || uuidKey === uuid;
				})
			);
			set({ room: pruned });
		},
	}
)),
	{
		name: "buzz-store", storage: createJSONStorage(() => localStorage),
	}
))

import { NonEmptyString100, type OwnerId } from "@evolu/common";
import { create } from "zustand";
import { combine, createJSONStorage, persist } from "zustand/middleware";
import type { UserMessageData } from "../lib/sockets";

export const useZustand = create(persist(combine({
	channelId: NonEmptyString100.orThrow("buzz-54321"),
	encrypted: false,
	user: {
		displayName: "Anonymous Bee 🐝",
		pfpUrl: "",
		bio: "",
	} as UserMessageData,
	uuid: undefined as OwnerId | undefined
}, (set) => (
	{
		setChannelId: (channelId: NonEmptyString100) => set({ channelId }),
		toggleEncryption: () => set((state) => ({ encrypted: !state.encrypted })),
		setUser: (
			displayName: string,
			pfpUrl: string = "",
			bio: string = "",
		) => set(
			{ user: { displayName, pfpUrl, bio } }
		),
		setUuid: (uuid: OwnerId | undefined) => set(
			{ uuid }
		),
	}
)),
	{
		name: "buzz-store", storage: createJSONStorage(() => localStorage),
	}
))

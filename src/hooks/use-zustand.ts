import { NonEmptyString100, type OwnerId } from "@evolu/common";
import { create } from "zustand";
import { combine, createJSONStorage, persist } from "zustand/middleware";
import type { UserMessageData } from "../lib/sockets";

export const useZustand = create(persist(combine({
	channelName: NonEmptyString100.orThrow("buzz-543212345"),
	user: {
		displayName: "Anonymous Bee 🐝",
		pfpUrl: "",
		bio: "",
	} as UserMessageData,
	uuid: undefined as OwnerId | undefined
}, (set) => (
	{
		setChannelName: (channelName: NonEmptyString100) => set({ channelName }),
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

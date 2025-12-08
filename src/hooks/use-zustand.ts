import { NonEmptyString100, type OwnerId } from "@evolu/common";
import { create } from "zustand";
import { UserId } from "../lib/local-first";

export const useZustand = create<{
	channelName: NonEmptyString100;
	setChannelName: (channelName: NonEmptyString100) => void;
	user: { id: UserId; displayName: string; pfpUrl: string; bio: string };
	setUser: (uuid: UserId, displayName: string) => void;
	uuid: OwnerId | undefined;
	setUuid: (uuid: OwnerId | undefined) => void;
}>((set) => ({
	channelName: NonEmptyString100.orThrow("buzz-543212345"),
	setChannelName: (channelName: NonEmptyString100) => set({ channelName }),
	user: {
		id: UserId.orThrow("anonymous-bee"),
		displayName: "Anonymous Bee",
		pfpUrl: "",
		bio: "",
	},
	setUser: (uuid: UserId, displayName: string) =>
		set({ user: { id: uuid, displayName, pfpUrl: "", bio: "" } }),
	uuid: undefined,
	setUuid: (uuid: OwnerId | undefined) => set({ uuid }),
}));

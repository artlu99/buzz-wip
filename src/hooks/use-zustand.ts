import { NonEmptyString100, type OwnerId } from "@evolu/common";
import { create } from "zustand";
import { combine, createJSONStorage, persist } from "zustand/middleware";
import { type ChannelData, type UserMessageData, WSS_SERVER_URL } from "../lib/sockets";

const ROOM_USERS_MAX_AGE_MS = 600000; // 10 minutes
const ROOM_USERS_MAX_COUNT = 100;

interface ChannelState {
	channelId: NonEmptyString100;
	encrypted: boolean;
	encryptionKey: string | undefined;
}
const initialChannel: ChannelState = {
	channelId: NonEmptyString100.orThrow("buzz-54321"),
	encrypted: false,
	encryptionKey: undefined ,
}
const initalUser: UserMessageData = {
	displayName: "Anonymous Bee 🐝",
	pfpUrl: "",
	bio: "",
	publicNtfyShId: "",
	status: "",
}

const initialRoom: Record<string, number> = {}; // uuid -> unixTimestamp

export const useZustand = create(
	persist(
		combine(
			{
				wssServer: WSS_SERVER_URL,
				channel: initialChannel,
				user: initalUser,
				autoResponder: false,
				lockdown: false,
				playSounds: false,
				verbose: false,
				room: initialRoom,
				uuid: undefined as OwnerId | undefined,
			},
			(set, get) => ({
				setWssServer: (wssServer: string) => set({ wssServer }),
				setChannelId: (channelId: NonEmptyString100) =>
					set({ channel: { ...get().channel, channelId } }),
				setEncrypted: (encrypted: boolean) =>
					set({ channel: { ...get().channel, encrypted } }),
				setEncryptionKey: (encryptionKey: string | undefined) =>
					set({ channel: { ...get().channel, encryptionKey } }),
				setUser: (
					displayName: string,
					pfpUrl: string = "",
					bio: string = "",
					publicNtfyShId: string = "",
					status: string = "",
				) =>
					set({
						user: {
							...get().user,
							displayName,
							pfpUrl,
							bio,
							publicNtfyShId,
							status,
						},
					}),
				toggleAutoResponder: () => set({ autoResponder: !get().autoResponder }),
				setLockdown: (lockdown: boolean) => set({ lockdown }),
				togglePlaySounds: () => set({ playSounds: !get().playSounds }),
				toggleVerbose: () => set({ verbose: !get().verbose }),
				setRoom: (room: Record<string, number>) => set({ room: { ...room } }),
				setUuid: (uuid: OwnerId | undefined) => set({ uuid }),
				getActiveRoom: (maxAgeMs: number = ROOM_USERS_MAX_AGE_MS) => {
					const { room, uuid } = get();
					const now = Date.now();
					// Filter out stale entries, but always keep self
					return Object.fromEntries(
						Object.entries(room)
							.filter(([uuidKey, timestamp]) => {
								return now - timestamp < maxAgeMs || uuidKey === uuid;
							})
							.sort((a, b) => b[1] - a[1])
							.slice(0, ROOM_USERS_MAX_COUNT),
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
			}),
		),
		{
			name: "buzz-store",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				...state,
				channel: { ...state.channel },
			}),
		},
	),
);

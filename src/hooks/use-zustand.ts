import { NonEmptyString100 } from "@evolu/common";
import { create } from "zustand";

export const useZustand = create<{
  channelName: NonEmptyString100;
  setChannelName: (channelName: NonEmptyString100) => void;
  displayName: string;
  setDisplayName: (displayName: string) => void;
}>((set) => ({
  channelName: NonEmptyString100.orThrow("buzz-543212345"),
  setChannelName: (channelName: NonEmptyString100) => set({ channelName }),
  displayName: "Anonymous Bee",
  setDisplayName: (displayName) => set({ displayName }),
}));

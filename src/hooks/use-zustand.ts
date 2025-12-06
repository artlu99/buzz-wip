import { create } from "zustand";

export const useZustand = create<{
  channelName: string;
  setChannelName: (channelName: string) => void;
  displayName: string;
  setDisplayName: (displayName: string) => void;
}>((set) => ({
  channelName: "buzz-543212345",
  setChannelName: (channelName) => set({ channelName }),
  displayName: "Anonymous Bee",
  setDisplayName: (displayName) => set({ displayName }),
}));

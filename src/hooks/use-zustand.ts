import { create } from "zustand";

export const useZustand = create<{
  displayName: string;
  setDisplayName: (displayName: string) => void;
}>((set) => ({
  displayName: "Anonymous Bee",
  setDisplayName: (displayName) => set({ displayName }),
}));

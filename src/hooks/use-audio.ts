import { useContext } from "react";
import { AudioContext, type AudioContextType } from "../providers/AudioProvider";

export const useSounds = (): AudioContextType => {
	const context = useContext(AudioContext);
	if (!context) {
		throw new Error("useAudio must be used within an AudioProvider");
	}
	return context;
};
import { createContext, type ReactNode, useEffect, useState } from "react";
import { useZustand } from "../hooks/use-zustand";

// Audio file paths
// TODO: select audio files from Pixabay
export enum SoundsEnum {
	DOORBELL = "/assets/doorbell.mp3",
	MESSAGE = "/assets/message.mp3",
	REACTION = "/assets/reaction.mp3",
	SEND_MESSAGE = "/assets/send_message.mp3",
	TYPING = "/assets/typing.mp3",
	WELCOME = "/assets/welcome.mp3",
}

export interface AudioContextType {
	playAudio: (sound: SoundsEnum, invertPlayLogic?: boolean) => void;
	isAudioLoaded: boolean;
}

export const AudioContext = createContext<AudioContextType | null>(null);

interface AudioProviderProps {
	children: ReactNode;
}

export const AudioProvider = ({ children }: AudioProviderProps) => {
	const [isAudioLoaded, setIsAudioLoaded] = useState(false);
	const [audioInstances, setAudioInstances] = useState<
		Map<SoundsEnum, HTMLAudioElement>
	>(new Map());

	const { playSounds } = useZustand();

	useEffect(() => {
		const instances = {
			message: new Audio(SoundsEnum.MESSAGE),
			reaction: new Audio(SoundsEnum.REACTION),
			sendMessage: new Audio(SoundsEnum.SEND_MESSAGE),
			typing: new Audio(SoundsEnum.TYPING),
			welcome: new Audio(SoundsEnum.WELCOME),
		};

		// Pre-load all audio files
		const loadPromises = Object.values(instances).map((audio) => {
			return new Promise<void>((resolve) => {
				audio.addEventListener("canplaythrough", () => resolve(), {
					once: true,
				});
				audio.addEventListener("error", () => resolve(), { once: true }); // Resolve even on error to not block the app
				audio.load();
			});
		});

		Promise.all(loadPromises).then(() => {
			const audioInstances = new Map<SoundsEnum, HTMLAudioElement>();
			for (const [key, value] of Object.entries(instances)) {
				audioInstances.set(key as SoundsEnum, value);
			}
			setAudioInstances(audioInstances);
			setIsAudioLoaded(true);
		});
	}, []);

	const playAudio = (sound: SoundsEnum, invertLogic?: boolean) => {
		if (invertLogic ? playSounds : !playSounds) {
			return;
		}
		try {
			const audio = audioInstances.get(sound);
			if (audio) {
				// Reset to beginning in case it was already played
				audio.currentTime = 0;
				audio.play().catch((error) => {
					console.warn(`Failed to play audio ${sound}:`, error);
				});
			}
		} catch (error) {
			console.warn(`Error playing audio ${sound}:`, error);
		}
	};

	const value: AudioContextType = {
		playAudio,
		isAudioLoaded,
	};

	return (
		<AudioContext.Provider value={value}>{children}</AudioContext.Provider>
	);
};

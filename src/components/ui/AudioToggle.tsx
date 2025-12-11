import { useZustand } from "../../hooks/use-zustand";

const SHOW_TOGGLE = false;

export const AudioToggle = () => {
	const { playSounds, togglePlaySounds } = useZustand();

	if (!SHOW_TOGGLE) {
		return null;
	}

	return (
		<fieldset className="fieldset bg-base-100 border-base-300 rounded-box w-64 border p-4">
			<legend className="fieldset-legend">Play Sounds</legend>
			<label className="toggle text-base-content mx-4">
				<input
					type="checkbox"
					checked={playSounds}
					onChange={togglePlaySounds}
					disabled
				/>
				<svg
					aria-label="disabled"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="4"
					strokeLinecap="round"
					strokeLinejoin="round"
				>
					<title>Disabled</title>
					<path d="M18 6 6 18" />
					<path d="m6 6 12 12" />
				</svg>
				<svg
					aria-label="enabled"
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
				>
					<title>Enabled</title>
					<g
						strokeLinejoin="round"
						strokeLinecap="round"
						strokeWidth="4"
						fill="none"
						stroke="currentColor"
					>
						<path d="M20 6 9 17l-5-5"></path>
					</g>
				</svg>
			</label>
			{playSounds ? "Sounds On" : "Muted"}
		</fieldset>
	);
};

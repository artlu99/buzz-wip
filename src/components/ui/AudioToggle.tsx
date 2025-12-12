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
				<i className="ph-bold ph-x" title="Disabled" />
				<i className="ph-bold ph-check" title="Enabled" />
			</label>
			{playSounds ? "Sounds On" : "Muted"}
		</fieldset>
	);
};

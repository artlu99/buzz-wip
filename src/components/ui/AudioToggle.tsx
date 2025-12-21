import { useZustand } from "../../hooks/use-zustand";

export const AudioToggle = () => {
	const { playSounds, setPlaySounds } = useZustand();

	return (
		<fieldset className="fieldset bg-base-100 border-base-300 rounded-box w-64 border p-4">
			<legend className="fieldset-legend">Play Sounds</legend>
			<label className="toggle text-base-content mx-4">
				<input
					type="checkbox"
					checked={playSounds}
					onChange={() => setPlaySounds(!playSounds)}
					disabled
				/>
				<i className="ph-bold ph-x" title="Disabled" />
				<i className="ph-bold ph-check" title="Enabled" />
			</label>
			{playSounds ? "Sounds On" : "Muted"}
		</fieldset>
	);
};

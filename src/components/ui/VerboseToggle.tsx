import { useZustand } from "../../hooks/use-zustand";

export const VerboseToggle = () => {
	const { verbose, setVerbose } = useZustand();

	return (
		<fieldset className="fieldset bg-base-100 border-base-300 rounded-box w-64 border p-4">
			<legend className="fieldset-legend">Verbose Mode</legend>
			<label className="toggle text-base-content mx-4">
				<input
					type="checkbox"
					checked={verbose}
					onChange={() => setVerbose(!verbose)}
				/>
				<i className="ph-bold ph-x" title="Disabled" />
				<i className="ph-bold ph-check" title="Enabled" />
			</label>
			{verbose ? "More noisy" : "More peaceful"}
		</fieldset>
	);
};

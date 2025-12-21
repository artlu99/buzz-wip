import { toast } from "react-hot-toast";
import { useZustand } from "../../hooks/use-zustand";

export const AutoResponderToggle = () => {
	const { autoResponder, setAutoResponder } = useZustand();

	return (
		<span>
			<i
				className={`ph-bold ph-robot text-xl ${autoResponder ? "text-primary" : "text-base-content/40"} align-middle mr-2`}
			/>
			<label className="toggle text-base-content mr-4">
				<input
					type="checkbox"
					checked={autoResponder}
					onChange={() => {
						toast.success(
							autoResponder
								? "Auto Responder disabled"
								: "Auto Responder enabled",
						);
						setAutoResponder(!autoResponder);
					}}
				/>
				<i className="ph-bold ph-x" title="Disabled" />
				<i className="ph-bold ph-check" title="Enabled" />
			</label>
		</span>
	);
};

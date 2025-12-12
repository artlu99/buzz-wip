import { toast } from "react-hot-toast";
import { useZustand } from "../../hooks/use-zustand";

const SHOW_TOGGLE = true;

export const AutoResponderToggle = () => {
	const { user, toggleAutoResponder } = useZustand();

	if (!SHOW_TOGGLE) {
		return null;
	}

	return (
		<span>
			<i
				className={`ph-bold ph-robot text-xl ${user.autoResponder ? "text-primary" : "text-base-content/40"} align-middle mr-2`}
			/>
			<label className="toggle text-base-content mr-4">
				<input
					type="checkbox"
					checked={user.autoResponder}
					onChange={() => {
						toast.success(
							user.autoResponder
								? "Auto Responder disabled"
								: "Auto Responder enabled",
						);
						toggleAutoResponder();
					}}
				/>
				<i className="ph-bold ph-x" title="Disabled" />
				<i className="ph-bold ph-check" title="Enabled" />
			</label>
		</span>
	);
};

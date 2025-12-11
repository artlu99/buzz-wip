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
		</span>
	);
};

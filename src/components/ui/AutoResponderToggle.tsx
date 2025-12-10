import { useZustand } from "../../hooks/use-zustand";

const SHOW_TOGGLE = false;
// TODO: sound on/off toggle
export const AutoResponderToggle = () => {
	const { user, toggleAutoResponder } = useZustand();

	console.log("user.autoResponder", user.autoResponder);

	if (!SHOW_TOGGLE) {
		return null;
	}

	return (
		<label className="toggle text-base-content">
			<input
				type="checkbox"
				checked={user.autoResponder}
				onChange={toggleAutoResponder}
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
	);
};

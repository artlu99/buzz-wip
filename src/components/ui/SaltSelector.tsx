import { debounce } from "radash";
import { useEffect, useMemo, useState } from "react";
import { useZustand } from "../../hooks/use-zustand";

export const SaltSelector = () => {
	const { channel, setChannelSalt } = useZustand();
	const { channelSalt } = channel;
	const [selectedSalt, setSelectedSalt] = useState(channelSalt ?? "");
	const [showSaltPlaintext, setShowSaltPlaintext] = useState<boolean>(false);

	useEffect(() => {
		setSelectedSalt(channelSalt ?? "");
	}, [channelSalt]);

	// Debounced handlers that update Zustand (triggers network calls)
	const debouncedSetSalt = useMemo(
		() =>
			debounce({ delay: 400 }, (salt: string) => {
				setChannelSalt(salt === "" ? undefined : salt);
			}),
		[setChannelSalt],
	);

	const handleSaltChange = (value: string) => {
		setSelectedSalt(value); // Immediate UI update
		debouncedSetSalt(value); // Debounced network update trigger
	};

	return (
		<div className="flex flex-row gap-2">
			<fieldset className="fieldset rounded-box w-64">
				<legend className="fieldset-legend flex items-center gap-1">
					<i className="ph-bold ph-hash text-warning" />
					Channel Salt
				</legend>
				<div className="relative">
				<button
					type="button"
					className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1 hover:bg-base-200 rounded disabled:opacity-50 disabled:cursor-not-allowed"
					onClick={() => setShowSaltPlaintext(!showSaltPlaintext)}
					title={showSaltPlaintext ? "Hide salt" : "Show salt"}
				>
					<i
						className={`ph-bold ${
							showSaltPlaintext ? "ph-eye-slash" : "ph-eye"
						} text-base-content/50`}
					/>
				</button>
				<input
					className="input input-bordered w-full border-base-300 font-mono px-8"
					type={showSaltPlaintext ? "text" : "password"}
					placeholder="Use default"
					value={selectedSalt}
					onChange={(e) => handleSaltChange(e.target.value)}
				/></div>
				<em className="text-xs text-base-content/50">
					Coordinate this out-of-band to mask your room location.
				</em>
			</fieldset>
		</div>
	);
};

import { debounce } from "radash";
import { useEffect, useMemo, useState } from "react";
import { useZustand } from "../../hooks/use-zustand";

export const SocketServerSelector = () => {
	const { wssServer, setWssServer } = useZustand();
	const [selectedServer, setSelectedServer] = useState(wssServer);

	useEffect(() => {
		setSelectedServer(wssServer);
	}, [wssServer]);

	// Debounced handlers that update Zustand (triggers network calls)
	const debouncedSetWssServer = useMemo(
		() =>
			debounce({ delay: 400 }, (server: string) => {
				if (server.length === 0) return;
				setWssServer(server);
			}),
		[setWssServer],
	);

	const handleWssServerChange = (value: string) => {
		setSelectedServer(value); // Immediate UI update
		debouncedSetWssServer(value); // Debounced network update trigger
	};

	return (
		<div className="flex flex-row gap-2">
			<fieldset className="fieldset rounded-box w-64">
				<legend className="fieldset-legend">Websockets Server</legend>
				<input
					className="input input-bordered w-full border-base-300"
					type="text"
					value={selectedServer}
					onChange={(e) => handleWssServerChange(e.target.value)}
				/>
				<em className="text-xs text-base-content/50">
					only change this if you know what you're doing
				</em>
			</fieldset>
		</div>
	);
};

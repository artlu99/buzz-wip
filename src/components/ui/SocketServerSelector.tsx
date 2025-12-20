import { debounce } from "radash";
import { useEffect, useMemo, useState } from "react";
import { isValidWebSocketUrl } from "../../lib/helpers";
import { useZustand } from "../../hooks/use-zustand";

export const SocketServerSelector = () => {
	const { wssServer, setWssServer } = useZustand();
	const [selectedServer, setSelectedServer] = useState(wssServer);
	const [isValid, setIsValid] = useState(true);

	useEffect(() => {
		setSelectedServer(wssServer);
		setIsValid(true); // Reset validation when wssServer changes externally
	}, [wssServer]);

	// Debounced handlers that update Zustand (triggers network calls)
	const debouncedSetWssServer = useMemo(
		() =>
			debounce({ delay: 400 }, (server: string) => {
				if (server.length === 0) return;
				if (isValidWebSocketUrl(server)) {
					setWssServer(server);
				}
			}),
		[setWssServer],
	);

	const handleWssServerChange = (value: string) => {
		setSelectedServer(value); // Immediate UI update
		const valid = value.length === 0 || isValidWebSocketUrl(value);
		setIsValid(valid);
		if (valid && value.length > 0) {
			debouncedSetWssServer(value); // Debounced network update trigger
		}
	};

	return (
		<div className="flex flex-row gap-2">
			<fieldset className="fieldset rounded-box w-64">
				<legend className="fieldset-legend">Websockets Server</legend>
				<input
					className={`input input-bordered w-full ${
						isValid || selectedServer.length === 0
							? "border-base-300"
							: "border-error input-error"
					}`}
					type="url"
					pattern="^(ws|wss)://.+"
					title="Please enter a valid WebSocket URL starting with ws:// or wss://"
					value={selectedServer}
					onChange={(e) => handleWssServerChange(e.target.value)}
				/>
				{!isValid && selectedServer.length > 0 && (
					<p className="text-xs text-error mt-1">
						Please enter a valid WebSocket URL (ws:// or wss://)
					</p>
				)}
				<em className="text-xs text-base-content/50">
					Only change this if you know what you're doing
				</em>
			</fieldset>
		</div>
	);
};

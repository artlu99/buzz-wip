import {
	createIdFromString,
	createRandomBytes,
	NonEmptyString100,
} from "@evolu/common";
import { useQuery } from "@evolu/react";
import { debounce } from "radash";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "wouter";
import { useZustand } from "../hooks/use-zustand";
import { uint8ArrayToBase64 } from "../lib/helpers";
import { ChannelId, channelQuery } from "../lib/local-first";

const SHOW_CHANNEL_NAME = false;

export const MultiSelectorBlock = () => {
	const {
		channel,
		user,
		uuid,
		setChannelId,
		setEncryptionKey,
		setEncrypted,
	} = useZustand();
	const { channelId, encrypted, encryptionKey } = channel;
	
	// Local state for immediate UI feedback
	const [localChannelId, setLocalChannelId] = useState<string>(channelId);
	const [localEncryptionKey, setLocalEncryptionKey] = useState<string>(
		encryptionKey ?? "",
	);

	// Sync local state when Zustand state changes externally
	useEffect(() => {
		setLocalChannelId(channelId);
	}, [channelId]);

	useEffect(() => {
		setLocalEncryptionKey(encryptionKey ?? "");
	}, [encryptionKey]);

	useEffect(() => {
		if (uuid && encrypted) {
			toast.success("New messages will be encrypted", {
				position: "bottom-center",
				icon: <i className="ph-bold ph-lock" />,
			});
		}
		if (uuid && !encrypted) {
			toast.success("New messages broadcast to everyone", {
				position: "bottom-center",
				icon: <i className="ph-bold ph-megaphone text-green-500" />,
			});
		}
	}, [encrypted, uuid]);

	// Debounced handlers that update Zustand (triggers network calls)
	const debouncedSetChannelId = useMemo(
		() =>
			debounce({ delay: 400 }, (channelId: string) => {
				if (channelId.length === 0) return;
				setChannelId(NonEmptyString100.orThrow(channelId.slice(0, 100)));
			}),
		[setChannelId],
	);

	const debouncedSetEncryptionKey = useMemo(
		() =>
			debounce({ delay: 400 }, (encryptionKey: string) => {
				if (encryptionKey.length === 0) {
					setEncryptionKey(undefined);
					return;
				}
				setEncryptionKey(encryptionKey.slice(0, 1000));
			}),
		[setEncryptionKey],
	);

	const handleChannelChange = (value: string) => {
		setLocalChannelId(value); // Immediate UI update
		debouncedSetChannelId(value); // Debounced network update trigger
	};

	const handleEncryptionKeyChange = (value: string) => {
		setLocalEncryptionKey(value); // Immediate UI update
		debouncedSetEncryptionKey(value); // Debounced network update trigger
	};

	const handleEncryptionKeyClear = () => {
		setLocalEncryptionKey(""); // Immediate UI update
		setEncryptionKey(undefined); // Immediate network update (clearing is instant)
		setEncrypted(false);
	};

	const handleEncryptionKeyCreate = () => {
		const randomBytes = createRandomBytes();
		const symmetricEncryptionKey = randomBytes.create(32);
		setEncryptionKey(uint8ArrayToBase64(symmetricEncryptionKey));
	};

	const localChannelIdForQuery = ChannelId.orThrow(
		createIdFromString(channelId),
	);
	const channelData = useQuery(channelQuery(localChannelIdForQuery));
	const channelName = channelData?.[0]?.name;

	return (
		<div className="flex flex-col items-center gap-2">
			{/* User's display name */}
			<p className="text-sm text-gray-500">
				<Link href="/db">{user?.displayName}</Link>
			</p>

			{/* Channel selector */}
			<div className="flex flex-row items-center">
				<div className="flex flex-col gap-1">
					{/* Channel name */}
					{SHOW_CHANNEL_NAME && (
						<label htmlFor="channel-name" className="text-base-content text-sm">
							<i className="ph-bold ph-hash mr-1" />
							{channelName === channelId ? "Channel Name" : channelName}
						</label>
					)}

					{/* Channel selector */}
					<div className="relative">
						<button
							type="button"
							className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
							onClick={() => setEncrypted(!encrypted)}
							disabled={!uuid || !localEncryptionKey}
						>
							<i
								className={`ph-bold ${encrypted ? "ph-cloud-slash" : "ph-megaphone"} text-gray-500`}
							/>
						</button>
						<input
							id="channel-name"
							className="input input-ghost pr-10"
							type="text"
							value={localChannelId}
							onChange={(e) => handleChannelChange(e.target.value)}
						/>
					</div>

					{/* Encryption key specification */}
					<div className="relative text-sm text-gray-500">
						<input
							id="channel-name"
							className="input input-ghost pr-10"
							type="text"
							value={localEncryptionKey}
							placeholder="No shared key"
							onChange={(e) => handleEncryptionKeyChange(e.target.value)}
						/>
						{!localEncryptionKey && (
							<button
								type="button"
								className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
								onClick={handleEncryptionKeyCreate}
							>
								<i className="ph-bold ph-plus text-gray-500" />
							</button>
						)}
						{localEncryptionKey && (
							<button
								type="button"
								className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-1 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
								onClick={handleEncryptionKeyClear}
								disabled={!localEncryptionKey}
							>
								<i className="ph-bold ph-x text-gray-500" />
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

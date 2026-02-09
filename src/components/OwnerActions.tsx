import { type AppOwner, Mnemonic } from "@evolu/common";
import { localAuth } from "@evolu/react-web";
import { useEffect, useState } from "react";
import { formatTypeError } from "../lib/helpers";
import { getKeySource, getStoredEthereumAddress } from "../lib/keypair-management";
import { service, useEvolu } from "../lib/local-first";
import { OwnerProfile } from "./OwnerProfile";

export const OwnerActions = () => {
	const evolu = useEvolu();

	const [appOwner, setAppOwner] = useState<AppOwner | undefined>(undefined);
	const [username, setUsername] = useState<string | undefined>(undefined);
	const [showMnemonic, setShowMnemonic] = useState(false);

	useEffect(() => {
		evolu.appOwner.then((result) => {
			setAppOwner(result);
		});

		localAuth.getOwner({ service }).then((result) => {
			setUsername(result?.username);
		});
	}, [evolu]);

	// Restore owner from mnemonic to sync data across devices.
	const handleRestoreAppOwnerClick = () => {
		const mnemonic = window.prompt("Enter your mnemonic to restore your data:");
		if (mnemonic == null) return;

		const result = Mnemonic.from(mnemonic.trim());
		if (!result.ok) {
			alert(formatTypeError(result.error));
			return;
		}

		void evolu.restoreAppOwner(result.value);
	};

	const handleResetAppOwnerClick = () => {
		// Check if user has a derived keypair that would be lost
		const keySource = getKeySource();
		const ethereumAddress = getStoredEthereumAddress();
		
		if (keySource === "derived" && ethereumAddress) {
			const confirmed = confirm(
				`⚠️ Warning: Resetting your mnemonic will make your Ethereum address unrecoverable.\n\n` +
				`Current address: ${ethereumAddress}\n\n` +
				`If you reset:\n` +
				`• Your current Ethereum address will be lost forever\n` +
				`• You won't be able to sign messages with this address\n` +
				`• Other users who know this address won't be able to verify your messages\n\n` +
				`If you want to keep using this address, export your private key first (feature coming soon).\n\n` +
				`Do you still want to reset? This will delete all your local data.`
			);
			if (!confirmed) {
				return;
			}
		}
		
		if (confirm("Are you sure? This will delete all your local data.")) {
			void evolu.resetAppOwner();
		}
	};

	const handleDownloadDatabaseClick = () => {
		void evolu.exportDatabase().then((array) => {
			const blob = new Blob([array], { type: "application/x-sqlite3" });
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "buzz.sqlite3";
			a.click();
			window.URL.revokeObjectURL(url);
		});
	};

	return (
		<div className="mt-8 rounded-lg bg-base-100 p-6 shadow-sm ring-1 ring-base-300">
			<h2 className="mb-4 text-lg font-medium text-base-content">Owner</h2>
			{appOwner && (
				<div className="mb-4 flex items-center justify-between gap-3">
					<OwnerProfile
						{...{
							ownerId: appOwner.id,
							username: username ?? "<no username>",
						}}
					/>
				</div>
			)}
			<p className="mb-4 text-sm text-base-content/70">
				Messages are stored in local SQLite. When you sync across devices, your
				data is end-to-end encrypted using your mnemonic.
			</p>

			<div className="space-y-3">
				<button
					type="button"
					className="btn btn-soft w-full"
					onClick={() => {
						setShowMnemonic(!showMnemonic);
					}}
				>{`${showMnemonic ? "Hide" : "Show"} Mnemonic`}</button>

				{showMnemonic && appOwner?.mnemonic && (
					<div className="bg-base-200 p-3">
						<label
							htmlFor="mnemonic"
							className="mb-2 block text-xs font-medium text-base-content/80"
						>
							Your Mnemonic (keep this safe!)
						</label>
						<textarea
							value={appOwner.mnemonic}
							readOnly
							rows={3}
							className="w-full border-b border-base-300 bg-base-100 px-2 py-1 font-mono text-xs focus:border-primary focus:outline-none"
						/>
					</div>
				)}

				<div className="flex flex-col sm:flex-row w-full gap-2">
					<button
						type="button"
						className="btn btn-soft flex-1"
						onClick={handleRestoreAppOwnerClick}
					>
						Restore from Mnemonic
					</button>
					<button
						type="button"
						className="btn btn-soft flex-1"
						onClick={handleDownloadDatabaseClick}
					>
						Download Backup
					</button>
					<button
						type="button"
						className="btn btn-soft flex-1"
						onClick={handleResetAppOwnerClick}
					>
						Reset All Data
					</button>
				</div>
			</div>
		</div>
	);
};

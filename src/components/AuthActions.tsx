import type { AuthList, OwnerId } from "@evolu/common";
import { localAuth } from "@evolu/react-web";
import { type FC, use, useEffect, useMemo, useState } from "react";
import { service, useEvolu } from "../lib/local-first";
import { OwnerProfile } from "./OwnerProfile";

export const AuthActions: FC = () => {
	const evolu = useEvolu();
	const appOwner = use(evolu.appOwner);

	const [ownerIds, setOwnerIds] = useState<AuthList[]>([]);

	useEffect(() => {
		localAuth.getProfiles({ service }).then((result) => {
			setOwnerIds(
				result?.filter(({ ownerId }) => ownerId !== appOwner?.id) ?? [],
			);
		});
	}, [appOwner?.id]);

	const otherOwnerIds = useMemo(
		() => ownerIds.filter(({ ownerId }) => ownerId !== appOwner?.id),
		[ownerIds, appOwner?.id],
	);

	// Create a new owner and register it to a passkey.
	const handleRegisterClick = async () => {
		const username = window.prompt("Enter your username:");
		if (username == null) return;

		// Determine if this is a guest login or a new owner.
		const authResult = await localAuth.getOwner({ service });
		const isGuest = authResult?.owner === undefined;

		// Register the guest owner or create a new one if this is already registered.
		const result = await localAuth.register(username, {
			service: service,
			mnemonic: isGuest ? appOwner?.mnemonic : undefined,
		});
		if (result) {
			// If this is a guest owner, we should clear the database and reload.
			// The owner is transferred to a new database on next login.
			if (isGuest) {
				void evolu.resetAppOwner({ reload: true });
				// Otherwise, just reload the page
			} else {
				evolu.reloadApp();
			}
		} else {
			alert("Failed to register profile");
		}
	};

	// Login with a specific owner id using the registered passkey.
	// Note: we already have a database created, so we need to reload.
	const handleLoginClick = async (ownerId: OwnerId) => {
		const result = await localAuth.login(ownerId, { service });
		if (result) {
			evolu.reloadApp();
		} else {
			alert("Failed to login");
		}
	};

	// Clear all data including passkeys and metadata.
	const handleClearAllClick = async () => {
		const confirmed = window.confirm(
			"Are you sure you want to clear all data? This will remove all passkeys and cannot be undone.",
		);
		if (!confirmed) return;
		await localAuth.clearAll({ service });
		evolu.resetAppOwner({ reload: true });
	};

	return (
		<div className="mt-8 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
			<h2 className="mb-4 text-lg font-medium text-gray-900">Passkeys</h2>
			<p className="mb-4 text-sm text-gray-600">
				Register a new passkey or choose a previously registered one.
			</p>
			<div className="flex gap-3">
				<button
					type="button"
					className="btn btn-soft flex-1"
					onClick={handleRegisterClick}
				>
					Register Passkey
				</button>
				<button
					type="button"
					className="btn btn-soft flex-1"
					onClick={handleClearAllClick}
				>
					Clear All
				</button>
			</div>
			{otherOwnerIds.length > 0 && (
				<div className="mt-4 flex flex-col gap-2">
					{otherOwnerIds.map(({ ownerId, username }) => (
						<OwnerProfile
							key={ownerId}
							{...{ ownerId, username, handleLoginClick }}
						/>
					))}
				</div>
			)}
		</div>
	);
};

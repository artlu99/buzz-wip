import {
	type AppOwner,
	NonEmptyString100,
	String100,
	String1000,
} from "@evolu/common";
import { useQuery } from "@evolu/react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useZustand } from "../hooks/use-zustand";
import { useEvolu, usersQuery } from "../lib/local-first";

export const ProfileEditor = () => {
	const [, navigate] = useLocation();
	const evolu = useEvolu();

	const { insert, update } = useEvolu();
	const { user, setUser, uuid } = useZustand();

	const [appOwner, setAppOwner] = useState<AppOwner | undefined>(undefined);
	const [displayName, setDisplayName] = useState(user.displayName);
	const [pfpUrl, setPfpUrl] = useState(user.pfpUrl);
	const [bio, setBio] = useState(user.bio);
	const [status, setStatus] = useState(user.status ?? "");
	const [publicNtfyShId, setPublicNtfyShId] = useState(
		user.publicNtfyShId ?? "",
	);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		evolu.appOwner.then((result) => {
			setAppOwner(result);
		});
	}, [evolu]);

	// Query existing user data from database
	const networkUuid = NonEmptyString100.orThrow(
		appOwner?.id ?? "uninitialized",
	);
	const existingUser = useQuery(usersQuery(networkUuid));

	// Update form fields when user data changes
	useEffect(() => {
		if (existingUser && existingUser.length > 0) {
			const userData = existingUser[0];
			setDisplayName(userData.displayName ?? user.displayName);
			setPfpUrl(userData.pfpUrl ?? user.pfpUrl);
			setBio(userData.bio ?? user.bio);
			setStatus(userData.status ?? user.status);
			setPublicNtfyShId(userData.publicNtfyShId ?? user.publicNtfyShId);
		}
	}, [
		existingUser,
		user.displayName,
		user.pfpUrl,
		user.bio,
		user.status,
		user.publicNtfyShId,
	]);

	const handleSave = async () => {
		if (!networkUuid || !uuid) {
			alert("Please log in to save your profile");
			return;
		}

		setIsSaving(true);

		try {
			const networkUuidStr = NonEmptyString100.orThrow(networkUuid);
			const displayNameTrimmed = (displayName.trim() || "Anonymous").slice(
				0,
				100,
			);
			const pfpUrlTrimmed = pfpUrl.trim().slice(0, 1000);
			const bioTrimmed = bio.trim().slice(0, 1000);
			const statusTrimmed = status.trim().slice(0, 100);
			const publicNtfyShIdTrimmed = publicNtfyShId.trim().slice(0, 100);

			// String100 and String1000 are nullable types, so empty strings should be fine
			// We'll use orThrow to ensure type safety, but provide defaults for empty strings
			const displayNameStr = String100.orThrow(displayNameTrimmed);
			const pfpUrlStr = pfpUrlTrimmed
				? String1000.orThrow(pfpUrlTrimmed)
				: String1000.orThrow("");
			const bioStr = bioTrimmed
				? String1000.orThrow(bioTrimmed)
				: String1000.orThrow("");
			const statusStr = statusTrimmed
				? String100.orThrow(statusTrimmed)
				: String100.orThrow("");
			const publicNtfyShIdStr = publicNtfyShIdTrimmed
				? String100.orThrow(publicNtfyShIdTrimmed)
				: String100.orThrow("");

			// Check if user already exists
			if (existingUser && existingUser.length > 0) {
				const userId = existingUser[0].id;
				// Update existing user
				update("user", {
					id: userId,
					displayName: displayNameStr,
					pfpUrl: pfpUrlStr,
					bio: bioStr,
					status: statusStr,
					publicNtfyShId: publicNtfyShIdStr,
				});
			} else {
				// Insert new user
				const result = insert("user", {
					networkUuid: networkUuidStr,
					displayName: displayNameStr,
					pfpUrl: pfpUrlStr,
					bio: bioStr,
					status: statusStr,
					publicNtfyShId: publicNtfyShIdStr,
					privateNtfyShId: String100.orThrow(""),
				});

				if (!result.ok) {
					console.error("Failed to insert user", result.error);
					alert("Failed to save profile");
					return;
				}
			}

			// Update Zustand store
			setUser(displayNameStr, pfpUrlStr, bioStr, publicNtfyShIdStr);
		} catch (error) {
			console.error("Error saving profile:", error);
			alert("Failed to save profile. Please check your inputs.");
		} finally {
			setIsSaving(false);
			navigate("/");
		}
	};

	if (!networkUuid) {
		return (
			<div className="mt-8 rounded-lg bg-base-100 p-6 shadow-sm ring-1 ring-base-300">
				<p className="text-sm text-base-content/70">
					Please log in to edit your profile.
				</p>
			</div>
		);
	}

	return (
		<div className="mt-8 rounded-lg bg-base-100 p-6 shadow-sm ring-1 ring-base-300">
			{/* Save Button */}
			<button
				type="button"
				onClick={handleSave}
				disabled={isSaving}
				className="btn btn-primary w-full"
			>
				{isSaving ? "Saving..." : "Save Profile"}
			</button>

			<h2 className="my-4 text-lg font-medium text-base-content">Profile</h2>

			<div className="space-y-4">
				{/* Profile Picture */}
				<div>
					<div className="flex items-center gap-4">
						{pfpUrl ? (
							<img
								src={pfpUrl}
								alt="Profile"
								className="h-20 w-20 rounded-full object-cover ring-2 ring-base-300"
							/>
						) : (
							<div className="flex h-20 w-20 items-center justify-center rounded-full bg-base-200 text-base-content/50">
								No Image
							</div>
						)}
						<div className="flex-1">
							<p className="mt-1 text-xs text-base-content/50">Enter a URL:</p>
							<input
								type="url"
								value={pfpUrl}
								onChange={(e) => setPfpUrl(e.target.value)}
								placeholder="https://example.com/image.jpg"
								className="mt-1 block w-full rounded-md border-base-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
							/>
						</div>
					</div>
				</div>

				{/* Display Name */}
				<div>
					<label
						htmlFor="displayName"
						className="mb-2 block text-sm font-medium text-base-content/80"
					>
						Display Name
					</label>
					<input
						type="text"
						id="displayName"
						value={displayName}
						onChange={(e) => setDisplayName(e.target.value)}
						maxLength={100}
						placeholder="Enter your display name"
						className="block w-full rounded-md border-base-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
					/>
				</div>

				{/* Bio */}
				<div>
					<label
						htmlFor="bio"
						className="mb-2 block text-sm font-medium text-base-content/80"
					>
						Bio
					</label>
					<textarea
						id="bio"
						value={bio}
						onChange={(e) => setBio(e.target.value)}
						maxLength={1000}
						rows={4}
						placeholder="Tell us about yourself..."
						className="block w-full rounded-md border-base-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
					/>
					<p className="mt-1 text-xs text-base-content/50">
						{bio.length}/1000 characters
					</p>
				</div>

				{/* Status */}

				<div>
					<label
						htmlFor="status"
						className="mb-2 block text-sm font-medium text-base-content/80"
					>
						Status
					</label>
					<input
						type="text"
						id="status"
						value={status}
						onChange={(e) => setStatus(e.target.value)}
						maxLength={100}
						placeholder="Update your status"
						className="block w-full rounded-md border-base-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
					/>
				</div>

				{/* Public Notification Channel */}
				<div>
					<label
						htmlFor="publicNtfyShId"
						className="mb-2 block text-sm font-medium text-base-content/80"
					>
						Notification Channels
					</label>
					<input
						type="text"
						id="publicNtfyShId"
						value={publicNtfyShId}
						onChange={(e) => setPublicNtfyShId(e.target.value)}
						maxLength={100}
						placeholder="Enter your public notification channel ID"
						className="block w-full rounded-md border-base-300 shadow-sm focus:border-primary focus:ring-primary sm:text-sm"
					/>
				</div>
			</div>
		</div>
	);
};

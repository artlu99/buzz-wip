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
		}
	}, [existingUser, user.displayName, user.pfpUrl, user.bio]);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Check if it's an image
		if (!file.type.startsWith("image/")) {
			alert("Please select an image file");
			return;
		}

		// Create a data URL from the file
		const reader = new FileReader();
		reader.onloadend = () => {
			const dataUrl = reader.result as string;
			setPfpUrl(dataUrl);
		};
		reader.readAsDataURL(file);
	};

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

			// String100 and String1000 are nullable types, so empty strings should be fine
			// We'll use orThrow to ensure type safety, but provide defaults for empty strings
			const displayNameStr = String100.orThrow(displayNameTrimmed);
			const pfpUrlStr = pfpUrlTrimmed
				? String1000.orThrow(pfpUrlTrimmed)
				: String1000.orThrow("");
			const bioStr = bioTrimmed
				? String1000.orThrow(bioTrimmed)
				: String1000.orThrow("");

			// Check if user already exists
			if (existingUser && existingUser.length > 0) {
				const userId = existingUser[0].id;
				// Update existing user
				update("user", {
					id: userId,
					displayName: displayNameStr,
					pfpUrl: pfpUrlStr,
					bio: bioStr,
				});
			} else {
				// Insert new user
				const result = insert("user", {
					networkUuid: networkUuidStr,
					displayName: displayNameStr,
					pfpUrl: pfpUrlStr,
					bio: bioStr,
				});

				if (!result.ok) {
					console.error("Failed to insert user", result.error);
					alert("Failed to save profile");
					return;
				}
			}

			// Update Zustand store
			setUser(displayNameStr, pfpUrlStr, bioStr);
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
			<div className="mt-8 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
				<p className="text-sm text-gray-600">
					Please log in to edit your profile.
				</p>
			</div>
		);
	}

	return (
		<div className="mt-8 rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
			<h2 className="mb-4 text-lg font-medium text-gray-900">Profile</h2>

			<div className="space-y-4">
				{/* Profile Picture */}
				<div>
					<div className="flex items-center gap-4">
						{pfpUrl ? (
							<img
								src={pfpUrl}
								alt="Profile"
								className="h-20 w-20 rounded-full object-cover ring-2 ring-gray-200"
							/>
						) : (
							<div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-gray-500">
								No Image
							</div>
						)}
						<div className="flex-1">
							<input
								type="file"
								id="pfp"
								accept="image/*"
								onChange={handleFileChange}
								className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
							/>
							<p className="mt-1 text-xs text-gray-500">Or enter a URL:</p>
							<input
								type="url"
								value={pfpUrl}
								onChange={(e) => setPfpUrl(e.target.value)}
								placeholder="https://example.com/image.jpg"
								className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							/>
						</div>
					</div>
				</div>

				{/* Display Name */}
				<div>
					<label
						htmlFor="displayName"
						className="mb-2 block text-sm font-medium text-gray-700"
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
						className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
					/>
				</div>

				{/* Bio */}
				<div>
					<label
						htmlFor="bio"
						className="mb-2 block text-sm font-medium text-gray-700"
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
						className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
					/>
					<p className="mt-1 text-xs text-gray-500">
						{bio.length}/1000 characters
					</p>
				</div>

				{/* Save Button */}
				<button
					type="button"
					onClick={handleSave}
					disabled={isSaving}
					className="btn btn-primary w-full"
				>
					{isSaving ? "Saving..." : "Save Profile"}
				</button>
			</div>
		</div>
	);
};

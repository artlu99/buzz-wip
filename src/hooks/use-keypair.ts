import type { Mnemonic } from "@evolu/common";
import { useEffect, useState } from "react";
import type { EthereumAccount } from "../lib/crypto-keys";
import {
	generateKeypair,
	getActiveKeypair,
	getKeySource,
	hasKeypair,
	importKeypair,
	type KeySource,
	useDerivedKeypair,
} from "../lib/keypair-management";
import { useEvolu } from "../lib/local-first";

interface UseKeypairReturn {
	account: EthereumAccount | null;
	isLoading: boolean;
	source: KeySource | undefined;
	address: `0x${string}` | null;
	generateNew: () => Promise<void>;
	importKey: (privateKey: string) => Promise<void>;
	useDerived: () => Promise<void>;
	error: string | null;
}

/**
 * Hook for accessing and managing the active Ethereum keypair.
 * 
 * Features:
 * - Auto-generates keypair if none exists
 * - Tries to derive from mnemonic first, then generates if needed
 * - Provides unified interface for all key sources
 * - Handles key import and generation
 * 
 * @returns UseKeypairReturn with account, loading state, and management functions
 */
export function useKeypair(): UseKeypairReturn {
	const evolu = useEvolu();
	const [account, setAccount] = useState<EthereumAccount | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [source, setSource] = useState<KeySource | undefined>(undefined);

	// Load keypair on mount and when dependencies change
	useEffect(() => {
		let cancelled = false;

		async function loadKeypair() {
			setIsLoading(true);
			setError(null);

			try {
				// Try to get mnemonic from Evolu
				let mnemonic: Mnemonic | undefined;
				try {
					const appOwner = await evolu.appOwner;
					mnemonic = appOwner?.mnemonic ?? undefined;
				} catch {
					// No mnemonic available - that's okay, we'll generate
					console.log("No mnemonic available, will generate keypair if needed");
				}

				// Try to get active keypair
				let activeAccount = await getActiveKeypair(mnemonic);

				// If no keypair exists, auto-generate one
				if (!activeAccount && !hasKeypair()) {
					console.log("No keypair found, auto-generating...");
					activeAccount = await generateKeypair();
				}

				if (cancelled) return;

				setAccount(activeAccount);
				setSource(getKeySource());
			} catch (err) {
				if (cancelled) return;
				const errorMessage = err instanceof Error ? err.message : "Failed to load keypair";
				console.error("Error loading keypair:", err);
				setError(errorMessage);
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}

		void loadKeypair();

		return () => {
			cancelled = true;
		};
	}, [evolu]);

	const generateNew = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const newAccount = await generateKeypair();
			setAccount(newAccount);
			setSource(getKeySource());
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Failed to generate keypair";
			console.error("Error generating keypair:", err);
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	const importKey = async (privateKey: string) => {
		setIsLoading(true);
		setError(null);
		try {
			const importedAccount = await importKeypair(privateKey);
			setAccount(importedAccount);
			setSource(getKeySource());
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Failed to import keypair";
			console.error("Error importing keypair:", err);
			setError(errorMessage);
			throw err; // Re-throw so caller can handle
		} finally {
			setIsLoading(false);
		}
	};

	const useDerived = async () => {
		setIsLoading(true);
		setError(null);
		try {
			let mnemonic: string | undefined;
			try {
				const appOwner = await evolu.appOwner;
				mnemonic = appOwner?.mnemonic ?? undefined;
			} catch {
				// No mnemonic available
			}
			
			if (!mnemonic) {
				throw new Error("No mnemonic available to derive keypair from");
			}
			
			// useDerivedKeypair is not a React hook, it's a regular async function
			// The "use" prefix is misleading but we keep it for API consistency
			const deriveKeypair = useDerivedKeypair;
			const derivedAccount = await deriveKeypair(mnemonic);
			if (!derivedAccount) {
				throw new Error("Failed to derive keypair from mnemonic");
			}
			setAccount(derivedAccount);
			setSource(getKeySource());
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : "Failed to use derived keypair";
			console.error("Error using derived keypair:", err);
			setError(errorMessage);
		} finally {
			setIsLoading(false);
		}
	};

	return {
		account,
		isLoading,
		source,
		address: account?.address ?? null,
		generateNew,
		importKey,
		useDerived,
		error,
	};
}


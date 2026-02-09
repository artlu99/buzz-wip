import type { Mnemonic } from "@evolu/common";
import { bytesToHex, getAddress, hexToBytes } from "viem";
import { type PrivateKeyAccount, privateKeyToAccount } from "viem/accounts";
import { useZustand } from "../hooks/use-zustand";
import { deriveAccountFromMnemonic, type EthereumAccount } from "./crypto-keys";
import { Base64ToUint8Array, uint8ArrayToBase64 } from "./helpers";

export type KeySource = "derived" | "imported" | "generated";

export interface KeypairState {
	source: KeySource | undefined;
	importedPrivateKey: string | undefined; // base64-encoded encrypted private key
	generatedPrivateKey: string | undefined; // base64-encoded encrypted private key
	ethereumAddress: `0x${string}` | undefined;
}

/**
 * Simple encryption/decryption for private keys stored in localStorage.
 * This is a basic obfuscation - in production, consider using Web Crypto API
 * with a user-provided password or browser keychain.
 */
function encryptPrivateKey(privateKey: `0x${string}`): string {
	// For now, we'll store as base64-encoded hex string
	// In a production app, you'd want proper encryption with Web Crypto API
	// This is just obfuscation - localStorage is not secure for sensitive data
	const bytes = hexToBytes(privateKey);
	return uint8ArrayToBase64(bytes);
}

function decryptPrivateKey(encrypted: string): `0x${string}` {
	// Decode from base64 back to hex
	const bytes = Base64ToUint8Array(encrypted);
	return bytesToHex(bytes) as `0x${string}`;
}

/**
 * Generates a new random Ethereum keypair.
 * 
 * @returns EthereumAccount with the generated account
 */
export async function generateKeypair(): Promise<EthereumAccount> {
	// Generate 32 random bytes for private key
	const randomBytes = new Uint8Array(32);
	crypto.getRandomValues(randomBytes);
	
	// Convert to hex string with 0x prefix
	const privateKey = bytesToHex(randomBytes) as `0x${string}`;
	
	// Create account from private key
	const account = privateKeyToAccount(privateKey);
	const address = getAddress(account.address);
	
	// Encrypt and store in Zustand
	const encrypted = encryptPrivateKey(privateKey);
	useZustand.getState().setKeypair({
		source: "generated",
		generatedPrivateKey: encrypted,
		ethereumAddress: address,
	});
	
	return {
		account: account as unknown as PrivateKeyAccount,
		address,
	};
}

/**
 * Imports a keypair from a user-provided private key.
 * 
 * @param privateKey - The private key as hex string (0x-prefixed or not)
 * @returns EthereumAccount with the imported account
 * @throws Error if private key is invalid
 */
export async function importKeypair(privateKey: string): Promise<EthereumAccount> {
	// Normalize private key format
	let normalizedKey: `0x${string}`;
	if (privateKey.startsWith("0x")) {
		normalizedKey = privateKey as `0x${string}`;
	} else {
		normalizedKey = `0x${privateKey}` as `0x${string}`;
	}
	
	// Validate length (64 hex chars = 32 bytes)
	if (normalizedKey.length !== 66) {
		throw new Error("Invalid private key length. Must be 64 hex characters (32 bytes).");
	}
	
	// Try to create account to validate the key
	let account: PrivateKeyAccount;
	try {
		account = privateKeyToAccount(normalizedKey);
	} catch (error) {
		throw new Error(`Invalid private key: ${error instanceof Error ? error.message : "Unknown error"}`);
	}
	
	const address = getAddress(account.address);
	
	// Encrypt and store in Zustand
	const encrypted = encryptPrivateKey(normalizedKey);
	useZustand.getState().setKeypair({
		source: "imported",
		importedPrivateKey: encrypted,
		ethereumAddress: address,
	});
	
	return {
		account: account as unknown as PrivateKeyAccount,
		address,
	};
}

/**
 * Gets the active keypair based on the current keypair state.
 * Priority: imported > generated > derived from mnemonic
 * 
 * @param mnemonic - Optional mnemonic to derive from if no imported/generated key exists
 * @returns EthereumAccount or null if no keypair can be obtained
 */
export async function getActiveKeypair(mnemonic?: Mnemonic): Promise<EthereumAccount | null> {
	const keypairState = useZustand.getState().keypair;
	
	// Priority 1: Use imported key if available
	if (keypairState.source === "imported" && keypairState.importedPrivateKey) {
		try {
			const privateKey = decryptPrivateKey(keypairState.importedPrivateKey);
			const account = privateKeyToAccount(privateKey);
			const address = getAddress(account.address);
			
			// Update address if it changed (shouldn't happen, but sync state)
			if (address !== keypairState.ethereumAddress) {
				useZustand.getState().setKeypair({ ethereumAddress: address });
			}
			
			return {
				account: account as unknown as PrivateKeyAccount,
				address,
			};
		} catch (error) {
			console.error("Failed to decrypt imported private key:", error);
			// Fall through to try other sources
		}
	}
	
	// Priority 2: Use generated key if available
	if (keypairState.source === "generated" && keypairState.generatedPrivateKey) {
		try {
			const privateKey = decryptPrivateKey(keypairState.generatedPrivateKey);
			const account = privateKeyToAccount(privateKey);
			const address = getAddress(account.address);
			
			// Update address if it changed
			if (address !== keypairState.ethereumAddress) {
				useZustand.getState().setKeypair({ ethereumAddress: address });
			}
			
			return {
				account: account as unknown as PrivateKeyAccount,
				address,
			};
		} catch (error) {
			console.error("Failed to decrypt generated private key:", error);
			// Fall through to try derivation
		}
	}
	
	// Priority 3: Derive from mnemonic if available
	if (mnemonic) {
		try {
			const account = await deriveAccountFromMnemonic(mnemonic);
			
			// Check if mnemonic changed (address mismatch with stored derived address)
			if (keypairState.source === "derived" && 
			    keypairState.ethereumAddress && 
			    keypairState.ethereumAddress !== account.address) {
				// Mnemonic was reset - old address is now unrecoverable
				console.warn(
					"Mnemonic changed - old Ethereum address is unrecoverable. " +
					`Old: ${keypairState.ethereumAddress}, New: ${account.address}. Migrating to new address.`
				);
				useZustand.getState().setKeypair({
					source: "derived",
					ethereumAddress: account.address,
					// Clear any old imported/generated keys since we're using derived now
					importedPrivateKey: undefined,
					generatedPrivateKey: undefined,
				});
			} else if (keypairState.source !== "derived") {
				// Switching to derived from imported/generated
				useZustand.getState().setKeypair({
					source: "derived",
					ethereumAddress: account.address,
					// Don't clear imported/generated keys - user might want to switch back
				});
			} else if (account.address !== keypairState.ethereumAddress) {
				// Address changed but source is already derived (shouldn't happen, but sync state)
				useZustand.getState().setKeypair({ ethereumAddress: account.address });
			}
			
			return account;
		} catch (error) {
			console.error("Failed to derive account from mnemonic:", error);
			
			// If derivation fails and we have a derived keypair, it's stranded
			if (keypairState.source === "derived" && keypairState.ethereumAddress) {
				console.warn(
					"Derived keypair is stranded (mnemonic reset or unavailable). " +
					`Stranded address: ${keypairState.ethereumAddress}. Clearing state.`
				);
				useZustand.getState().setKeypair({
					source: undefined,
					ethereumAddress: undefined,
					importedPrivateKey: undefined,
					generatedPrivateKey: undefined,
				});
			}
		}
	}
	
	return null;
}

/**
 * Switches back to using the derived keypair from mnemonic.
 * Clears imported/generated keys from active use.
 * 
 * @param mnemonic - The mnemonic to derive from
 * @returns EthereumAccount or null if derivation fails
 */
export async function useDerivedKeypair(mnemonic: string): Promise<EthereumAccount | null> {
	try {
		const account = await deriveAccountFromMnemonic(mnemonic);
		
		useZustand.getState().setKeypair({
			source: "derived",
			importedPrivateKey: undefined,
			generatedPrivateKey: undefined,
			ethereumAddress: account.address,
		});
		
		return account;
	} catch (error) {
		console.error("Failed to derive account from mnemonic:", error);
		return null;
	}
}

/**
 * Gets the current key source.
 * 
 * @returns KeySource or undefined if no keypair is configured
 */
export function getKeySource(): KeySource | undefined {
	return useZustand.getState().keypair.source;
}

/**
 * Checks if a keypair exists (any source).
 * 
 * @returns true if a keypair is configured
 */
export function hasKeypair(): boolean {
	const keypair = useZustand.getState().keypair;
	return (
		keypair.source !== undefined ||
		keypair.importedPrivateKey !== undefined ||
		keypair.generatedPrivateKey !== undefined ||
		keypair.ethereumAddress !== undefined
	);
}

/**
 * Gets the stored Ethereum address if available.
 * 
 * @returns Ethereum address or undefined
 */
export function getStoredEthereumAddress(): `0x${string}` | undefined {
	return useZustand.getState().keypair.ethereumAddress;
}


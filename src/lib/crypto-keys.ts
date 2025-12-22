import { mnemonicToAccount, type PrivateKeyAccount } from "viem/accounts";
import { getAddress } from "viem/utils";

/**
 * Derivation path for Ethereum keys: m/44'/60'/0'/0/0 (BIP-44 standard)
 */
export const DERIVATION_PATH = "m/44'/60'/0'/0/0";

/**
 * Ethereum account derived from mnemonic.
 */
export interface EthereumAccount {
	account: PrivateKeyAccount; // viem account object containing address and signing methods
	address: `0x${string}`; // Ethereum address (0x-prefixed, 20 bytes)
}

/**
 * Derives an Ethereum account from a BIP-39 mnemonic phrase.
 * Uses BIP-44 derivation path m/44'/60'/0'/0/0 (standard Ethereum path).
 * 
 * @param mnemonic - BIP-39 mnemonic phrase (12 or 24 words)
 * @returns EthereumAccount with account object and address
 * @throws Error if mnemonic is invalid
 */
export async function deriveAccountFromMnemonic(
	mnemonic: string,
): Promise<EthereumAccount> {
	const account = mnemonicToAccount(mnemonic, { path: DERIVATION_PATH });
	return {
		account: account as unknown as PrivateKeyAccount,
		address: getAddress(account.address),
	};
}

/**
 * Extracts the Ethereum address from an EthereumAccount.
 * 
 * @param account - The EthereumAccount to extract address from
 * @returns The Ethereum address (0x-prefixed hex string)
 */
export function getEthereumAddress(account: EthereumAccount): `0x${string}` {
	return account.address;
}


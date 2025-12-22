# Message Verification - Implementation Specification

## Overview

This specification describes how to add cryptographic signatures to the existing message types (`TextMessage`, `ReactionMessage`, `DeleteMessage`) to enable verification of message authenticity and integrity. This builds upon the existing WebSocket-based messaging infrastructure, Evolu local-first database, and symmetric encryption layer.

**Backward Compatibility:** This verification system is designed to be fully backward compatible. Messages without signatures or with failed verification are displayed identically to unverified messages in the current system. Verification is an **additive enhancement** - it never breaks existing functionality:
- **No signature present:** Message is displayed as unverified (same as current behavior)
- **Verification fails:** Message is displayed as unverified (same as current behavior)
- **Verification succeeds:** Message is displayed with verified indicator (new enhancement)
This allows gradual adoption without breaking changes, while anticipating a graceful deprecation path followed by strictness tightening.

**Key Architectural Decisions:**
- **Identity System:** UUID (from Evolu) remains primary identifier; Ethereum address stored in user object
- **Signing Method:** EIP-712 typed data signatures
- **Cryptographic Library:** `viem` (not Web Crypto API)
- **Key Derivation:** Private keys derived from Evolu mnemonic (no storage) using BIP-44 path `m/44'/60'/0'/0/0`

**Implementation Decisions:**
1. **Ethereum Address Storage:** Store Ethereum address (not public key) in user schema - sufficient for verification
2. **Signature Placement:** Signatures inside encrypted payload (when encryption enabled) - better privacy, requires decryption for verification
3. **Verification Status:** Stored in component state only (not database) - maintains single source of truth, can revisit later if performance suffers
4. **Account Caching:** Derived account cached in component state, session-only, NOT persisted - fresh derivation on each app load

## 1. Data Models

### 1.1. MessageEnvelope
The canonical, serializable data structure that constitutes the payload to be signed. This is derived from the existing message structure.

```typescript
interface MessageEnvelope {
  sender: string;              // The UUID of the sender (existing `uuid` field).
  timestamp: number;           // Unix timestamp in seconds (from `networkTimestamp`).
  channelId: string;           // The channel identifier.
  networkMessageId: string;    // The unique message identifier (existing field).
  messageType: WsMessageType; // The type of message (TEXT, REACTION, DELETE).
  content: string;            // Message-specific content:
                               // - For TEXT: the message content
                               // - For REACTION: the reaction emoji/string
                               // - For DELETE: the networkMessageId being deleted
}
```

**Independent Verification:** Each message is verified independently based solely on its signature. No prior message context required for verification.

### 1.2. Signature Field
All message types that support verification include optional signature field:

```typescript
// Updated message types (add to existing interfaces)
interface TextMessage extends BaseWsMessage {
  // ... existing fields ...
  signature: string | null;  // The 65-byte ECDSA signature (0x-prefixed hex string).
}

interface ReactionMessage extends BaseWsMessage {
  // ... existing fields ...
  signature: string | null;  // The 65-byte ECDSA signature.
}

interface DeleteMessage extends BaseWsMessage {
  // ... existing fields ...
  signature: string | null;   // Already exists as placeholder, now will contain actual signature.
}
```

## 2. Core Protocols & Algorithms

### 2.1. Cryptographic Key Management

**Architectural Decision:** hybrid identity model:
- **UUID** (inherited from Evolu) remains primary user identifier for all application logic
- **Ethereum address** stored in the user object for cryptographic operations
- **EIP-712 typed signatures** for message signing
- **viem library** for all Ethereum-related operations (not Web Crypto API)

**Key Derivation (No Storage Required):**
- **Derive private key from Evolu mnemonic** using BIP-32/BIP-44 hierarchical deterministic (HD) wallet derivation
- Use `viem`'s `mnemonicToAccount()` function with a specific derivation path
- The same mnemonic + same derivation path = same private key (deterministic)
- **No private key storage needed** - derive on-demand from the mnemonic
- Derive Ethereum address from the private key using `viem` (`getAddress()`)
- **Store the Ethereum address** (not public key) in the Evolu user schema
- The UUID remains the primary identifier; Ethereum address is used only for signature verification
- For verification: compare recovered address from signature to stored address (no public key needed)

**Derivation Path:**
- Use BIP-44 standard path for Ethereum: `m/44'/60'/0'/0/0`
  - `44'` = BIP-44 purpose
  - `60'` = Ethereum coin type
  - `0'` = Account index (0 for primary account)
  - `0` = Change chain (0 for external)
  - `0` = Address index (0 for first address)
- This path is standard and ensures compatibility with other Ethereum tools

**Key Storage:**
- **Private keys are NOT stored** - derived on-demand from Evolu mnemonic
- The Evolu mnemonic is already stored securely by Evolu (encrypted, user-controlled)
- Ethereum address MUST be stored in Evolu `user` schema and associated with UUID (for verification lookup)
- Key derivation functions MUST be deterministic and consistent across clients (using `viem` with fixed derivation path)

**Key Derivation Specification:**
```typescript
import { mnemonicToAccount, type PrivateKeyAccount } from 'viem/accounts';

// Derivation path: m/44'/60'/0'/0/0 (BIP-44 standard for Ethereum)
const DERIVATION_PATH = "m/44'/60'/0'/0/0";

interface EthereumAccount {
  account: PrivateKeyAccount; // viem account object containing address and signing methods
  address: `0x${string}`;     // Ethereum address (0x-prefixed, 20 bytes)
}

// Derive account from Evolu mnemonic (no private key storage needed)
function deriveAccountFromMnemonic(mnemonic: string): EthereumAccount {
  // viem's mnemonicToAccount derives using BIP-44 path automatically
  // For custom path, use: mnemonicToAccount(mnemonic, { path: DERIVATION_PATH })
  const account = mnemonicToAccount(mnemonic);
  
  return {
    account,
    address: account.address,
  };
}

// Access Evolu mnemonic from appOwner
const appOwner = await evolu.appOwner;
const mnemonic = appOwner.mnemonic;  // BIP-39 mnemonic string
const ethereumAccount = deriveAccountFromMnemonic(mnemonic);
```

**Accessing Evolu Mnemonic:**
```typescript
import { useEvolu } from '../lib/local-first';

// In component or hook
const evolu = useEvolu();
const appOwner = await evolu.appOwner;
const mnemonic = appOwner.mnemonic;  // BIP-39 mnemonic string (12 or 24 words)

// Derive Ethereum account
const ethereumAccount = deriveAccountFromMnemonic(mnemonic);
```

**Benefits of Mnemonic-Based Derivation:**
- **No private key storage** - reduces attack surface (private key never persisted)
- **Deterministic** - same mnemonic + same derivation path = same keys every time
- **Cross-device compatible** - restore on any device with mnemonic (same keys derived)
- **Single source of truth** - Evolu mnemonic is the only secret to protect (already secured by Evolu)
- **Standard derivation** - BIP-44 path compatible with Ethereum ecosystem tools
- **Simplified key management** - no need for separate key storage/encryption infrastructure

**User Schema Addition:**
- Add `ethereumAddress: string` field to the Evolu `user` schema
- This field stores the hex-encoded Ethereum address (0x-prefixed, 20 bytes)
- The UUID remains the primary key; Ethereum address is a lookup field for verification
- **Decision:** Store address (not public key) - simpler and sufficient for verification (compare recovered address to stored address)

### 2.2. Message Sending Protocol
Executed when a user composes and sends a new message (extends existing `MessageSender.tsx` logic).

0.  **Derive Account:** (Before sending any message)
    - Get Evolu mnemonic from `evolu.appOwner.mnemonic`
    - Derive Ethereum account using `deriveAccountFromMnemonic(mnemonic)` (see section 2.1)
    - **Cache the account object in component state for the session only**
    - **Do NOT persist the account object** - derive fresh on each app load
    - Cache is cleared when component unmounts or user logs out
    - Check for known leaks from session memory

1.  **Input:** A message payload (TEXT, REACTION, or DELETE) from the user.
2.  **Construct Envelope:** Create a `MessageEnvelope` object:
    ```typescript
    const envelope: MessageEnvelope = {
      sender: uuid,  // Current user's UUID
      timestamp: Math.floor(Date.now() / 1000),
      channelId: channelId,
      networkMessageId: networkMessageId,  // Already generated in MessageSender
      messageType: WsMessageType.TEXT,  // or REACTION, DELETE
      content: content,  // Message-specific content
    };
    ```
3.  **Sign Envelope:** 
    - **EIP-712 Typed Data Signing:** Use the derived account's `signTypedData()` method:
      - Domain: `EIP712_DOMAIN` from section 3.2
      - Types: `EIP712_TYPES` from section 3.2
      - Primary Type: `"MessageEnvelope"`
      - Message: The `MessageEnvelope` object
    - **Important:** Do NOT use raw Keccak-256 hashing. EIP-712 provides structured data signing which includes domain separation and type safety.
    - The signature is generated using `account.signTypedData()` - the account object contains the derived private key (from mnemonic) but the private key itself is never exposed or stored.
    - The domain and types MUST be consistent across all clients (see section 3.2).
4.  **Assemble Message:** Add the `signature` field to the existing message object:
    ```typescript
    const textMessage: TextMessage = {
      // ... existing fields ...
      signature: signature  // Add the generated signature
    };
    ```
5.  **Transmit:** Send via existing `socketClient.safeSend()` (encryption layer applies as before).
    - **Decision:** Signature is inside the encrypted payload (when encryption is enabled)
    - This means verification requires decryption first, but keeps signature hidden for better privacy. Encrypted message does not reveal information about the signer.
6.  **Store:** The message is already stored in Evolu database via existing handlers.

### 2.3. Message Receiving & Verification Protocol
Executed upon receiving a message from a peer (extends existing handlers: `TextMessageHandler.tsx`, `ReactionMessageHandler.tsx`, `DeleteMessageHandler.tsx`).

1.  **Parse:** Deserialize the incoming message (already handled by existing handlers).
2.  **Check for Signature:**
    - If `message.signature` is `null` or `undefined`, mark message as "unverified" and proceed with normal processing (backward compatibility).
    - **Fallback behavior:** Messages without signatures are displayed identically to current unverified messages - no UI changes, no breaking behavior.
    - If `message.signature` exists, proceed to verification.
3.  **Reconstruct Envelope:**
    - Build the `MessageEnvelope` from the received message fields.
4.  **Verify Timestamp Policy:** (Perform this check BEFORE signature verification for efficiency)
    a. Get current system time: `now = Math.floor(Date.now() / 1000)`.
    b. Use `WINDOW_PAST` and `WINDOW_FUTURE` from constants (section 3.1).
    c. If `envelope.timestamp < (now - WINDOW_PAST)` OR `envelope.timestamp > (now + WINDOW_FUTURE)`, mark as "out of policy timestamp" and log warning. Skip signature verification (save computation). Continue processing but mark as unverified.
5.  **Verify Signature:**
    a. **Recover Signer Address:** Use `viem`'s `recoverTypedDataAddress()` function:
       - Domain: `EIP712_DOMAIN` from section 3.2
       - Types: `EIP712_TYPES` from section 3.2
       - Primary Type: `"MessageEnvelope"`
       - Message: The reconstructed `MessageEnvelope` object
       - Signature: The `message.signature` field (extracted from decrypted payload if encrypted)
       - This returns the Ethereum address (`0x${string}`) of the signer
    b. **Lookup User by UUID:** Query the Evolu database for the user with `networkUuid` matching `envelope.sender` (message `uuid`). This leverages existing database indices for UUID lookups.
    c. **Compare Addresses:** Compare the stored `ethereumAddress` from the user record to the recovered address from the signature.
    d. If verification fails (user not found, no `ethereumAddress` stored, or recovered address doesn't match stored address), mark message as "invalid signature" and log warning. Continue processing (don't block, but mark as unverified).
    e. **Fallback behavior:** Messages with failed verification are displayed identically to unverified messages - same UI, same functionality. Verification failure is logged but does not affect message display or processing.
6.  **All Checks Passed:**
    a. Mark message as "verified" (store verification status in component state only).
    b. Store message in Evolu database (existing logic).
    c. Display message to user with verification indicator (✓ verified, ⚠ unverified, ✗ invalid).
    d. **Decision:** Verification status stored in component state (not database) - maintains single source of truth, can re-verify on load if needed, can revisit for performance optimization later

**Backward Compatibility Guarantee:**
- **No signature:** Message displayed as unverified (identical to current behavior)
- **Verification fails:** Message displayed as unverified (identical to current behavior)
- **Verification succeeds:** Message displayed with verified indicator (new enhancement only)
- **All messages processed:** Verification failures are logged but never block message processing, storage, or display
- **Network resilience:** Invalid signatures don't cause message rejection or network disruption
- **Graceful degradation:** System functions identically to current behavior when verification is unavailable or fails

## 3. Network & Security Constants

All clients are expected to use the following constants. A later enhancement will lessen our reliance on this policy.

```typescript
export const VERIFICATION_CONSTANTS = {
  // Timestamp Policy
  WINDOW_PAST: 48 * 60 * 60,      // 48 hours in seconds
  WINDOW_FUTURE: 10 * 60,         // 10 minutes in seconds
} as const;
```

### 3.1. EIP-712 Domain & Types

For EIP-712 typed data signing using `viem`, use the following domain and types (must be consistent across all clients):

```typescript
export const EIP712_DOMAIN = {
  name: "Buzz Messages",
  version: "1",
  chainId: 1,  // Ethereum mainnet (for compatibility, actual chain not used)
  verifyingContract: "0x0000000000000000000000000000000000000000",  // Placeholder
} as const;

export const EIP712_TYPES = {
  MessageEnvelope: [
    { name: "sender", type: "string" },
    { name: "timestamp", type: "uint256" },
    { name: "channelId", type: "string" },
    { name: "networkMessageId", type: "string" },
    { name: "messageType", type: "string" },
    { name: "content", type: "string" },
  ],
} as const;
```

## 4. Implementation Integration Points

### 4.0. Dependencies

### 4.1. Files to Modify

1. **`src/components/MessageSender.tsx`**
   - Add envelope construction logic.
   - Add signature generation before sending.
   - Derive Ethereum account from mnemonic (cache in component state, session-only).

2. **`src/components/listeners/TextMessageHandler.tsx`**
   - Add verification logic after decryption.
   - Store verification status in component state (not database).

3. **`src/components/listeners/ReactionMessageHandler.tsx`**
   - Add verification logic.
   - Store verification status in component state (not database).

4. **`src/components/listeners/DeleteMessageHandler.tsx`**
   - Replace placeholder signature check with actual verification.
   - Store verification status in component state (not database).

5. **`src/lib/local-first.ts`**
   - Add `ethereumAddress` field to user schema: `String100` (stores hex-encoded Ethereum address, 0x-prefixed, 20 bytes)
   - **Decision:** Verification status stored in component state only (not database schema) - simpler, maintains single source of truth

### 4.2. New Files to Create

1. **`src/lib/message-verification.ts`**
   - Functions for envelope construction.
   - EIP-712 signature generation using `viem.signTypedData()`.
   - EIP-712 signature verification using `viem.recoverTypedDataAddress()`.
   - Timestamp validation.

2. **`src/lib/crypto-keys.ts`**
   - Key derivation from Evolu mnemonic using `viem.mnemonicToAccount()`.
   - BIP-44 derivation path management (`m/44'/60'/0'/0/0`).
   - Ethereum account derivation (address extraction).
   - UUID-to-Ethereum-address mapping and lookup in Evolu database.
   - **No private key storage** - all keys derived on-demand from mnemonic.
   - **Account caching:** Return account object for component state caching (session-only, not persisted).

## 5. Acknowledged Limitations

This system has the following known security limitations:

1.  **No Forward Secrecy:** Compromise of the user's Evolu mnemonic results in total compromise of their identity, allowing impersonation for all past and future messages. Since the private key is derived from the mnemonic, protecting the mnemonic is critical.
2.  **Falsifiable Timestamps:** The system is vulnerable to a malicious sender who manipulates their local system clock within the `WINDOW_PAST` and `WINDOW_FUTURE` bounds to create a cryptographically valid but false timeline of events. This is a conscious tradeoff to avoid external dependencies for timestamp anchoring.
3.  **Backward Compatibility:** Messages without signatures will be accepted and marked as "unverified". This allows gradual adoption but means verification is optional initially. Consider rate limiting unsigned messages or requiring signatures after a migration period.
4.  **Signature in Encrypted Payloads:** When messages are encrypted, signatures are inside the encrypted payload (by design). This means verification requires decryption first. This is a conscious trade-off: signatures remain hidden for better privacy, but cannot be verified without the decryption key. This is acceptable as we anticipate both encrypted and non-encrypted messages to be used.
5.  **Mnemonic Compromise:** If a user's Evolu mnemonic is compromised, all past and future messages can be forged (since the private key is derived from it). The mnemonic is the single point of failure. Future versions will implement a key rotation mechanism.
6.  **Derivation Path Security:** The derivation path (`m/44'/60'/0'/0/0`) is fixed and public. If an attacker gains the mnemonic, they can derive the same private key. This is standard for HD wallets but means mnemonic security is paramount.

## 6. Future Considerations

The following enhancements are considered for future versions but are out of scope for the initial implementation:

1.  **NIST Randomness Beacon Integration:** Integrate heartbeat messages that reference the NIST public randomness beacon to harden against malicious timestamp manipulation. By periodically anchoring message timestamps to external, verifiable randomness sources, the system could detect and reject attempts to create false timelines using falsified timestamps. This would mitigate the "Falsifiable Timestamps" limitation (section 5.2) by providing cryptographic proof that certain messages existed at specific points in time relative to publicly verifiable randomness events.

2.  **Cryptographic Ratchet Signing Method:** Implement an unspecified cryptographic ratchet signing method that anticipates scheduled key rotation. This would address the "No Forward Secrecy" limitation (section 5.1) by allowing periodic key updates without breaking message verification. The ratchet mechanism would enable forward secrecy while maintaining the ability to verify historical messages signed with previous keys. This is complex to implement with mnemonic-based derivation and would require careful design to maintain cross-device compatibility and key synchronization, as well as juggle performance considerations based on stateful verification requirements.

3.  **Bring Your Own Ethereum Address/Private Key:** Allow users to import their own Ethereum private key instead of deriving from the Evolu mnemonic. This would enable users to use existing Ethereum addresses (e.g., from MetaMask, hardware wallets, or other wallets) for message signing. **Implementation considerations:**
   - **Account retrieval logic:** Support both derivation paths - check for imported private key first, fall back to mnemonic derivation
   - **Private key storage:** Store imported private keys encrypted in Evolu user schema (Evolu already provides encryption)
   - **Secure export:** Similar, but parallel to, existing Evolu mnemonic export. Must clarify in UI that this is a different key
   - **Cross-device sync:** Imported keys would sync across devices via Evolu's existing sync mechanism (encrypted)
   - **Schema changes:** Add `importedPrivateKey?: string | null` and `keySource: "derived" | "imported"` fields to user schema
   - **Verification compatibility:** No changes needed - verification logic only compares addresses, not key source
   - **Signing compatibility:** No changes needed - `signMessageEnvelope()` accepts any `PrivateKeyAccount` from viem
   - **Security trade-offs:** Imported keys require encrypted storage (vs. no storage for derived keys), but provide flexibility and composability for users with existing Ethereum identities (e.g., ENS)

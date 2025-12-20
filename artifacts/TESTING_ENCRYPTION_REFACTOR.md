# Testing Plan: Encryption Envelope & Private Namespaces

This document outlines the validation steps for the refactoring of the encryption layer and the introduction of salted channel hashing.

## 1. Unit Testing: Core Cryptography
Verify the underlying helpers in `src/lib/symmetric-encryption.ts` and `src/lib/salted-hashing.ts`.

- [x] **Hashing Uniqueness**: Verify that `createSaltedHash("room", "salt1")` is different from `createSaltedHash("room", "salt2")`.
- [x] **Hashing Consistency**: Verify that the same inputs always produce the same hash across different sessions.
- [x] **Encryption Cycle**:
    - [x] `prepareEncryptedMessage` with `encrypted: false` returns the original object.
    - [x] `prepareEncryptedMessage` with `encrypted: true` returns an `EncryptedMessage` with a `payload`.
    - [x] `decryptMessagePayload` correctly reconstructs the original object from the `payload`.
- [x] **Type Safety**: Verify that `isEncryptedMessage` correctly identifies encrypted envelopes and rejects malformed objects.

## 2. Integration Testing: Socket Provider
Verify the asynchronous initialization and connection logic.

- [x] **Connection Lifecycle**:
    - [x] App connects to a hashed URL (inspect Network tab for `wss://itty.ws/[hash]`).
    - [x] Changing the `channelId` in UI triggers a `CLOSE` doorbell on the old hash and an `OPEN` doorbell on the new hash.
    - [x] Changing the `channelSalt` in UI triggers the same migration flow.
- [x] **Race Conditions**: Rapidly toggle between two room names or salts to ensure the `isCancelled` logic in `SocketProvider` prevents multiple overlapping connections.

## 3. Functional Testing: Messaging Scenarios
- [x] Use two browser windows (User A and User B) to simulate real-world coordination.

### Scenario A: Plaintext (The Baseline)
- [-] Set both users to the same `channelId`, `salt: empty`, and `encryption: disabled`.
    - [x] Verify TEXT works as expected.
    - [x] Verify REACTION works as expected.
    - [x] Verify DELETE MESSAGE works as expected.
    - [x] Verify DELETE REACTION works as expected.

### Scenario B: Fully Hardened (The New Standard)
- [x] Set both users to:
    - `channelId`: "secret-club"
    - `channelSalt`: "my-salt"
    - `encryptionKey`: <create a key>
    - `encryption mode`: **on**
- [x] **Verification**:
    - [x] Messages are received and decrypted correctly.
    - [x] Reactions appear on the correct messages.
    - [x] Deleting a message on User A removes it on User B.
- [x] **Negative Verification**: change terms for one user
    - verify that the other user's messages do not get decrypted

### Scenario C: Private Namespace (The "Cloak")
- [x] User A: `channelId: "lobby"`, `salt: "alpha"`
- [x] User B: `channelId: "lobby"`, `salt: "beta"`
- [x] **Verification**:
    - [x] User A sends a message. User B **receives nothing**.
    - [x] This confirms they are on different server-side rooms despite the same friendly name.

### Scenario D: Garbled Store (Key Mismatch)
- [x] Both users use the same `channelId` and `salt`.
- [x] User A sends encrypted message with `key: "A"`.
- [x] User B has `key: "B"`.
- [ ] **Verification**:
    - [x] User B sees "Anonymous Bee: Unable to decrypt message" in the UI.
    - [x] User B enables "Verbose Mode" and sees the garbled message in the list.
    - [x] User A deletes the message; it should disappear from User B's UI/GarbledStore (verifying plaintext `networkMessageId` routing).

## 4. Security & Metadata Audit
Inspect the WebSocket frames in the Browser DevTools (Network -> WS -> Messages).

- [x] **Visible Data**: Verify `type`, `channelId`, and `networkMessageId` are visible.
- [x] **Hidden Data**: Verify that `content`, `user.displayName`, `user.pfpUrl`, and `uuid` are **NOT** visible inside the frames when encryption is enabled.
- [x] **Room URL**: Verify the URL does not contain the plaintext channel name when a salt is used.

## 5. UI/UX Verification
- [x] **Salt Selector**: Verify the 400ms debounce prevents a reconnection storm while typing a long salt.
- [x] **Status Indicators**: Verify the "Connecting..." state appears briefly during the async hash calculation.

## 6. Autoresponder Validation
Verify that the bot-like functionality respects the new layers.

- [x] **Catch-up Sync**: User A (with salt/key) sends messages while User B is offline. User B comes online (with same salt/key). Verify User B's autoresponder sends/receives the encrypted catch-up history correctly.
- [x] **Encryption Logic**: Verify that `reconstructTextMessage` in the autoresponder no longer tries to encrypt (since encryption now happens at the `safeSend` envelope level).


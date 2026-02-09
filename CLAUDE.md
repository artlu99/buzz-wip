# Buzz - Coding Reference

## Quick Architecture Decisions

| Question | Answer |
|----------|--------|
| Where does WebSocket logic go? | `src/components/listeners/*MessageHandler.tsx` - each handler is a React component |
| Store in Evolu or Zustand? | **Evolu** = persistent data (messages, users, reactions). **Zustand** = ephemeral UI state (current view, typing status) |
| How do I identify messages? | Use `networkMessageId` for distributed matching, local `id` for DB operations |
| Is this message a duplicate? | `TypedWsClient` dedups TEXT messages at socket level. REACTION/DELETE use DB-level idempotency |
| Should I encrypt? | Only if channel is private. Use `prepareEncryptedMessage()` before sending |
| How do I verify authenticity? | Use `verifyMessageSignature()` in `src/lib/message-verification.ts` |

## Message Flow

```
Send: Component → TypedWsClient.safeSend() → itty-sockets → other clients
Receive: itty-sockets → TypedWsClient.on() → *MessageHandler → Evolu upsert → UI re-renders
```

## Key Types (src/lib/sockets.ts)

- `TextMessage` - `{ uuid, networkMessageId, networkTimestamp, content, user, signature }`
- `ReactionMessage` - `{ uuid, networkMessageId, reaction, isDeleted, signature }`
- `DeleteMessage` - `{ uuid, networkMessageId, signature }`

## Privacy Considerations

- **Lockdown mode** (`state.lockdown`): Don't include user data in MARCO_POLO
- **Salted channels**: Hash `channelId + salt` before routing through WebSocket
- **Historical data**: `status` and `bio` in messages reflect sender's state at send-time

## Adding New Message Types

1. Add enum to `WsMessageType` in `src/lib/sockets.ts`
2. Add interface extending `BaseWsMessage`
3. Create `is*Message()` type guard
4. Create `*MessageHandler.tsx` component in `src/components/listeners/`
5. Add handler to `App.tsx`

## Crypto

- **Signing** (authenticity): `signMessageEnvelope()` using EIP-712 + viem
- **Encryption** (privacy): `prepareEncryptedMessage()` for private channels
- **Verification**: `verifyMessageSignature()` before trusting message content

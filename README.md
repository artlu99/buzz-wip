# Buzz 📲

ephemeral public and private messages

## TESTING PUNCHLIST

- [x] fix socket connection (add /c/ to url)
- [x] [SECURITY] encrypt typing/not typing status updates
- [x] [SECURITY] rethink typing indicators (and timing right before sending)
- [ ] [UI] hide/show Channel Salt as password input, not plaintext
- [ ] [UI] make salt easier to access/see (you have a non-default *salt*)
- [ ] [TYPES] something is unexpectedly empty in validateDeleteTimestamp
- [ ] [UX] consider guard: only allow autoresponder with encrypted on? not helpful for leavers

## TODO

- [x] marco-polo messages
- [x] symmetric encryption (insecure broadcast of shared key)
- [x] link to https://dele.to/alternatives
- [x] test transmission of secret
- [x] (spoofable with protections) network timestamp
- [x] history auto-responder bots
- [x] often hits rate limits on joining
- [x] option to show un-decryptable messages
- [x] show who reacted to each message
- [x] detailed presence indications
- [x] encrypt user metadata
- [x] rationalize metadata leaks for DELETE messages
    - [ ] include chaff and heartbeats
- [ ] hook for displaying status + bio + publicNtfyId
- [ ] framer bio + status
- [ ] deeplinks (with redirects to avoid data leakage in url)
    - [ ] QR code
- [ ] concern about griefing / spoofing
- [ ] rooms registry
    - [x] first, channel ID hashing with user-specified (but default) salt
- [ ] forward secret encryption
- [ ] custom reaction types for each room, incl. sticker packs
- [ ] user metadata anonymization on websockets
    - [ ] also, constant-size padding
- [ ] reveal pfp (user choice)

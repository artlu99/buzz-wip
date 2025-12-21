# Buzz 📲

ephemeral public and private messages

## TODO

- [ ] [UI] signing delete messages, regular messages
    - [ ] how to get public key if user is offline
    - [ ] concern about griefing / spoofing deletes
- [ ] [SECURITY] user metadata anonymization on websockets
    - [ ] also, constant-size padding
- [ ] [UX] sign into channel with insecure link
    - [ ] QR code
- [ ] Bun websocket server - itty server rate limits us

## WISHLIST

- [ ] [UI] framer bio + status for other users
    - [ ] make hook for displaying status + bio + publicNtfyId
- [ ] [UX] sounds
- [ ] [UX] conversations - gc, dc, anon, public, private
- [ ] [UI] custom reaction types 
    - [ ] for each room, incl. sticker packs
- [ ] [UX] muted users
- [ ] [UX] rooms directory + key information
    - [x] first, channel ID hashing with user-specified (but default) salt

## WONTFIX

- [ ] [SECURITY] forward secret encryption
- [ ] [SECURITY] hide pfp from certain others (user choice)
- [ ] [UI] skin like bbm, whatsapp, iMessage
- [ ] [SECURITY] consider chaff and heartbeats
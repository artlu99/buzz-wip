# Buzz 📲

ephemeral public and private messages

This project is sunset **9 February 2026**. The repo will be archived in read-only mode.

## SUNSET ANNOUNCEMENT

No existing private messenger has everything I want, but I include a list of references and strong recommendations below.

To reiterate the original design goals of this project:
- no servers <- can't be evil with user secrets
- easy-to-understand security <- less likely for users to be confused
- open source <- trustless, verifiable, and transparent, details can't be obscured

I thought that a relatively new local-first technology would be sufficient, and worth attempting.

# Alternative Recommendations

- Signal (but it has different limits of applicability)

- iMessage + FaceTime + voice phone call

- something soon to be released by the author of [this post](https://cassieheart.substack.com/p/notes-on-e2ee), which promises can't-be-evil servers

- https://keet.io based on Pear P2P looks promising, but I can't tell. It's got so many uniquely new things going on in every layer

# Discussion

My north star has been for my pre-teen child AND my elderly parents to use this to communicate securely. With common sense and normal levels of suspicion, they should be able to unstoppably reach other with confidence.

I feel the need to add a live video option. And the need for the cryptographic proof of identity to get **no more complicated** than it already is.

The latest step up in cryptographic complexity isn't even needed for the primary purpose of secure communication! It's only there to prevent griefing. That is, to prevent people from deleting other people's messages.

Prior to this, the magic of local-first had allowed us to get away with unsigned messages sent over server-free, secure (and insecure) channels.

But I don't see how we can stay server-free, as we attempt to move from anonymous, ephemeral identity to a more durable form. Even bootstrapping existing credentials is hard, as you need a trusted method to provide proof.

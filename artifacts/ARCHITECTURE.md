# Dumb Relays

This architectural pattern represents a shift from **infrastructure-as-a-controller** (traditional SaaS) to **infrastructure-as-a-commodity**. In this client-sovereign model, the application logic and cryptographic keys remain entirely on the user's device, while the network infrastructure is reduced to interchangeable transport and storage services.

## 1. The Core Philosophy: Demoting the Server

The primary security goal is **Structural Decoupling**. By removing the application backend, you eliminate the centralized attack surface. There is no central database to breach, no admin panel to compromise, and no single entity to compel for plaintext data. The server is reduced from a "Trusted Authority" to a message relay.

## 2. The Three Pillars of the Stance

### I. Infrastructure Sovereignty (User-Selectable Relays)

Security is achieved through **replaceability**. Because the relays (WebSocket for real-time transport, Evolu for CRDT sync) perform standardized functions without application-specific logic, users can switch providers or self-host without data loss or feature degradation.

**Privacy Stance**: Users are not locked into trusting a single entity; they can distribute trust across multiple commodity providers or eliminate third-party trust entirely through self-hosting.

### II. Local-First Autonomy (Evolu/CRDTs)

The authoritative data store is the client-side SQLite database. The relay serves only as a synchronization intermediary.

**Security Stance**: The application remains functional when disconnected. This mitigates **Availability Attacks** (DDoS or server shutdowns). Even if a relay is compromised or terminated, user data and identity persist locally.

### III. Zero-Knowledge Transport (Envelope Encryption)

The system treats all network infrastructure as untrusted. All transmitted data is encrypted before leaving the device.

**Privacy Stance**: By encrypting not just message content but also metadata (user identifiers, message types), the relay receives opaque encrypted payloads. The relay can route these payloads but cannot determine their sender, recipient, or contents.

## 3. The Residual Vulnerabilities (The "Metadata Problem")

Even with comprehensive envelope encryption, the relay-based architecture has inherent metadata exposure that is difficult to eliminate without additional measures:

- **Traffic Analysis**: Relays observe **IP addresses**, **packet timing**, and **size patterns**. An observer can infer communication relationships through correlation analysis, even when payload data is encrypted.
- **Identity Bootstrapping**: Without centralized identity verification, users must establish trust through out-of-band secret exchange. This trades the convenience of managed authentication for the security of zero-knowledge protocols.
- **Infrastructure Dependency**: While relay operators cannot access encrypted data, they can still deny service or log connection metadata. The system remains dependent on infrastructure availability, even if that infrastructure is interchangeable.

## 4. Summary Comparison

| Feature | Traditional Server (SaaS) | No-Server / Dumb Relay |
| :--- | :--- | :--- |
| **Logic** | Centralized (Proprietary) | Client-side (Open) |
| **Secrets** | Server-stored | Device-stored |
| **Data Breach** | Mass compromise | Single-device scope |
| **Privacy** | Trust-based | Cryptography-based |
| **Resilience** | Server-dependent | Local-first |

## Conclusion

The dumb relay pattern enables a **client-sovereign** architecture that prioritizes user control over centralized convenience. It accepts that while network metadata is difficult to obscure, application logic and user data should remain under direct user control rather than stored in centralized databases.

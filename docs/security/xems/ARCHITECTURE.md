# XEMS Architecture

The XyPriss Encrypted Memory Store (XEMS) is built on a "Moving Target Defense" philosophy, prioritizing isolation, automation, and cryptographic binding.

## Sidecar Process Model

XEMS operates as a standalone sidecar binary. This ensures a strict boundary between the application logic (Node.js/TypeScript) and the storage engine.

### Communication Flow

1. **Request**: The TypeScript layer sends a command via high-speed IPC (Standard Input).
2. **Processing**: The Go-native core processes the command entirely in compiled memory space.
3. **Response**: The result is returned via Standard Output, buffered for performance.

> [!NOTE]
> This sidecar model provides inherent protection against common Node.js vulnerabilities, such as prototype pollution or malicious script execution, which cannot reach the isolated XEMS memory space.

## Security & Encryption

### 1. AES-256-GCM

All persistent data is encrypted using the Advanced Encryption Standard in Galois/Counter Mode (AES-GCM). This provides both confidentiality and authenticity (AEAD), ensuring that data cannot be tampered with while at rest.

### 2. Hardware-Bound Entropy

XEMS incorporates unique physical hardware identifiers (HWID) into its encryption derivation process.

- **Migration Block**: Encrypted "Vaults" generated on Server A cannot be decrypted on Server B, even if the secret key is compromised.
- **Hardware Affirmation**: This ensures that session legitimacy is tied to the physical environment.

### 3. Atomic Token Rotation

The framework supports per-request session rotation.

- **Validity**: Upon a successful `/read` operation with rotation enabled, the current token is immediately marked for deletion.
- **New Token**: A new cryptographically secure token is returned, which the framework automatically propagates to the client.
- **Grace Period**: A configurable grace period (e.g., 1000ms) prevents race conditions during concurrent requests from the same client.

## Concurrency & Resource Management

### Multi-Server Runner Singleton

In multi-server configurations, XEMS utilizes a path-based singleton pattern.

- **Path Mapping**: If multiple server instances (e.g., `main`, `api`, `admin`) target the same persistence path, they will automatically share a single background XEMS process.
- **Collision Avoidance**: This eliminates file system locks and race conditions that occur when multiple processes attempt to write to the same encrypted vault.

### Automatic Retention

XEMS is strictly designed for transient data. All entries are subject to a hard 5-day retention limit, regardless of their individual TTL. This ensures the engine remains lean and prevents the accumulation of stale sensitive data.

---

_Copyright © 2026 Nehonix Team. All rights reserved._


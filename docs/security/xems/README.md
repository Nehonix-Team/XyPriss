# XEMS: XyPriss Encrypted Memory Store

The XyPriss Encrypted Memory Store (XEMS) is a high-performance, security-hardened session and temporary data storage engine. It is designed to provide military-grade session isolation and persistence with zero external dependencies.

## Key Concepts

### 1. Sidecar Process Model

XEMS operates as a dedicated native sidecar process (managed by XHSC). This architecture ensures that sensitive session data is never stored within the Node.js memory space, protecting it from heap dumps and script-level memory inspection.

### 2. Sandboxing

Data within XEMS is partitioned into logical "Sandboxes". Each sandbox provides a cryptographically isolated namespace. Operations in one sandbox (e.g., `auth.sessions`) cannot influence or access data in another (e.g., `app.cache`).

### 3. Atomic Rotation

XEMS implements per-request token rotation. Upon every successful session retrieval, the engine can optionally invalidate the current token and issue a new one. This significantly narrows the window for session hijacking.

### 4. Hardware-Bound Persistence

When persistence is enabled, XEMS encrypts the on-disk "Vault" using AES-256-GCM. The encryption is bound to the physical hardware's identity (HWID), ensuring that storage files cannot be decrypted if moved to another machine.

## Documentation Modules

Explore the detailed technical documentation for XEMS:

| Module                                  | Description                                                                                    |
| :-------------------------------------- | :--------------------------------------------------------------------------------------------- |
| [**Architecture**](./ARCHITECTURE.md)   | Deep dive into the sidecar model, IPC protocols, and encryption standards.                     |
| [**Performance**](./PERFORMANCE.md)     | Verified benchmarks, high-concurrency results, and stability audit metrics.                    |
| [**Configuration**](./CONFIGURATION.md) | Comprehensive reference for tuning performance, storage, and security limits.                  |
| [**Usage Guide**](./USAGE.md)           | Implementation patterns for session management, multi-server environments, and manual storage. |

> [!IMPORTANT]
> XEMS is an internal framework component. While it provides high-performance storage, it is not a replacement for a general-purpose database. Use it primarily for security-sensitive, high-churn, or transient data.

---

_Copyright © 2026 Nehonix Team. All rights reserved._


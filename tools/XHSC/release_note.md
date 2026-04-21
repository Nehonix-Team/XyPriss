# XyPriss Hyper-System Core

## Version: 9.7.1 (Stable)

**Engine Code:** XHSC41826G3-S
**Architecture:** Go-Native XyPriss Hyper-System Core (XHSC-G3)

## Security & Deep Audit (vG0.1.114)

- **Selective Signing Enforcement**: Mandatory `files` field requirement in `package.json` for all plugin sign operations, ensuring only distributed assets are hashed.
- **Improved Hashing Consistency**: Replaced locale-dependent sorting in `PluginSecurity.ts` with strict byte-wise lexical sorting to match XHSC (Go) `filepath.Walk` behavior.
- **Zero-Trust UI Improvements**: Enhanced `xfpm sign` with matrix-style real-time file logging and custom `package.json` path support.
- **Portable Integrity Verification**: Cross-platform content hashing (SHA-256) ensuring immutable plugin distribution.

_© 2026 Nehonix Team. All rights reserved. For internal distribution only._


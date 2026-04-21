# XyPriss Hyper-System Core

## Version: 9.7.1 (Stable)

**Engine Code:** XHSC41826G3-S
**Architecture:** Go-Native XyPriss Hyper-System Core (XHSC-G3)

## Security & Deep Audit (Plugin Security Fix)

- **Improved Hashing Consistency**: Replaced locale-dependent sorting in `PluginSecurity.ts` with strict byte-wise lexical sorting to match XHSC (Go) `filepath.Walk` behavior.
- **Portable Integrity Verification**: Cross-platform content hashing (SHA-256) ensuring immutable plugin distribution.

_© 2026 Nehonix Team. All rights reserved. For internal distribution only._


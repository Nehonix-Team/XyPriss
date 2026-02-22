# Release Notes - XyPriss System Core (XSYS) Go

## [9.0.5] - 2026-02-22

This release focuses on stabilizing the cross-platform system bridge and implementing missing core functionalities for process and environment management.

### 🚀 New Features

- **Cross-Platform Process Termination**: The `kill` command now supports targeting processes by **name** in addition to PID. It performs a case-sensitive search across running processes, providing a consistent replacement for `pkill` across Linux, macOS, and Windows.
- **Enhanced System Commands**: Fully implemented the following commands in the Go backend:
    - `sys kill`: Terminate processes safely.
    - `sys env`: Retrieve system environment variables.
    - `sys network`: Detailed network interface enumeration.
    - `sys health`: System health diagnostic score.
- **Accurate Metadata**: File statistics (`$stats`) now return valid `Created` and `Accessed` timestamps instead of Unix epoch (1970) placeholders.

### 🛠 Improvements & Bug Fixes

- **Fixed PID Flag Handling**: Resolved an "unknown flag" error when passing `--pid` to the system binary.
- **Unified Environment API**: Updated internal handlers to align with the new `__sys__.__env__.mode` structure.
- **Cross-Platform Stability**: Removed platform-specific `syscall` dependencies in the filesystem module that were causing build failures on Darwin (macOS). Creation/Access times now use robust fallback logic to ensure successful builds on all targets.
- **Network Data**: Fixed an issue where `__sys__.$network()` would return empty results; it now correctly pipes interface data from the Go backend.

### 📦 Supported Platforms

- **Linux**: amd64, arm64
- **macOS (Darwin)**: amd64, arm64 (Apple Silicon)
- **Windows**: amd64, arm64

---

_Developed by Nehonix Team - Secure and Ultra-Fast._


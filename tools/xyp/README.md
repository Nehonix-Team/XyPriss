# XFPM: XyPriss Fast Package Manager 🕶️

XFPM is the high-performance package manager and CLI tool for the XyPriss ecosystem, written in Rust. It serves as the official successor to the previous Go-based CLI, offering ultra-fast dependency resolution, a unique "Matrix-style" terminal interface, and deep integration with XyPriss projects.

## Key Features

- **Blazing Fast**: Engineered in Rust for maximum performance.
- **Matrix-Style UI**: Technical, professional, and consistent terminal feedback with hexadecimal pulses and zero emojis.
- **Strict Isolation**: Implementation of a virtual store for dependency isolation (similar to pnpm).
- **Neural Graph Resolution**: Advanced dependency resolution engine that maps your project's neural graph.
- **Global & Local Support**: Manage packages globally or locally with ease.
- **Legacy Compatibility**: Full support for existing npm/package.json ecosystems.

## OS & Architecture Support

XFPM is designed for universal high-performance execution.

| OS          | Architecture            | Status           |
| ----------- | ----------------------- | ---------------- |
| **Linux**   | x86_64 (AMD64)          | ✅ Supported     |
| **Linux**   | aarch64 (ARM64)         | ✅ Supported     |
| **Windows** | x86_64 (AMD64)          | ✅ Supported     |
| **Windows** | aarch64 (ARM64)         | ✅ Supported     |
| **macOS**   | x86_64 (Intel)          | 🛠️ Source-only\* |
| **macOS**   | aarch64 (Apple Silicon) | 🛠️ Source-only\* |

> \* **Note**: macOS binaries are currently provided via source builds or dedicated Apple-hosted CI. Direct cross-compilation for Darwin targets from Linux is ongoing.

> **Future Guarantee**: Nehonix™ is committed to expanding support for emerging architectures, including RISC-V and specialized edge computing platforms.

## Installation

XFPM is distributed via the unified XyPriss installer. For detailed instructions on Linux, Windows, or macOS, please refer to the primary [**Installation Guide**](https://xypriss.nehonix.com/docs/installation?q=install%20xfpm&kw=This%20document%20provides%20step-by-step%20in).

### Quick Terminal Command

```bash
curl -sL https://xypriss.nehonix.com/install.js | node
```

### Uninstallation

To remove XyPriss CLI from your system:

```bash
curl -sL https://xypriss.nehonix.com/install.js | node - uninstall
```

_Note: The installer automatically detects your hardware architecture and maps the high-performance Rust engine to your system PATH._

## Basic Usage

### Initialize a project

```bash
xfpm init
```

### Install dependencies

```bash
xfpm install          # or xfpm i
xfpm add pkg-name     # or xfpm i pkg-name
```

### Run scripts

```bash
xfpm dev              # Alis for 'xfpm start'
xfpm run test.ts      # Execute a script
xfpm index.ts         # Shorthand for 'xfpm run index.ts'
```

### Global installations

```bash
xfpm i -g pkg-name    # Install a package globally
```

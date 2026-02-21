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

XFPM is now distributed via the official unified installer. For complete platform-specific instructions, please refer to the [**Installation Guide**](./INSTALLATION.md).

### Unix/macOS

```bash
curl -sL https://xypriss.nehonix.com/install.js | node
```

### Windows

```bash
Invoke-RestMethod -Uri "https://xypriss.nehonix.com/install.js" -UseBasicParsing | node

# or
irm https://xypriss.nehonix.com/install.js | node
```

### Uninstallation

To remove the engine:

```bash
curl -sL https://xypriss.nehonix.com/install.js | node - uninstall
```

_Note: The installer automatically handles architecture detection and system PATH configuration._

<!--
## Command Reference

> **Note:** `xyp` and `xfpm` are aliases for the same tool. You can use them interchangeably in all commands. -->

### `init` - Initialize Project

Creates a new XyPriss project with interactive or flag-based configuration.

```bash
xyp init [options]
```

**Options:**

- `-n, --name <string>`: Project name
- `--desc <string>`: Project description
- `--lang <string>`: Language (ts/js)
- `--port <number>`: Default server port
- `--author <string>`: Author name
- `--alias <string>`: Application alias

### `install` - Manage Dependencies

Installs packages or synchronizes the current project.
**Aliases:** `i`, `add`

```bash
# Install everything from package.json
xfpm i

# Add packages
xfpm add <package...> [flags]
```

**Flags:**

- `-D, --dev`: Save to `devDependencies`
- `-O, --optional`: Save to `optionalDependencies`
- `-P, --peer`: Save to `peerDependencies`
- `-E, --exact`: Install exact version (no `^`)
- `-g, --global`: Install globally
    <!-- - `--npm`: Force npm mode compatibility -->
- `--retries <number>`: Network retry attempts (default: 3)

### `run` - Execute Scripts

Runs a project script or a file using the optimized runtime.
**Aliases:** `r`, `test`, `build`

```bash
# Intelligent Default (runs 'dev' script)
xfpm run

# Run specific script
xfpm run build
xfpm build        # Shorthand alias

# Run a file directly
xfpm run scripts/seed.ts
```

### `exec` - Binary Execution

Execute a command from `node_modules/.bin` (similar to `npx` or `bun x`).
**Alias:** `--`

```bash
# Syntax
xfpm exec <command> [args...]

# Shorthand usage
xfpm -- prisma generate
xfpm -- tsc --noEmit
```

### `start` - Development Server

Starts the project in development mode (alias for `xyp run dev`).
**Alias:** `dev`

```bash
xfpm dev
```

### `uninstall` - Remove Packages

Removes dependencies from the project.
**Aliases:** `un`, `rm`, `remove`

```bash
xfpm rm <package...> [flags]
```

**Flags:**

- `-g, --global`: Uninstall globally


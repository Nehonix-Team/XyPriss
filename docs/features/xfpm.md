# XFPM — XyPriss Fast Package Manager

> [!NOTE]
> For more comprehensive information, complete installation instructions, and detailed usage guides, please visit the **[official XFPM repository](https://github.com/Nehonix-Team/XFMP)**.

**XFPM** is a cross-platform command-line package manager designed specifically for the XyPriss ecosystem. Built entirely in **Go**, it delivers fast dependency resolution, strict package isolation through a virtual store, and a clean terminal interface suited for professional workflows.

## Key Features

- **Performance**: Optimized resolution engine based on a neural dependency graph, written entirely in Go.
- **Strict Isolation**: Content-addressable storage (CAS) and a virtual store architecture prevent dependency leakage between projects.
- **Cross-Platform**: Native binaries for Windows, Linux, and macOS — both `amd64` and `arm64`.
- **Clean Output**: Structured, minimal terminal feedback with no visual noise.
- **Auto-Update**: Built-in update engine keeps the CLI current without manual intervention.
- **Single Binary**: No runtime dependencies. One single, self-contained binary.

## Core Architecture

XFPM resolves dependencies by building a **Neural Dependency Graph** of your project.

### CAS — Content Addressable Storage

Every file is hashed and stored once across the entire system in `~/.xpm/storage`. This eliminates duplicates, saves disk space, and ensures deterministic installs utilizing Reflink (Copy-on-Write) when supported by the OS.

### Virtual Store

Dependencies are rigorously stored by their exact version under the project-local `node_modules/.xpm/vstore` and safely symlinked into the project's `node_modules`. This "Ancestor Hoisting" architecture enforces strict workspace isolation while preserving 100% compatibility with standard Node scripts and native bindings.

### Targeted Resolution

Only the modified portions of the dependency graph are recalculated during updates, drastically minimizing overhead and keeping incremental operations as fast as possible.

---

_For more details on package deprecation redirections, command aliases (`xfpm i`, `xfpm update`), or usage documentation, refer to the [official repo](https://github.com/Nehonix-Team/XFMP)._


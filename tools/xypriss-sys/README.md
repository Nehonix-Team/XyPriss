# XyPriss System CLI (xsys)

Professional high-performance system and filesystem management tool developed in Rust for the Nehonix ecosystem. This tool provides a unified interface for advanced filesystem operations and comprehensive system monitoring.

## Access Restrictions

<div style="color: red;">
This software is exclusively for use by Authorized Personnel of NEHONIX. It is intended for Internal Use only within NEHONIX operations. No rights are granted to unauthorized individuals or entities.
</div>

## Overview

XyPriss System CLI (`xsys`) is designed to replace and enhance legacy Node.js filesystem modules with a high-performance Rust implementation. It offers a robust command-line interface and internal API for system administration, monitoring, and file management tasks.

## Key Modules

### Filesystem Engine (XyPrissFS)

-   High-performance recursive directory traversal and listing.
-   Advanced path resolution, normalization, and relative path calculations.
-   Comprehensive file statistics and metadata analysis.
-   Atomic read/write operations for text, binary, and JSON formats.
-   Advanced search capabilities using regular expressions.
-   File content searching (Grep functionality).
-   Secure hashing (SHA-256) and integrity verification.
-   Integrated compression supporting GZIP and TAR archiving.
-   Real-time file system monitoring and event notifications.
-   Parallel processing for high-volume batch operations.

### System Intelligence (XyPrissSys)

-   Detailed hardware information and CPU usage monitoring.
-   Comprehensive memory analysis (RAM and Swap).
-   Storage management with mount point detection.
-   Network interface statistics and traffic measurement.
-   Advanced process management including statistics and termination.
-   Environmental data retrieval (Variables, system paths, user information).
-   Automated system health scoring and diagnostic monitoring.

## Installation and Requirements

### Prerequisites

-   Rust Compiler (v1.80 or later)
-   Cargo Package Manager
-   Cross-platform build tools (GCC, MinGW-w64 for Windows cross-builds)

### Manual Build

```bash
cd tools/xypriss-sys
cargo build --release
```

The binary will be available as `target/release/xsys`.

### Cross-Platform Build Script

The project includes a professional automation script to generate binaries for all supported architectures matching the XyPriss standard naming convention:

```bash
./build.sh
```

Generated binaries are stored in the `dist/` directory.

## Binary Naming Convention

To ensure consistency across the Nehonix ecosystem, binaries are named using the following pattern:
`xsys-{os}-{arch}{extension}`

Supported targets include:

-   `xsys-linux-amd64` (GLIBC based)
-   `xsys-linux-amd64-musl` (Statically linked for Alpine/Docker)
-   `xsys-linux-arm64`
-   `xsys-windows-amd64.exe`
-   `xsys-darwin-amd64`
-   `xsys-darwin-arm64`

## Global Options

These flags can be used with any command:

-   `--json`: Output results in structured JSON format.
-   `--verbose`: Enable detailed logging and debug information.
-   `--quiet`: Minimal output (errors only).
-   `--root <DIR>`: Set the base directory for filesystem operations (defaults to current directory or `XYPRISS_ROOT` environment variable).

## Command Reference

### Filesystem (fs)

-   `ls <PATH>`: List directory contents.
    -   `--stats`: Show sizes, permissions, and timestamps.
    -   `--recursive`: List all subdirectories.
-   `read <PATH>`: Display file content.
    -   `--bytes`: Show content in hexadecimal format.
-   `write <PATH> <DATA>`: Write string to file.
    -   `--append`: Add to existing content instead of overwriting.
-   `copy <SRC> <DEST>`: Duplicate file or directory.
    -   `--progress`: Show transfer progress bar.
-   `move <SRC> <DEST>`: Relocate or rename file or directory.
-   `rm <PATH>`: Delete file or directory.
    -   `--force`: Bypass confirmations.
-   `mkdir <PATH>`: Create new directory.
    -   `--parents`: Create missing parent directories.
-   `touch <PATH>`: Create empty file or update access/modification timestamps.
-   `stats <PATH>`: Display detailed technical metadata for a file or directory.
-   `hash <PATH>`: Calculate SHA-256 checksum.
-   `verify <PATH> <HASH>`: Compare file checksum against a provided SHA-256 string.
-   `size <PATH>`: Show total size.
    -   `--human`: Format in KB, MB, GB, etc.
-   `link <SRC> <DEST>`: Create a symbolic link.
-   `check <PATH>`: Validate file existence and basic permissions.
-   `chmod <PATH> <MODE>`: Change Unix permissions (e.g., "755").
-   `watch <PATH>`: Continuous monitoring for filesystem events.
    -   `--duration <SECONDS>`: Set monitoring window (default 60s).
-   `stream <PATH>`: Stream file content in chunks for efficient processing of large files.
    -   `--chunk-size <BYTES>`: Size of each chunk in bytes (default 8192).
    -   `--hex`: Output content in hexadecimal format for binary files.

### System (sys)

-   `info`: General system specifications.
    -   `--extended`: Include BIOS and kernel details.
-   `cpu`: Processor architecture and core information.
    -   `--cores`: Real-time per-core usage percentages.
-   `memory`: RAM and Swap utilization.
    -   `--watch`: Live memory monitoring.
-   `disks`: Storage device analysis.
    -   `--mount <DIR>`: Focus on a specific mount point.
-   `network`: Network interface analysis.
    -   `--interface <NAME>`: Focus on specific hardware interface.
-   `processes`: Active process tree.
    -   `--pid <NUM>`: Filter by specific process ID.
    -   `--top-cpu <N>`: Show N processes consuming most CPU.
    -   `--top-mem <N>`: Show N processes consuming most memory.
-   `temp`: Internal thermal sensor readings.
-   `health`: Run diagnostic checks and return a system health score.
-   `env [VAR]`: List all environment variables or retrieve a specific one.
-   `paths`: List important system directories (Home, Config, Cache, Data, Temp).
-   `user`: Current session information and user details.
-   `kill <PID>`: Terminate a specific process.
-   `quick`: Rapid performance snapshot for terminal dashboards.

### Archive and Compression (archive)

-   `compress <SRC> <DEST>`: Compress file using GZIP.
-   `decompress <SRC> <DEST>`: Decompress GZIP archive.
-   `tar <DIR> <OUTPUT>`: Create a TAR archive from a directory.
-   `untar <ARCHIVE> <DEST>`: Extract TAR archive contents.

### Search and Batch (search)

-   `find <PATH> --pattern <REGEX>`: Locate files by filename pattern.
-   `ext <PATH> <EXTENSION>`: Filter files by specific extension.
-   `modified <PATH> --hours <N>`: Find files changed in the last N hours.
-   `grep <PATH> <PATTERN>`: Search for text patterns within files.
-   `rename <PATH> <PATTERN> <REPLACEMENT>`: Batch rename files.
    -   `--dry-run`: Preview changes without modifying files.

### Monitoring (monitor)

-   `system`: Live dashboard of CPU, RAM, and Process count.
    -   `--duration <SECONDS>`: Monitoring period.
    -   `--interval <SECONDS>`: Refresh rate.
-   `process <PID>`: Dedicated monitoring for a specific process (CPU, RAM, Disk I/O).

## Security and Compliance

All modifications to this codebase are considered works made for hire assigned to NEHONIX. Prohibited activities include unauthorized copying, distribution, reverse engineering, or commercial use outside of NEHONIX.

For questions or permissions, contact the NEHONIX Legal Department at legal@nehonix.com.


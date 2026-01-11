# XyPriss System CLI (xypriss-sys)

Professional high-performance system and filesystem management tool developed in Rust for the Nehonix ecosystem. This tool provides a unified interface for advanced filesystem operations and comprehensive system monitoring.

## Access Restrictions

This software is exclusively for use by Authorized Personnel of NEHONIX. It is intended for Internal Use only within NEHONIX operations. No rights are granted to unauthorized individuals or entities.

## Overview

XyPriss System CLI is designed to replace and enhance legacy Node.js filesystem modules with a high-performance Rust implementation. It offers a robust command-line interface and internal API for system administration, monitoring, and file management tasks.

## Key Modules

### Filesystem Engine (XyPrissFS)

-   High-performance recursive directory traversal and listing.
-   Advanced path resolution, normalization, and relative path calculations.
-   Comprehensive file statistics including size, timestamps, and permissions.
-   Atomic read/write operations for text, binary, and JSON formats.
-   Advanced search capabilities using regular expressions.
-   File content searching (Grep functionality).
-   Secure hashing (SHA-256) and integrity verification.
-   Integrated compression supporting GZIP and TAR archiving.
-   Real-time file system monitoring and event notifications.
-   Parallel processing for batch operations.

### System Intelligence (XyPrissSys)

-   Detailed hardware information including CPU branding and core counts.
-   Real-time per-core and global CPU usage monitoring.
-   Comprehensive memory analysis (RAM and Swap usage).
-   Storage management with mount point detection and space analysis.
-   Network interface statistics and traffic measurement.
-   Advanced process management including filtering, statistics, and termination.
-   Environmental data retrieval (Variables, system paths, user information).
-   Automated system health scoring and diagnostic monitoring.

## Installation and Requirements

### Prerequisites

-   Rust Compiler (v1.80 or later)
-   Cargo Package Manager
-   Unix-based environment (primary target)

### Build Instructions

```bash
cd tools/xypriss-sys
cargo build --release
```

## Command Usage

The CLI follows a standard subcommand structure: `xypriss <COMMAND> <ACTION> [OPTIONS]`

### Filesystem Operations

-   `fs ls <PATH> [--stats] [--recursive]`: List directory contents with optional metadata.
-   `fs read <PATH> [--bytes]`: Retrieve file contents.
-   `fs write <PATH> <CONTENT> [--append]`: Create or modify files.
-   `fs hash <PATH>`: Generate SHA-256 checksum.
-   `fs size <PATH> [--human]`: Calculate total size (supports directories).
-   `fs watch <PATH>`: Monitor changes in real-time.

### System Information

-   `sys info`: Display general system specifications.
-   `sys quick`: Provide a rapid performance snapshot (CPU, RAM, Uptime).
-   `sys cpu [--cores]`: Detailed processor information.
-   `sys memory`: Current memory utilization stats.
-   `sys disks`: Attached storage information.
-   `sys processes [--top-cpu] [--top-mem]`: Active process analysis.

### Search and Monitoring

-   `search find <PATH> --pattern <REGEX>`: Locate files by name.
-   `search grep <PATH> <PATTERN>`: Search for content within files.
-   `search rename <PATH> <PATTERN> <REPLACEMENT> [--dry-run]`: Batch rename files with preview.
-   `monitor system --duration <SECONDS>`: Live system performance monitoring.

## Global Options

-   `--json`: Output results in structured JSON format for machine readability.
-   `--verbose`: Enable detailed logging.
-   `--root <DIR>`: Set the base directory for filesystem operations.

## Security and Compliance

All modifications to this codebase are considered works made for hire assigned to NEHONIX. Prohibited activities include unauthorized copying, distribution, reverse engineering, or commercial use outside of NEHONIX.

For questions or permissions, contact the NEHONIX Legal Department at legal@nehonix.com.


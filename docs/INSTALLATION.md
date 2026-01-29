# XyPriss CLI — Installation Guide

This document provides step-by-step instructions for installing the XyPriss CLI (`xyp`, also known as `xfpm`) on all supported operating systems.

---

## Requirements

Before installing, ensure the following prerequisites are met:

- **Node.js**: Version 18 or later is required.
- **Internet connection**: Needed to download the optimized Rust engine during installation.

---

## Installation (Unified Installer)

XyPriss is distributed through a unified installer that automatically detects your operating system and CPU architecture, then installs the appropriate binary and configures your PATH.

### Linux & macOS

Open a terminal and run:

```bash
curl -sL https://xypriss.nehonix.com/install.js | node
```

### Windows (PowerShell)

Run the following command in PowerShell:

```powershell
Invoke-WebRequest -Uri https://xypriss.nehonix.com/install.js -OutFile install.js; node install.js; Remove-Item install.js
```

The installer will download the engine, configure aliases, and make the CLI globally accessible.

---

## Updating XyPriss

To update to the latest version, simply re-run the installation command for your platform.

If an existing installation is detected, the installer will prompt you before overwriting it with the newest version.

---

## Uninstallation

To completely remove XyPriss and all related aliases:

### Linux / macOS

```bash
curl -sL https://xypriss.nehonix.com/install.js | node - uninstall
```

### Windows (PowerShell)

```powershell
Invoke-WebRequest -Uri https://xypriss.nehonix.com/install.js -OutFile install.js; node install.js uninstall; Remove-Item install.js
```

This removes the engine binaries and PATH mappings created by the installer.

---

## Verification

After installation, verify that XyPriss is available by running:

```bash
xyp
```

or

```bash
xfpm
```

You should see the current XFPM version along with architecture information.

---

## Troubleshooting

### Permission denied (Linux/macOS)

If you encounter an `EACCES` error, the installer may require elevated privileges to create symlinks in `/usr/local/bin`.
You will be prompted for your password if necessary.

---

### PowerShell execution policy (Windows)

If PowerShell blocks the script, enable local script execution with:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then re-run the installer.

---

### Command not found after installation

If `xyp` or `xfpm` is not recognized:

1. Restart your terminal to refresh environment variables.
2. On Linux/macOS, ensure `/usr/local/bin` is included in your `$PATH`.
3. On Windows, verify that `$HOME\.xypriss\bin` exists in your User PATH (added automatically by the installer).


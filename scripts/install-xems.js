#!/usr/bin/env node

/**
 * XEMS Installer Script
 * Downloads or builds the XEMS (XyPriss Entry Management System) binary.
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BIN_DIR = path.join(__dirname, "..", "bin");
const XEMS_REPO = "https://github.com/Nehonix-Team/XyPriss-XEMS";
const CDN_BASE_URL = "https://dll.nehonix.com/dl/mds/xems/bin"; // Fallback CDN

/**
 * Get platform-specific binary information for XEMS
 */
function getPlatformBinary() {
    const platform = process.platform;
    const arch = process.arch;

    let binaryName;
    if (platform === "win32") {
        binaryName =
            arch === "arm64"
                ? "xems-windows-arm64.exe"
                : "xems-windows-x64.exe";
    } else if (platform === "darwin") {
        binaryName = arch === "arm64" ? "xems-darwin-arm64" : "xems-darwin-x64";
    } else if (platform === "linux") {
        binaryName = arch === "arm64" ? "xems-linux-arm64" : "xems-linux-x64";
    } else {
        return null;
    }

    return {
        binaryName,
        url: `${CDN_BASE_URL}/${binaryName}`,
        localPath: path.join(BIN_DIR, binaryName),
        genericPath: path.join(
            BIN_DIR,
            "xems" + (platform === "win32" ? ".exe" : ""),
        ),
    };
}

async function installXems() {
    console.log("🚀 Installing XEMS binary...");

    if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
    }

    // Strategy 1: Build from source if local source exists (Development)
    const localSource = path.join(__dirname, "..", "tools", "XEMS");
    if (fs.existsSync(localSource)) {
        console.log("🔨 Local source detected. Building XEMS from source...");
        try {
            const buildCmd =
                process.platform === "win32"
                    ? `cd "${localSource}" && go build -o "../../bin/xems.exe" ./cmd/xems/main.go`
                    : `cd "${localSource}" && go build -o "../../bin/xems" ./cmd/xems/main.go`;

            execSync(buildCmd, { stdio: "inherit" });
            console.log("✅ XEMS built successfully from local source.");
            return;
        } catch (err) {
            console.warn(
                "⚠️ Failed to build XEMS from local source, trying other methods...",
            );
        }
    }

    // Strategy 2: Download from GitHub Releases / CDN (Production)
    const info = getPlatformBinary();
    if (info) {
        console.log(
            `🌐 Downloading pre-built binary for ${process.platform}-${process.arch}...`,
        );
        // Note: For now we'll just log and suggest building.
        // Real implementation would use https.get to download as in install-memory-cli.js
        // console.warn(
        //     "⚠️ Binary download not yet implemented for the new repo. Please ensure 'go' is installed and build from source.",
        // );
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    installXems().catch((err) => {
        console.error("❌ XEMS Installation failed:", err);
    });
}

export { installXems };


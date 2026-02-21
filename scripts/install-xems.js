#!/usr/bin/env node

/**
 * XEMS Installer Script
 * Downloads the XEMS (XyPriss Entry Management System) binary from GitHub Releases.
 * Supports cross-platform: Windows, Linux, and macOS (Intel & Silicon).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────
//  ANSI Color Palette
// ─────────────────────────────────────────────
const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",

    // Foreground
    white: "\x1b[97m",
    gray: "\x1b[90m",
    red: "\x1b[91m",
    green: "\x1b[92m",
    yellow: "\x1b[93m",
    blue: "\x1b[94m",
    magenta: "\x1b[95m",
    cyan: "\x1b[96m",
};

// ─────────────────────────────────────────────
//  Logger
// ─────────────────────────────────────────────
const log = {
    info: (msg) =>
        console.log(
            `${c.cyan}${c.bold}  ℹ ${c.reset}${c.white}${msg}${c.reset}`,
        ),
    success: (msg) =>
        console.log(
            `${c.green}${c.bold}  ✔ ${c.reset}${c.green}${msg}${c.reset}`,
        ),
    warn: (msg) =>
        console.log(
            `${c.yellow}${c.bold}  ⚠ ${c.reset}${c.yellow}${msg}${c.reset}`,
        ),
    error: (msg) =>
        console.log(`${c.red}${c.bold}  ✖ ${c.reset}${c.red}${msg}${c.reset}`),
    step: (msg) =>
        console.log(
            `${c.magenta}${c.bold}  ▶ ${c.reset}${c.magenta}${msg}${c.reset}`,
        ),
    link: (label, url) =>
        console.log(
            `${c.gray}    └─ ${c.dim}${label}:${c.reset} ${c.blue}${url}${c.reset}`,
        ),
    detail: (msg) => console.log(`${c.gray}    ${msg}${c.reset}`),
    divider: () => console.log(`${c.gray}  ${"─".repeat(52)}${c.reset}`),
    blank: () => console.log(),
};

// ─────────────────────────────────────────────
//  Constants
// ─────────────────────────────────────────────
const BIN_DIR = path.join(__dirname, "..", "bin");
const REPO = "Nehonix-Team/XyPriss-XEMS";
const CDN_BASE_URL = "https://dll.nehonix.com/dl/mds/xems/bin";

// ─────────────────────────────────────────────
//  Platform Detection
// ─────────────────────────────────────────────

/**
 * Returns platform-specific binary metadata for XEMS.
 * Maps to the files in tools/XEMS/dist/
 */
function getPlatformBinary() {
    const platform = process.platform;
    const arch = process.arch;

    let binaryTarget;
    if (platform === "win32") {
        binaryTarget = arch === "arm64" ? "windows-arm64" : "windows-x64";
    } else if (platform === "darwin") {
        binaryTarget = arch === "arm64" ? "darwin-arm64" : "darwin-x64";
    } else if (platform === "linux") {
        binaryTarget = arch === "arm64" ? "linux-arm64" : "linux-x64";
    } else {
        return null;
    }

    const ext = platform === "win32" ? ".exe" : "";
    const binaryName = `xems-${binaryTarget}${ext}`;

    return {
        binaryName,
        platform,
        arch,
        url: `https://github.com/${REPO}/releases/latest/download/${binaryName}`,
        fallbackUrl: `${CDN_BASE_URL}/${binaryName}`,
        localPath: path.join(BIN_DIR, binaryName),
        genericPath: path.join(BIN_DIR, `xems${ext}`),
    };
}

// ─────────────────────────────────────────────
//  Downloader (with redirect support)
// ─────────────────────────────────────────────

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = https.get(
            url,
            { headers: { "User-Agent": "XyPriss-Installer" } },
            (response) => {
                // Follow redirects
                if (
                    response.statusCode >= 300 &&
                    response.statusCode < 400 &&
                    response.headers.location
                ) {
                    file.close();
                    fs.unlinkSync(dest);
                    return downloadFile(response.headers.location, dest)
                        .then(resolve)
                        .catch(reject);
                }

                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(dest);
                    return reject(
                        new Error(
                            `Server responded with HTTP ${response.statusCode}`,
                        ),
                    );
                }

                // Stream progress dots
                let received = 0;
                process.stdout.write(`${c.gray}    └─ Downloading `);
                response.on("data", (chunk) => {
                    received += chunk.length;
                    if (received % (50 * 1024) < chunk.length)
                        process.stdout.write(`${c.blue}.${c.reset}`);
                });

                response.pipe(file);
                file.on("finish", () => {
                    process.stdout.write(` ${c.green}done${c.reset}\n`);
                    file.close();
                    resolve();
                });
            },
        );

        request.on("error", (err) => {
            file.close();
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            reject(err);
        });
    });
}

// ─────────────────────────────────────────────
//  Main Installer
// ─────────────────────────────────────────────

async function installXems() {
    log.blank();
    log.divider();
    console.log(
        `${c.cyan}${c.bold}  XEMS Installer — XyPriss Entry Management System${c.reset}`,
    );
    log.divider();
    log.blank();

    // Ensure bin directory exists
    if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
        log.detail(`Created bin directory: ${BIN_DIR}`);
    }

    const info = getPlatformBinary();
    if (!info) {
        log.error(
            "Unsupported platform/architecture. XEMS cannot be installed.",
        );
        return;
    }

    log.info(
        `Platform  : ${c.yellow}${info.platform}${c.reset} ${c.gray}(${info.arch})${c.reset}`,
    );
    log.info(`Binary    : ${c.yellow}${info.binaryName}${c.reset}`);
    log.info(`Target    : ${c.yellow}${BIN_DIR}${c.reset}`);
    log.blank();

    // Skip if already installed
    if (fs.existsSync(info.genericPath)) {
        log.success(`XEMS is already installed → ${info.genericPath}`);
        log.blank();
        return;
    }

    // Attempt GitHub download, then fallback CDN
    log.step("Downloading XEMS binary…");
    try {
        try {
            log.link("GitHub", info.url);
            await downloadFile(info.url, info.localPath);
            log.success("Downloaded from GitHub.");
        } catch (githubErr) {
            log.warn(`GitHub download failed: ${githubErr.message}`);
            log.step("Retrying with fallback CDN…");
            log.link("CDN", info.fallbackUrl);
            await downloadFile(info.fallbackUrl, info.localPath);
            log.success("Downloaded from fallback CDN.");
        }

        // Set executable bit on Unix
        if (process.platform !== "win32") {
            fs.chmodSync(info.localPath, 0o755);
            log.detail("Executable permission set (chmod 755).");
        }

        // Create generic alias (symlink on Unix, copy on Windows)
        if (process.platform === "win32") {
            fs.copyFileSync(info.localPath, info.genericPath);
            log.detail(`Copied binary → ${info.genericPath}`);
        } else {
            if (fs.existsSync(info.genericPath))
                fs.unlinkSync(info.genericPath);
            fs.symlinkSync(path.basename(info.localPath), info.genericPath);
            log.detail(`Symlink created → ${info.genericPath}`);
        }

        log.blank();
        log.success(
            `XEMS successfully installed at: ${c.bold}${info.genericPath}${c.reset}`,
        );
    } catch (err) {
        log.blank();
        log.error(`XEMS installation failed: ${err.message}`);
    }

    log.blank();
    log.divider();
    log.blank();
}

// ─────────────────────────────────────────────
//  Entry Point
// ─────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
    installXems().catch((error) => {
        log.error(`Fatal error: ${error.message}`);
        process.exit(0);
    });
}

export { installXems };

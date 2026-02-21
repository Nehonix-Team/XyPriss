#!/usr/bin/env node

/**
 * XSYS Installer Script
 * Downloads the XSYS (XyPriss System Core) binary from GitHub Releases.
 * Supports cross-platform: Windows, Linux, and macOS (Intel & Silicon).
 */

import fs from "fs";
import { join, dirname, basename } from "path";
import { platform, arch } from "os";
import https from "https";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─────────────────────────────────────────────
//  ANSI Color Palette
// ─────────────────────────────────────────────
const c = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
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
const REPO = "Nehonix-Team/XyPriss";
const BIN_NAME = "xsys";
const BIN_DIR = join(__dirname, "..", "bin");

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

async function installXsys() {
    log.blank();
    log.divider();
    console.log(
        `${c.cyan}${c.bold}  XSYS Installer — XyPriss System Core${c.reset}`,
    );
    log.divider();
    log.blank();

    // Ensure bin directory exists
    if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
        log.detail(`Created bin directory: ${BIN_DIR}`);
    }

    const osName = platform();
    const archName = arch();

    // Map to binary target name
    let binaryTarget = "";
    if (osName === "linux") {
        binaryTarget = archName === "arm64" ? "linux-arm64" : "linux-amd64";
    } else if (osName === "darwin") {
        binaryTarget = archName === "arm64" ? "darwin-arm64" : "darwin-amd64";
    } else if (osName === "win32") {
        binaryTarget = archName === "arm64" ? "windows-arm64" : "windows-amd64";
    } else {
        log.error(`Unsupported platform: ${osName}`);
        return;
    }

    const ext = osName === "win32" ? ".exe" : "";
    const binaryFileName = `${BIN_NAME}-${binaryTarget}${ext}`;
    const url = `https://github.com/${REPO}/releases/latest/download/${binaryFileName}`;
    const localPath = join(BIN_DIR, binaryFileName);
    const genericPath = join(BIN_DIR, `${BIN_NAME}${ext}`);

    log.info(
        `Platform  : ${c.yellow}${osName}${c.reset} ${c.gray}(${archName})${c.reset}`,
    );
    log.info(`Binary    : ${c.yellow}${binaryFileName}${c.reset}`);
    log.info(`Target    : ${c.yellow}${BIN_DIR}${c.reset}`);
    log.blank();

    // Skip if already installed
    if (fs.existsSync(genericPath)) {
        log.success(`XSYS is already installed → ${genericPath}`);
        log.blank();
        return;
    }

    // Download
    log.step("Downloading XSYS binary…");
    log.link("GitHub", url);

    try {
        await downloadFile(url, localPath);

        // Set executable bit on Unix
        if (osName !== "win32") {
            fs.chmodSync(localPath, 0o755);
            log.detail("Executable permission set (chmod 755).");
        }

        // Create generic alias (symlink on Unix, copy on Windows)
        if (osName === "win32") {
            fs.copyFileSync(localPath, genericPath);
            log.detail(`Copied binary → ${genericPath}`);
        } else {
            if (fs.existsSync(genericPath)) fs.unlinkSync(genericPath);
            fs.symlinkSync(basename(localPath), genericPath);
            log.detail(`Symlink created → ${genericPath}`);
        }

        log.blank();
        log.success(
            `XSYS successfully installed at: ${c.bold}${genericPath}${c.reset}`,
        );
    } catch (err) {
        log.blank();
        log.error(`XSYS installation failed: ${err.message}`);
    }

    log.blank();
    log.divider();
    log.blank();
}

// ─────────────────────────────────────────────
//  Entry Point
// ─────────────────────────────────────────────

if (import.meta.url === `file://${process.argv[1]}`) {
    installXsys().catch(() => process.exit(0));
}

export { installXsys };

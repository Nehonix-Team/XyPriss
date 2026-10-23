#!/usr/bin/env node

/**
 * XHSC Installer Script
 * Downloads the XHSC (XyPriss Hyper-System Core) binary from GitHub Releases.
 * Supports cross-platform: Windows, Linux, and macOS (Intel & Silicon).
 */

import fs from "fs";
import path from "path";
import { platform, arch } from "os";
import https from "https";
import zlib from "node:zlib";
import { fileURLToPath } from "url";

const isMain =
    process.argv[1] &&
    (fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
        import.meta.url === `file://${process.argv[1]}` ||
        fileURLToPath(import.meta.url).endsWith(
            process.argv[1].replace(/^\.\//, ""),
        ));

const { join, dirname, basename } = path;

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
const BIN_NAME = "xhsc";
const BIN_DIR = join(__dirname, "..", "bin");

// ─────────────────────────────────────────────
//  Downloader (with redirect support)
// ─────────────────────────────────────────────

function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function renderProgressBar(received, total, startTime) {
    const barWidth = 26;
    const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.001);
    const speed = received / elapsedSec;
    const speedStr = `${formatBytes(speed)}/s`;

    if (total > 0) {
        const ratio = Math.min(Math.max(received / total, 0), 1);
        const percent = (ratio * 100).toFixed(1);
        const filled = Math.round(barWidth * ratio);
        const empty = Math.max(barWidth - filled, 0);
        const bar = `${c.cyan}${"█".repeat(filled)}${c.gray}${"░".repeat(empty)}${c.reset}`;
        const sizeStr = `${formatBytes(received)} / ${formatBytes(total)}`;

        process.stdout.write(
            `\r${c.gray}    └─ [${bar}] ${c.bold}${c.white}${percent.padStart(5)}%${c.reset} ${c.dim}(${sizeStr}, ${speedStr})${c.reset}   `,
        );
    } else {
        const sizeStr = formatBytes(received);
        process.stdout.write(
            `\r${c.gray}    └─ ${c.cyan}↓${c.reset} ${c.white}${sizeStr}${c.reset} ${c.dim}(${speedStr})${c.reset}   `,
        );
    }
}

function downloadFile(url, dest, isGz = false) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = https.get(
            url,
            {
                agent: false,
                headers: {
                    "User-Agent": "XyPriss-Installer",
                    Connection: "close",
                },
            },
            (response) => {
                // Follow redirects
                if (
                    response.statusCode >= 300 &&
                    response.statusCode < 400 &&
                    response.headers.location
                ) {
                    file.close();
                    if (fs.existsSync(dest)) try { fs.unlinkSync(dest); } catch {}
                    return downloadFile(response.headers.location, dest, isGz)
                        .then(resolve)
                        .catch(reject);
                }

                if (response.statusCode !== 200) {
                    file.close();
                    if (fs.existsSync(dest)) try { fs.unlinkSync(dest); } catch {}
                    const err = new Error(
                        `Server responded with HTTP ${response.statusCode}`,
                    );
                    err.statusCode = response.statusCode;
                    return reject(err);
                }

                const total = parseInt(
                    response.headers["content-length"] || "0",
                    10,
                );
                let received = 0;
                const startTime = Date.now();
                let lastRenderTime = 0;

                renderProgressBar(0, total, startTime);

                response.on("data", (chunk) => {
                    received += chunk.length;
                    const now = Date.now();
                    if (now - lastRenderTime > 50 || received === total) {
                        lastRenderTime = now;
                        renderProgressBar(received, total, startTime);
                    }
                });

                if (isGz) {
                    const gunzip = zlib.createGunzip();
                    gunzip.on("error", (err) => {
                        file.close();
                        if (fs.existsSync(dest)) try { fs.unlinkSync(dest); } catch {}
                        process.stdout.write("\n");
                        reject(new Error(`Decompression error: ${err.message}`));
                    });
                    response.pipe(gunzip).pipe(file);
                } else {
                    response.pipe(file);
                }

                file.on("finish", () => {
                    file.close(() => {
                        if (total > 0 && received < total) {
                            if (fs.existsSync(dest)) {
                                try { fs.unlinkSync(dest); } catch {}
                            }
                            process.stdout.write(`\n`);
                            return reject(
                                new Error(
                                    `Download incomplete: received ${received} of ${total} bytes`,
                                ),
                            );
                        }
                        renderProgressBar(received, total || received, startTime);
                        process.stdout.write(` ${c.green}${c.bold}✔ Done${c.reset}\n`);
                        resolve();
                    });
                });
            },
        );

        request.on("error", (err) => {
            file.close();
            if (fs.existsSync(dest)) try { fs.unlinkSync(dest); } catch {}
            process.stdout.write("\n");
            reject(err);
        });
    });
}

// ─────────────────────────────────────────────
//  Main Installer
// ─────────────────────────────────────────────

async function installXHSC() {
    log.blank();
    log.divider();
    console.log(
        `${c.cyan}${c.bold}  XHSC Installer — XyPriss Hyper-System Core${c.reset}`,
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
    const gzFileName = `${binaryFileName}.gz`;
    const gzUrl = `https://github.com/${REPO}/releases/latest/download/${gzFileName}`;
    const rawUrl = `https://github.com/${REPO}/releases/latest/download/${binaryFileName}`;
    const localPath = join(BIN_DIR, binaryFileName);
    const genericPath = join(BIN_DIR, `${BIN_NAME}${ext}`);

    log.info(
        `Platform  : ${c.yellow}${osName}${c.reset} ${c.gray}(${archName})${c.reset}`,
    );
    log.info(`Binary    : ${c.yellow}${binaryFileName}${c.reset}`);
    log.info(`Target    : ${c.yellow}${BIN_DIR}${c.reset}`);
    log.blank();

    // Skip if already installed and healthy
    const checkTarget = fs.existsSync(genericPath) ? genericPath : (fs.existsSync(localPath) ? localPath : null);
    if (checkTarget) {
        try {
            const stat = fs.statSync(checkTarget);
            if (stat.size > 30 * 1024 * 1024) {
                // Ensure generic alias exists
                if (!fs.existsSync(genericPath)) {
                    if (osName === "win32") {
                        fs.copyFileSync(localPath, genericPath);
                    } else {
                        fs.symlinkSync(basename(localPath), genericPath);
                    }
                }
                log.success(`XHSC is already installed → ${genericPath}`);
                log.blank();
                return;
            } else {
                log.warn(`Existing binary is corrupted or incomplete (${formatBytes(stat.size)}), re-downloading…`);
                try { fs.unlinkSync(genericPath); } catch {}
                try { fs.unlinkSync(localPath); } catch {}
            }
        } catch {
            // Re-download on stat error
        }
    }

    // Download: prefer compressed .gz archive, fallback to raw binary
    log.step("Downloading XHSC binary…");

    try {
        try {
            log.link("GitHub (.gz)", gzUrl);
            await downloadFile(gzUrl, localPath, true);
        } catch (gzErr) {
            log.detail(
                `Compressed asset unavailable (${gzErr.message}), falling back to raw binary…`,
            );
            log.link("GitHub (raw)", rawUrl);
            await downloadFile(rawUrl, localPath, false);
        }

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
            `XHSC successfully installed at: ${c.bold}${genericPath}${c.reset}`,
        );
    } catch (err) {
        log.blank();
        log.error(`XHSC installation failed: ${err.message}`);
    }

    log.blank();
    log.divider();
    log.blank();
}

// Entry point handled above
if (isMain) {
    installXHSC()
        .then(() => process.exit(0))
        .catch((error) => {
            log.error(`Fatal error: ${error.message}`);
            process.exit(1);
        });
}

export { installXHSC };


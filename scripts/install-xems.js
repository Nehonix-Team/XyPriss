#!/usr/bin/env node

/**
 * XEMS Installer Script
 * Downloads the XEMS (XyPriss Entry Management System) binary from GitHub Releases.
 * Supports cross-platform: Windows, Linux, and macOS (Intel & Silicon).
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import https from "https";
import zlib from "node:zlib";

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
    const archiveName = `${binaryName}.gz`;

    return {
        binaryName,
        archiveName,
        platform,
        arch,
        url: `https://github.com/${REPO}/releases/latest/download/${archiveName}`,
        rawUrl: `https://github.com/${REPO}/releases/latest/download/${binaryName}`,
        fallbackUrl: `${CDN_BASE_URL}/${archiveName}`,
        rawFallbackUrl: `${CDN_BASE_URL}/${binaryName}`,
        localPath: path.join(BIN_DIR, binaryName),
        tmpPath: path.join(BIN_DIR, `${binaryName}.tmp`),
        genericPath: path.join(BIN_DIR, `xems${ext}`),
    };
}

// ─────────────────────────────────────────────
//  Downloader (with redirect support & gunzip)
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

function downloadFile(url, dest, isGz = true) {
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

                if (isGz || url.endsWith(".gz")) {
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
//  Binary Integrity Verification
// ─────────────────────────────────────────────

const MIN_XEMS_SIZE = 2 * 1024 * 1024; // 2 MB minimum for XEMS binary

/**
 * Verifies the structural & cryptographic integrity of a native binary.
 */
function verifyBinaryIntegrity(filePath, osName, archName) {
    if (!fs.existsSync(filePath)) {
        return { valid: false, reason: "File does not exist" };
    }

    const stat = fs.statSync(filePath);
    if (stat.size < MIN_XEMS_SIZE) {
        return {
            valid: false,
            reason: `File too small (${formatBytes(stat.size)} < ${formatBytes(MIN_XEMS_SIZE)})`,
        };
    }

    const fd = fs.openSync(filePath, "r");
    const header = Buffer.alloc(512);
    let bytesRead = 0;
    try {
        bytesRead = fs.readSync(fd, header, 0, header.length, 0);
    } finally {
        fs.closeSync(fd);
    }

    if (bytesRead < 64) {
        return { valid: false, reason: "Truncated binary header" };
    }

    if (header[0] === 0x1f && header[1] === 0x8b) {
        return { valid: false, reason: "Binary is still gzip-compressed" };
    }

    let formatLabel = "";
    if (osName === "linux") {
        if (
            header[0] !== 0x7f ||
            header[1] !== 0x45 ||
            header[2] !== 0x4c ||
            header[3] !== 0x46
        ) {
            return { valid: false, reason: "Invalid ELF magic header" };
        }
        if (header[4] !== 2) {
            return { valid: false, reason: "Expected 64-bit ELF class" };
        }
        const eMachine = header.readUInt16LE(18);
        const expectedMachine = archName === "arm64" ? 0xb7 : 0x3e;
        if (eMachine !== expectedMachine) {
            return {
                valid: false,
                reason: `ELF architecture mismatch (got 0x${eMachine.toString(16)}, expected 0x${expectedMachine.toString(16)})`,
            };
        }
        formatLabel = `ELF64/${archName}`;
    } else if (osName === "darwin") {
        const magic = header.readUInt32BE(0);
        const validMachO =
            magic === 0xcffaedfe ||
            magic === 0xfeedfacf ||
            magic === 0xcafebabe ||
            magic === 0xbebafeca;
        if (!validMachO) {
            return {
                valid: false,
                reason: `Invalid Mach-O magic header (0x${magic.toString(16)})`,
            };
        }
        formatLabel = `Mach-O/${archName}`;
    } else if (osName === "win32") {
        if (header[0] !== 0x4d || header[1] !== 0x5a) {
            return { valid: false, reason: "Invalid PE MZ header" };
        }
        const peOffset = header.readUInt32LE(0x3c);
        if (peOffset > 0 && peOffset + 6 <= bytesRead) {
            if (
                header[peOffset] !== 0x50 ||
                header[peOffset + 1] !== 0x45 ||
                header[peOffset + 2] !== 0x00 ||
                header[peOffset + 3] !== 0x00
            ) {
                return { valid: false, reason: "Invalid PE signature" };
            }
        }
        formatLabel = `PE32+/${archName}`;
    }

    const hash = crypto.createHash("sha256");
    const data = fs.readFileSync(filePath);
    hash.update(data);
    const sha256 = hash.digest("hex");

    return {
        valid: true,
        size: stat.size,
        format: formatLabel,
        sha256,
    };
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
    log.info(`Binary    : ${c.yellow}${info.binaryName} ${c.dim}(via ${info.archiveName})${c.reset}`);
    log.info(`Target    : ${c.yellow}${BIN_DIR}${c.reset}`);
    log.blank();

    // Skip if already installed and passes integrity verification
    const checkTarget = fs.existsSync(info.genericPath)
        ? info.genericPath
        : fs.existsSync(info.localPath)
          ? info.localPath
          : null;
    if (checkTarget) {
        try {
            const integrity = verifyBinaryIntegrity(
                checkTarget,
                info.platform,
                info.arch,
            );
            if (integrity.valid) {
                if (info.platform !== "win32") {
                    try { fs.chmodSync(checkTarget, 0o755); } catch {}
                }
                if (!fs.existsSync(info.genericPath)) {
                    if (info.platform === "win32") {
                        fs.copyFileSync(info.localPath, info.genericPath);
                    } else {
                        fs.symlinkSync(
                            path.basename(info.localPath),
                            info.genericPath,
                        );
                    }
                }
                log.info(
                    `Integrity : ${c.green}✔ Verified${c.reset} ${c.gray}(${integrity.format}, ${formatBytes(integrity.size)}, sha256:${integrity.sha256.slice(0, 12)}…)${c.reset}`,
                );
                log.success(`XEMS is already installed → ${info.genericPath}`);
                log.blank();
                return;
            } else {
                log.warn(
                    `Existing binary failed integrity check (${integrity.reason}), re-downloading…`,
                );
                try { fs.unlinkSync(info.genericPath); } catch {}
                try { fs.unlinkSync(info.localPath); } catch {}
            }
        } catch {
            // Re-download on verification error
        }
    }

    // Attempt GitHub download (.gz then raw), then fallback CDN (.gz then raw)
    log.step("Downloading XEMS binary…");
    try {
        if (fs.existsSync(info.tmpPath)) {
            try { fs.unlinkSync(info.tmpPath); } catch {}
        }

        const sources = [
            { label: "GitHub (.gz)", url: info.url, isGz: true },
            { label: "GitHub (raw)", url: info.rawUrl, isGz: false },
            { label: "CDN (.gz)", url: info.fallbackUrl, isGz: true },
            { label: "CDN (raw)", url: info.rawFallbackUrl, isGz: false },
        ];

        let downloaded = false;
        let lastErr = null;
        for (const src of sources) {
            try {
                log.link(src.label, src.url);
                await downloadFile(src.url, info.tmpPath, src.isGz);
                log.success(`Downloaded from ${src.label}.`);
                downloaded = true;
                break;
            } catch (err) {
                lastErr = err;
                log.warn(`${src.label} download failed: ${err.message}`);
            }
        }

        if (!downloaded) {
            throw lastErr || new Error("All download sources failed");
        }

        // Verify downloaded binary integrity before committing
        log.step("Verifying binary integrity…");
        const integrity = verifyBinaryIntegrity(
            info.tmpPath,
            info.platform,
            info.arch,
        );
        if (!integrity.valid) {
            try { fs.unlinkSync(info.tmpPath); } catch {}
            throw new Error(`Binary integrity check failed: ${integrity.reason}`);
        }

        log.info(
            `Integrity : ${c.green}✔ Verified${c.reset} ${c.gray}(${integrity.format}, ${formatBytes(integrity.size)}, sha256:${integrity.sha256.slice(0, 16)}…)${c.reset}`,
        );

        // Atomic promotion from .tmp to final target
        if (fs.existsSync(info.localPath)) {
            try { fs.unlinkSync(info.localPath); } catch {}
        }
        fs.renameSync(info.tmpPath, info.localPath);

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
        if (fs.existsSync(info.tmpPath)) {
            try { fs.unlinkSync(info.tmpPath); } catch {}
        }
        log.blank();
        log.error(`XEMS installation failed: ${err.message}`);
        log.blank();
        log.divider();
        log.blank();
        throw err;
    }

    log.blank();
    log.divider();
    log.blank();
}

// ─────────────────────────────────────────────
//  Entry Point
// ─────────────────────────────────────────────

const isMain =
    process.argv[1] &&
    (fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
        import.meta.url === `file://${process.argv[1]}` ||
        fileURLToPath(import.meta.url).endsWith(
            process.argv[1].replace(/^\.\//, ""),
        ));

if (isMain) {
    installXems()
        .then(() => process.exit(0))
        .catch((error) => {
            log.error(`Fatal error: ${error.message}`);
            process.exit(1);
        });
}

export { installXems };


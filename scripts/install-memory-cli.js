#!/usr/bin/env node

/**
 * XyPriss Memory CLI Installer
 * Downloads platform-specific memory CLI binary during npm install
 */

import https from "https";
import fs from "fs";
import path from "path";
import { execSync, spawn } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CDN_BASE_URL = "https://dll.nehonix.com/dl/mds/xypriss/bin";
const BIN_DIR = path.join(__dirname, "..", "bin");
const TIMEOUT = 40000;

/**
 * Get platform-specific binary information
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

    const binaryName = `memory-cli-${binaryTarget}${platform === "win32" ? ".exe" : ""}`;

    return {
        binaryName,
        url: `${CDN_BASE_URL}/${binaryName}`,
        localPath: path.join(BIN_DIR, binaryName),
        genericPath: path.join(
            BIN_DIR,
            "memory-cli" + (platform === "win32" ? ".exe" : ""),
        ),
    };
}

/**
 * Download file from URL with Redirect support
 */
function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destination);
        const request = https.get(url, { timeout: TIMEOUT }, (response) => {
            if (
                response.statusCode >= 300 &&
                response.statusCode < 400 &&
                response.headers.location
            ) {
                file.close();
                fs.unlinkSync(destination);
                return downloadFile(response.headers.location, destination)
                    .then(resolve)
                    .catch(reject);
            }

            if (response.statusCode === 200) {
                response.pipe(file);
                file.on("finish", () => {
                    file.close();
                    resolve();
                });
            } else {
                file.close();
                fs.unlinkSync(destination);
                reject(new Error(`HTTP ${response.statusCode}`));
            }
        });

        request.on("error", (error) => {
            file.close();
            if (fs.existsSync(destination)) fs.unlinkSync(destination);
            reject(error);
        });
    });
}

/**
 * Verify downloaded binary works
 */
function verifyBinary(filePath) {
    return new Promise((resolve) => {
        try {
            const child = spawn(filePath, ["--help"], {
                stdio: "pipe",
                timeout: 5000,
            });

            let output = "";
            child.stdout.on("data", (data) => {
                output += data.toString();
            });

            child.on("close", (code) => {
                if (code === 0 && output.includes("XyPriss Memory Info CLI")) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });

            child.on("error", () => resolve(false));
        } catch (error) {
            resolve(false);
        }
    });
}

async function installMemoryCLI() {
    if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
    }

    const info = getPlatformBinary();
    if (!info) return;

    console.log(`📂 Target directory: ${BIN_DIR}`);
    console.log(`📦 Binary: ${info.binaryName}`);

    if (fs.existsSync(info.genericPath)) {
        console.log(
            `✨ Memory CLI already present at ${info.genericPath}, skipping.`,
        );
        return;
    }

    try {
        console.log(`📥 Fetching Memory CLI from:`);
        console.log(`   🔗 URL: ${info.url}`);
        await downloadFile(info.url, info.localPath);
        console.log("✅ Downloaded successfully.");

        if (process.platform !== "win32") {
            fs.chmodSync(info.localPath, 0o755);
        }

        if (process.platform === "win32") {
            fs.copyFileSync(info.localPath, info.genericPath);
        } else {
            if (fs.existsSync(info.genericPath))
                fs.unlinkSync(info.genericPath);
            fs.symlinkSync(path.basename(info.localPath), info.genericPath);
        }

        const isValid = await verifyBinary(info.localPath);
        if (isValid) {
            console.log(
                `🎉 XyPriss MCLI installed successfully at: ${info.genericPath}`,
            );
        } else {
            console.warn(
                "⚠️  MCLI verification failed, it might not work as expected.",
            );
        }
    } catch (error) {
        console.error("❌ Failed to install Memory CLI:", error.message);
    }
}

// Only run if this is the main module (not being imported)
if (import.meta.url === `file://${process.argv[1]}`) {
    installMemoryCLI().catch((error) => {
        console.error("💥 Installation failed:", error);
        process.exit(0);
    });
}

export { installMemoryCLI, getPlatformBinary, downloadFile, verifyBinary };


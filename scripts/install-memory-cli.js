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
// Install binary in the package's own bin directory, not user's project
const BIN_DIR = path.join(__dirname, "..", "bin");
const TIMEOUT = 40000; // 40 seconds

/**
 * Get platform-specific binary information
 */
function getPlatformBinary() {
    const platform = process.platform;
    const arch = process.arch;

    let binaryName;
    let downloadName;

    if (platform === "win32") {
        binaryName =
            arch === "arm64"
                ? "memory-cli-windows-arm64.exe"
                : "memory-cli-windows-x64.exe";
        downloadName = binaryName;
    } else if (platform === "darwin") {
        binaryName =
            arch === "arm64"
                ? "memory-cli-darwin-arm64"
                : "memory-cli-darwin-x64";
        downloadName = binaryName;
    } else if (platform === "linux") {
        binaryName = "memory-cli-linux-x64";
        downloadName = binaryName;
    } else {
        console.warn(
            `⚠️  Unsupported platform: ${platform}-${arch}. Memory CLI will use fallback mode.`
        );
        return null;
    }

    return {
        binaryName,
        downloadName,
        url: `${CDN_BASE_URL}/${downloadName}`,
        localPath: path.join(BIN_DIR, binaryName),
        genericPath: path.join(
            BIN_DIR,
            "memory-cli" + (platform === "win32" ? ".exe" : "")
        ),
    };
}

/**
 * Download file from URL
 */
function downloadFile(url, destination) {
    return new Promise((resolve, reject) => {
        console.log(`📥 Downloading ${url}...`);

        const file = fs.createWriteStream(destination);
        const request = https.get(url, { timeout: TIMEOUT }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);

                file.on("finish", () => {
                    file.close();
                    console.log(`✅ Downloaded to ${destination}`);
                    resolve();
                });
            } else if (
                response.statusCode === 302 ||
                response.statusCode === 301
            ) {
                // Handle redirects
                file.close();
                fs.unlinkSync(destination);
                downloadFile(response.headers.location, destination)
                    .then(resolve)
                    .catch(reject);
            } else {
                file.close();
                fs.unlinkSync(destination);
                reject(
                    new Error(
                        `HTTP ${response.statusCode}: ${response.statusMessage}`
                    )
                );
            }
        });

        request.on("error", (error) => {
            file.close();
            if (fs.existsSync(destination)) {
                fs.unlinkSync(destination);
            }
            reject(error);
        });

        request.on("timeout", () => {
            request.destroy();
            file.close();
            if (fs.existsSync(destination)) {
                fs.unlinkSync(destination);
            }
            reject(new Error("Download timeout"));
        });
    });
}

/**
 * Make file executable (Unix-like systems)
 */
function makeExecutable(filePath) {
    if (process.platform !== "win32") {
        try {
            execSync(`chmod +x "${filePath}"`);
            console.log(`🔧 Made ${filePath} executable`);
        } catch (error) {
            console.warn(
                `⚠️  Failed to make ${filePath} executable:`,
                error.message
            );
        }
    }
}

/**
 * Verify downloaded binary works
 */
function verifyBinary(filePath) {
    return new Promise((resolve) => {
        try {
            // spawn is already imported at the top
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
                    console.log(`✅ Binary verification successful`);
                    resolve(true);
                } else {
                    console.warn(
                        `⚠️  Binary verification failed (exit code: ${code})`
                    );
                    resolve(false);
                }
            });

            child.on("error", () => {
                resolve(false);
            });
        } catch (error) {
            resolve(false);
        }
    });
}

/**
 * Main installation function
 */
async function installMemoryCLI() {
    console.log("🚀 Installing XyPriss Memory CLI...");

    // Create bin directory if it doesn't exist
    if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
        console.log(`📁 Created bin directory: ${BIN_DIR}`);
    }

    const binaryInfo = getPlatformBinary();
    if (!binaryInfo) {
        console.log(
            "⚠️  No binary available for this platform. Using fallback mode."
        );
        return;
    }

    try {
        // First, try to copy from development bin if it exists (for development/testing)
        const devBinaryPath = path.join(
            __dirname,
            "..",
            "bin",
            binaryInfo.downloadName
        );
        if (fs.existsSync(devBinaryPath)) {
            console.log(
                `📋 Copying binary from development location: ${devBinaryPath}`
            );
            fs.copyFileSync(devBinaryPath, binaryInfo.localPath);
        } else {
            // Download the binary from CDN
            await downloadFile(binaryInfo.url, binaryInfo.localPath);
        }

        // Make it executable
        makeExecutable(binaryInfo.localPath);

        // Create a generic symlink/copy for easier access
        if (!fs.existsSync(binaryInfo.genericPath)) {
            if (process.platform === "win32") {
                // On Windows, copy the file
                fs.copyFileSync(binaryInfo.localPath, binaryInfo.genericPath);
            } else {
                // On Unix-like systems, create a symlink
                fs.symlinkSync(
                    path.basename(binaryInfo.localPath),
                    binaryInfo.genericPath
                );
            }
            console.log(
                `🔗 Created generic binary link: ${binaryInfo.genericPath}`
            );
        }

        // Verify the binary works
        const isValid = await verifyBinary(binaryInfo.localPath);
        if (!isValid) {
            console.warn(
                "⚠️  Binary verification failed. Memory CLI will use fallback mode."
            );
            return;
        }

        console.log("🎉 XyPriss MCLI installed successfully!");
    } catch (error) {
        console.error("❌ Failed to install Memory CLI:", error.message);
        console.log("Memory CLI will use fallback mode (Node.js os module)");

        // Clean up partial downloads
        if (fs.existsSync(binaryInfo.localPath)) {
            try {
                fs.unlinkSync(binaryInfo.localPath);
            } catch (cleanupError) {
                // Ignore cleanup errors
            }
        }
    }
}

/**
 * Check if we should skip installation
 */
function shouldSkipInstall() {
    // Skip if CI environment variable is set to avoid network calls in CI
    if (
        process.env.CI === "true" ||
        process.env.SKIP_BINARY_DOWNLOAD === "true"
    ) {
        console.log("Skipping binary download (CI environment detected)");
        return true;
    }

    // Remove if binary already exists and is valid
    const binaryInfo = getPlatformBinary();
    if (binaryInfo && fs.existsSync(binaryInfo.localPath)) {
        const unLinkPath = path.dirname(binaryInfo.localPath);
        console.log("Removing MCLI dir to download latest version...");
        fs.rmdirSync(unLinkPath, { recursive: true });
    }

    return false;
}

// Run installation if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    if (!shouldSkipInstall()) {
        installMemoryCLI().catch((error) => {
            console.error("💥 Installation failed:", error);
            process.exit(0); // Don't fail npm install if binary download fails
        });
    }
}

export { installMemoryCLI, getPlatformBinary, downloadFile, verifyBinary };


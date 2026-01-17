#!/usr/bin/env node

/**
 * XyPriss CLI Installer
 *
 * This script automatically downloads the appropriate XyPCLI binary
 * for the current platform from the Nehonix SDK.
 */

const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

// Nehonix SDK download URLs
const SDK_BASE_URL = "https://dll.nehonix.com/dl/mds/xypriss/bin/xypcli";

// Colors for output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ Error: ${message}`, "red");
}

function success(message) {
  log(`✅ ${message}`, "green");
}

function info(message) {
  log(`ℹ️  ${message}`, "blue");
}

// Detect platform and construct download URL
function detectPlatform() {
  const platform = os.platform();
  const arch = os.arch();

  let binaryName;

  switch (platform) {
    case "darwin":
      binaryName =
        arch === "arm64" ? "xypcli-darwin-arm64" : "xypcli-darwin-amd64";
      break;
    case "linux":
      binaryName =
        arch === "arm64" ? "xypcli-linux-arm64" : "xypcli-linux-amd64";
      break;
    case "win32":
      binaryName =
        arch === "arm" ? "xypcli-windows-arm.exe" : "xypcli-windows-amd64.exe";
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }

  const downloadUrl = `${SDK_BASE_URL}/${binaryName}`;

  return { platform, arch, binaryName, downloadUrl };
}

// Download file from URL with redirect handling
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const downloadWithRedirect = (downloadUrl, redirectCount = 0) => {
      if (redirectCount > 5) {
        reject(new Error("Too many redirects"));
        return;
      }

      const protocol = downloadUrl.startsWith("https:") ? https : http;

      const request = protocol.get(
        downloadUrl,
        {
          headers: {
            "User-Agent": "XyPCLI-Installer",
          },
        },
        (response) => {
          // Handle redirects
          if (
            response.statusCode === 301 ||
            response.statusCode === 302 ||
            response.statusCode === 307 ||
            response.statusCode === 308
          ) {
            const redirectUrl = response.headers.location;
            if (redirectUrl) {
              info(`Following redirect to: ${redirectUrl}`);
              downloadWithRedirect(redirectUrl, redirectCount + 1);
              return;
            }
          }

          if (response.statusCode !== 200) {
            reject(
              new Error(`Failed to download: HTTP ${response.statusCode}`)
            );
            return;
          }

          const file = fs.createWriteStream(destPath);
          response.pipe(file);

          file.on("finish", () => {
            file.close();
            resolve();
          });

          file.on("error", (err) => {
            fs.unlink(destPath, () => {}); // Delete the file on error
            reject(err);
          });
        }
      );

      request.on("error", (err) => {
        fs.unlink(destPath, () => {}); // Delete the file on error
        reject(err);
      });

      // Set a longer timeout for larger files
      request.setTimeout(120000, () => {
        // 2 minutes
        request.destroy();
        reject(new Error("Download timeout (2 minutes)"));
      });
    };

    downloadWithRedirect(url);
  });
}

// Make binary executable (Unix-like systems)
function makeExecutable(filePath) {
  if (os.platform() !== "win32") {
    try {
      fs.chmodSync(filePath, "755");
    } catch (err) {
      // Ignore chmod errors on some systems
    }
  }
}

// Get the binary installation path
function getBinaryPath() {
  // Use the same directory as this script
  return path.join(
    __dirname,
    "xypcli" + (os.platform() === "win32" ? ".exe" : "")
  );
}

// Check if binary already exists and is working
function isBinaryInstalled() {
  const binaryPath = getBinaryPath();
  if (!fs.existsSync(binaryPath)) {
    return false;
  }

  try {
    // Try to execute the binary with --version
    execSync(`"${binaryPath}" --version`, { timeout: 5000 });
    return true;
  } catch (err) {
    return false;
  }
}

// Main installation function
async function install() {
  try {
    info("XyPriss CLI Installer");
    info("Detecting platform...");

    const { platform, arch, binaryName, downloadUrl } = detectPlatform();
    info(`Platform detected: ${platform}/${arch}`);
    info(`Binary to download: ${binaryName}`);

    // Check if binary is already installed
    if (isBinaryInstalled()) {
      success(
        "XyPCLI is already installed and working! Run `xypcli --help` or using the alias `xyp --help` to get started."
      );
      return;
    }

    const binaryPath = getBinaryPath();

    info(`Downloading from: ${downloadUrl}`);
    info("This may take a few moments...");

    // Download the binary with retry logic
    let downloadAttempts = 0;
    const maxAttempts = 3;

    while (downloadAttempts < maxAttempts) {
      try {
        downloadAttempts++;
        if (downloadAttempts > 1) {
          info(`Retry attempt ${downloadAttempts}/${maxAttempts}...`);
        }

        await downloadFile(downloadUrl, binaryPath);
        // Rename the downloaded file to the expected name
        const expectedName =
          "xypcli" + (os.platform() === "win32" ? ".exe" : "");
        const expectedPath = path.join(__dirname, expectedName);
        if (binaryPath !== expectedPath) {
          fs.renameSync(binaryPath, expectedPath);
        }
        break; // Success, exit retry loop
      } catch (downloadError) {
        if (downloadAttempts >= maxAttempts) {
          error(
            `Download failed after ${maxAttempts} attempts: ${downloadError.message}`
          );
          console.log("");
          console.log("💡 Troubleshooting tips:");
          console.log("  1. Check your internet connection");
          console.log("  2. Try again in a few minutes");
          console.log("  3. Download manually from:");
          console.log(`     ${downloadUrl}`);
          console.log(`     Save as: ${binaryPath}`);
          console.log("  4. Then re-run: npm install -g xypriss-cli");
          process.exit(1);
        } else {
          info(
            `Download attempt ${downloadAttempts} failed, retrying in 3 seconds...`
          );
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      }
    }

    // Make executable on Unix-like systems
    makeExecutable(binaryPath);

    success(`XyPCLI installed successfully!`);
    info(`Binary location: ${binaryPath}`);

    // Test the installation
    try {
      const version = execSync(`"${binaryPath}" --version`, {
        encoding: "utf8",
      }).trim();
      success(`Installation verified: ${version}`);
    } catch (err) {
      error("Installation verification failed");
      throw err;
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

// If this script is run directly (not as a module)
if (require.main === module) {
  // Check if we should run the CLI or install
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // No arguments, run installation
    install();
  } else {
    // Arguments provided, try to run the CLI
    const binaryPath = getBinaryPath();

    if (!isBinaryInstalled()) {
      log("XyPCLI not found. Installing...");
      install().then(() => {
        // After installation, execute the CLI with the provided arguments
        const { spawn } = require("child_process");
        const child = spawn(binaryPath, args, {
          stdio: "inherit",
          shell: true,
        });

        child.on("exit", (code) => {
          process.exit(code);
        });
      });
    } else {
      // CLI is already installed, execute it directly
      const { spawn } = require("child_process");
      const child = spawn(binaryPath, args, {
        stdio: "inherit",
        shell: true,
      });

      child.on("exit", (code) => {
        process.exit(code);
      });
    }
  }
}

module.exports = { install, detectPlatform };

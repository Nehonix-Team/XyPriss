#!/usr/bin/env node

/**
 * Nehonix XyPriss System CLI Tool - High-performance system & FS management
 *
 * This is the main bridge for the xsys command.
 * It manages the execution of the proprietary Rust-based xsys binary.
 *
 * © 2026 Nehonix Team. All rights reserved.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

// Support ESM __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the path to the xsys binary
 */
function getBinaryPath() {
    const isWin = os.platform() === "win32";
    const binName = isWin ? "xsys.exe" : "xsys";

    // Strategic locations for the binary
    const locations = [
        path.join(__dirname, "..", "bin", binName), // Production (npm install)
        path.join(process.cwd(), "bin", binName), // Local development
        path.join(
            __dirname,
            "..",
            "tools",
            "xypriss-sys",
            "target",
            "release",
            binName
        ), // Dev target
    ];

    for (const loc of locations) {
        if (fs.existsSync(loc)) {
            return loc;
        }
    }

    return null;
}

/**
 * Execute the binary with the provided arguments
 */
function main() {
    const binaryPath = getBinaryPath();
    const args = process.argv.slice(2);

    if (!binaryPath) {
        console.error(
            "\x1b[31m[ERROR] XyPriss System Binary (xsys) not found.\x1b[0m"
        );
        console.error(
            "Please ensure the binary is installed by running: \x1b[36mnpm install xypriss\x1b[0m"
        );
        process.exit(1);
    }

    // Spawn the binary process
    const child = spawn(binaryPath, args, {
        stdio: "inherit",
        env: {
            ...process.env,
            XYPRISS_BINARY_PATH: binaryPath,
            XYPRISS_EXEC_CONTEXT: "npm-bin",
        },
    });

    // Mirror exit signals and codes
    child.on("exit", (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
        } else {
            process.exit(code ?? 0);
        }
    });

    child.on("error", (err) => {
        console.error(
            "\x1b[31m[CRITICAL] Failed to initiate xsys execution:\x1b[0m",
            err.message
        );
        process.exit(1);
    });
}

// Execution entry point
main();


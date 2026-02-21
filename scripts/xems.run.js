#!/usr/bin/env node
/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */

/**
 * Nehonix XEMS CLI Bridge
 *
 * This is the main bridge for the xems command.
 * It manages the execution of the proprietary Go-based XEMS binary.
 *
 * © 2026 Nehonix Team. All rights reserved.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the path to the xems binary
 */
function getBinaryPath() {
    const isWin = os.platform() === "win32";
    const binName = isWin ? "xems.exe" : "xems";

    // Strategic locations for the binary
    const locations = [
        path.join(__dirname, "..", "bin", binName), // Production (npm install)
        path.join(process.cwd(), "bin", binName), // Local development
        path.join(__dirname, "..", "tools", "XEMS", "bin", binName), // Dev target
        path.join(__dirname, "..", "tools", "XEMS", "dist", binName), // Dist target
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
        console.error("\x1b[31m[ERROR] XEMS Binary not found.\x1b[0m");
        console.error(
            "Please ensure the binary is installed by running: \x1b[36mxfpm update xypriss\x1b[0m",
        );
        process.exit(1);
    }

    // Spawn the binary process
    const child = spawn(binaryPath, args, {
        stdio: "inherit",
        env: {
            ...process.env,
            XEMS_BINARY_PATH: binaryPath,
            XEMS_EXEC_CONTEXT: "npm-bin",
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
            "\x1b[31m[CRITICAL] Failed to initiate xems execution:\x1b[0m",
            err.message,
        );
        process.exit(1);
    });
}

main();



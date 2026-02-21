#!/usr/bin/env node
/***************************************************************************
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
 * XFPM: XyPriss Fast Package Manager
 * Bridge Execution Script
 */

const { spawn } = require("child_process");
const os = require("os");
const { getBinaryPath, isBinaryInstalled, install } = require("./install");

async function main() {
  const args = process.argv.slice(2);
  const binaryPath = getBinaryPath();

  if (!isBinaryInstalled()) {
    console.log(
      "\x1b[36mℹ️  XFPM engine not found. Initializing neural bridge...\x1b[0m",
    );
    try {
      await install();
    } catch (err) {
      console.error(
        "\x1b[31m❌ Failed to install XFPM engine:\x1b[0m",
        err.message,
      );
      process.exit(1);
    }
  }

  // Execute the binary with provided arguments
  // If no arguments, we default to --help to provide immediate value
  const finalArgs = args.length === 0 ? ["--help"] : args;

  const child = spawn(binaryPath, finalArgs, {
    stdio: "inherit",
    shell: os.platform() === "win32",
  });

  child.on("exit", (code) => {
    process.exit(code !== null ? code : 1);
  });

  child.on("error", (err) => {
    console.error(
      "\x1b[31m❌ Failed to execute XFPM engine:\x1b[0m",
      err.message,
    );
    process.exit(1);
  });
}

main();

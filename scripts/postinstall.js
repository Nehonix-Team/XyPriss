#!/usr/bin/env node

/**
 * XyPriss Post-Install Script
 * Runs after `npm install` to set up all platform-specific binaries.
 */

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { installXems } from "./install-xems.js";
import { installXHSC } from "./postinstall-xhsc.js";

const isMain =
    process.argv[1] &&
    (fileURLToPath(import.meta.url) === path.resolve(process.argv[1]) ||
        import.meta.url === `file://${process.argv[1]}` ||
        fileURLToPath(import.meta.url).endsWith(
            process.argv[1].replace(/^\.\//, ""),
        ));

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
    step: (n, label) =>
        console.log(
            `${c.magenta}${c.bold}  [${n}] ${c.reset}${c.magenta}${label}${c.reset}`,
        ),
    divider: () => console.log(`${c.gray}  ${"─".repeat(52)}${c.reset}`),
    blank: () => console.log(),
};

// ─────────────────────────────────────────────
//  Steps Definition
// ─────────────────────────────────────────────
const STEPS = [
    { label: "XEMS — XyPriss Entry Management System", fn: installXems },
    { label: "XHSC — XyPriss Hyper-System Core", fn: installXHSC },
];

// ─────────────────────────────────────────────
//  Post-Install Orchestrator
// ─────────────────────────────────────────────
async function postInstall() {
    // ─────────────────────────────────────────────
    //  Caller Verification (Hardened)
    // ─────────────────────────────────────────────
    const isXfpm = (() => {
        try {
            // 1. Initial gate: Check environment variable
            if (process.env.XFPM !== "true") return false;

            // 2. Windows Robust verification
            if (process.platform === "win32") {
                let pid = process.ppid;
                for (let i = 0; i < 2; i++) {
                    const cmd = `wmic process where (processid=${pid}) get ExecutablePath,ParentProcessId /format:list`;
                    const out = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
                    if (out.toLowerCase().includes("xfpm")) return true;
                    const match = out.match(/ParentProcessId=(\d+)/);
                    if (!match) break;
                    pid = parseInt(match[1], 10);
                }
                return process.env.XFPM === "true";
            }

            // 3. Linux/macOS Robust verification: Check process tree via /proc
            if (!fs.existsSync("/proc")) return true;

            let currentPid = process.pid;
            for (let i = 0; i < 3; i++) {
                const statusPath = `/proc/${currentPid}/status`;
                if (!fs.existsSync(statusPath)) break;
                
                const status = fs.readFileSync(statusPath, "utf8");
                const ppidMatch = status.match(/PPid:\s+(\d+)/);
                if (!ppidMatch) break;
                
                currentPid = parseInt(ppidMatch[1], 10);
                
                const commPath = `/proc/${currentPid}/comm`;
                if (fs.existsSync(commPath)) {
                    const comm = fs.readFileSync(commPath, "utf8").trim();
                    if (comm === "xfpm" || comm.includes("xfpm")) return true;
                }
            }
        } catch (e) {
            return process.env.XFPM === "true";
        }
        return false;
    })();
    
    if (!isXfpm) {
        log.blank();
        log.divider();
        log.error("Installation Blocked: Unsupported Package Manager Detected");
        log.info("XyPriss MUST be installed and managed via XFPM (XyPriss Fast Package Manager).");
        log.info("Usage of npm, yarn, or pnpm is strictly forbidden to ensure framework integrity.");
        log.blank();
        log.info("Installation Guide: https://xypriss.nehonix.com/docs/xfpm#installation");
        log.divider();
        log.blank();
        process.exit(1);
    }

    log.blank();
    log.divider();
    console.log(`${c.cyan}${c.bold}  XyPriss — Post-Install Setup${c.reset}`);
    log.divider();
    log.blank();

    const results = [];

    for (let i = 0; i < STEPS.length; i++) {
        const { label, fn } = STEPS[i];
        log.step(`${i + 1}/${STEPS.length}`, label);

        try {
            await fn();
            results.push({ label, ok: true });
        } catch (err) {
            log.warn(`Step "${label}" encountered an issue: ${err.message}`);
            results.push({ label, ok: false, err: err.message });
        }

        log.blank();
    }

    // ── Summary ──────────────────────────────────
    log.divider();
    console.log(`${c.cyan}${c.bold}  Setup Summary${c.reset}`);
    log.divider();

    let allOk = true;
    for (const r of results) {
        if (r.ok) {
            log.success(r.label);
        } else {
            log.warn(`${r.label}  ${c.gray}(skipped: ${r.err})${c.reset}`);
            allOk = false;
        }
    }

    log.blank();

    if (allOk) {
        log.success("All components installed. XyPriss is ready!");
    } else {
        log.warn(
            "Setup completed with warnings. XyPriss will run in fallback mode.",
        );
        log.info(
            "Some features may be limited until missing binaries are installed.",
        );
    }

    log.blank();
    log.divider();
    log.blank();
    process.exit(0);
}

// ─────────────────────────────────────────────
//  Entry Point
// ─────────────────────────────────────────────
if (isMain) {
    postInstall().catch((error) => {
        log.error(`Fatal error during post-install: ${error.message}`);
        process.exit(0); // Don't break `npm install`
    });
}

export { postInstall };


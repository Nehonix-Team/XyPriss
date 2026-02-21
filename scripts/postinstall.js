#!/usr/bin/env node

/**
 * XyPriss Post-Install Script
 * Runs after `npm install` to set up all platform-specific binaries.
 */

import { installMemoryCLI } from "./install-memory-cli.js";
import { installXems } from "./install-xems.js";
import { installXsys } from "./postinstall-xsys.js";

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
    { label: "Memory CLI", fn: installMemoryCLI },
    { label: "XEMS — XyPriss Entry Management System", fn: installXems },
    { label: "XSYS — XyPriss System Core", fn: installXsys },
];

// ─────────────────────────────────────────────
//  Post-Install Orchestrator
// ─────────────────────────────────────────────
async function postInstall() {
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
}

// ─────────────────────────────────────────────
//  Entry Point
// ─────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
    postInstall().catch((error) => {
        log.error(`Fatal error during post-install: ${error.message}`);
        process.exit(0); // Don't break `npm install`
    });
}

export { postInstall };

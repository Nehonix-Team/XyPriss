#!/usr/bin/env node

/**
 * XyPriss Post-Install Script
 * Runs after npm install to set up platform-specific binaries
 */

import { installMemoryCLI } from "./install-memory-cli.js";

async function postInstall() {
    console.log("🔧 Running XyPriss post-install setup...");

    try {
        await installMemoryCLI();
        console.log("✅ XyPriss setup complete!");
    } catch (error) {
        console.warn(
            "⚠️  Post-install setup encountered issues:",
            error.message
        );
        console.log("📝 XyPriss will continue to work with fallback mode.");
    }
}

// Only run if this is the main module (not being imported)
if (import.meta.url === `file://${process.argv[1]}`) {
    postInstall().catch((error) => {
        console.error("💥 Post-install failed:", error);
        // Don't exit with error code to avoid breaking npm install
        process.exit(0);
    });
}

export { postInstall };


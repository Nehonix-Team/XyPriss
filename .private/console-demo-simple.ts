/**
 * Simple Console Interception Demo
 * Demonstrates the console interception feature with a single server instance
 */

import { createServer } from "../src";

const mode = "original";

console.log("\n=== Console Interception Demo ===\n");

// Example 1: Original Mode (Development)
console.log("🔹 Starting Example 1: Mode: " + mode + "\n");

const app = createServer({
    server: { port: 3001 },
    logging: {
        enabled: true,
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                enabled: true,
                mode,
                colorize: true,
            },
        },
    },
});

// Wait for server to initialize
await app.waitForReady();

// Check if interception is active
const interceptor = app.getConsoleInterceptor();
console.log(`✅ Server ready! Interception active: ${interceptor.isActive()}`);
console.log(`📋 Mode: ${mode}\n`);

console.log("📝 This is a normal console.log");
console.warn("⚠️  This is a warning");
console.error("❌ This is an error");
console.info("ℹ️  This is info");

// But it IS being intercepted! Check the stats:
const stats1 = app.getConsoleStats();
console.log("\n📊 Stats prove interception is working:");
console.log(`   Total Interceptions: ${stats1.totalInterceptions}`);
console.log(`   Active: ${stats1.isActive}`);
console.log(
    `   Intercepted: ${stats1.methodCounts.log} logs, ${stats1.methodCounts.warn} warns, ${stats1.methodCounts.error} errors`
);

console.log(`\n💡 Mode '${mode}': Check if output appears as expected`);
console.log("   - 'original': Should see normal console output");
console.log("   - 'intercepted': Should see [USERAPP] prefix");
console.log("   - 'both': Should see both versions");
console.log("   - 'none': Should see nothing (silent)\n");

setTimeout(() => {
    process.exit(0);
}, 1000);


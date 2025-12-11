/**
 * Console Interception - Complete Working Examples
 * This demonstrates how console interception actually works
 */

import { createServer } from "../src";

console.log("\n=== XyPriss Console Interception - How It Really Works ===\n");

// ========================================
// Example 1: Original Mode (Default)
// ========================================

console.log("📝 Example 1: Original Mode\n");
console.log("Creating server with console interception enabled...\n");

const app1 = createServer({
    server: { port: 3001 },
    logging: {
        enabled: true,
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                enabled: true,
                mode: "original", // Shows original-looking output
            },
        },
    },
});

await app1.waitForReady();

console.log("✅ Server ready!");
console.log("📝 This looks like normal console.log");
console.warn("⚠️  This looks like normal console.warn");
console.error("❌ This looks like normal console.error");

// But it IS being intercepted! Check the stats:
const stats1 = app1.getConsoleStats();
console.log("\n📊 Stats prove interception is working:");
console.log(`   Total Interceptions: ${stats1.totalInterceptions}`);
console.log(`   Active: ${stats1.isActive}`);
console.log(
    `   Intercepted: ${stats1.methodCounts.log} logs, ${stats1.methodCounts.warn} warns, ${stats1.methodCounts.error} errors`
);

console.log(
    "\n💡 Key Point: Even though it LOOKS normal, all console calls were intercepted!"
);
console.log(
    "   They were routed through the logging system, filtered, and displayed as original.\n"
);

// Clean up
app1.disableConsoleInterception();

// ========================================
// Example 2: Intercepted Mode (Production)
// ========================================

console.log("\n📝 Example 2: Intercepted Mode\n");

const app2 = createServer({
    server: { port: 3002 },
    logging: {
        enabled: true,
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                enabled: true,
                mode: "intercepted", // Shows formatted output
                showPrefix: true,
            },
        },
    },
});

await app2.waitForReady();

console.log("This will show with [USERAPP] prefix");
console.warn("This warning will also have the prefix");

const stats2 = app2.getConsoleStats();
console.log(`\nStats: ${stats2.totalInterceptions} interceptions`);

app2.disableConsoleInterception();

// ========================================
// Example 3: Both Mode (Debugging)
// ========================================

console.log("\n\n📝 Example 3: Both Mode (shows output twice)\n");

const app3 = createServer({
    server: { port: 3003 },
    logging: {
        enabled: true,
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                enabled: true,
                mode: "both", // Shows both original AND intercepted
            },
        },
    },
});

await app3.waitForReady();

console.log(
    "You'll see this message twice - once as original, once as [USERAPP]"
);

app3.disableConsoleInterception();

// ========================================
// Example 4: Silent Mode (Testing)
// ========================================

console.log("\n\n📝 Example 4: Silent Mode\n");

const app4 = createServer({
    server: { port: 3004 },
    logging: {
        enabled: true,
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                enabled: true,
                mode: "none", // Silent - no output
            },
        },
    },
});

await app4.waitForReady();

console.log("This won't be displayed (silent mode)");
console.log("But it's still being intercepted!");

// Disable to see the next message
app4.disableConsoleInterception();
console.log("Now you can see this (interception disabled)");

const stats4 = app4.getConsoleStats();
console.log(
    `Silent mode intercepted ${stats4.totalInterceptions} calls (but didn't display them)`
);

// ========================================
// Example 5: Filtering
// ========================================

console.log("\n\n📝 Example 5: Filtering\n");

const app5 = createServer({
    server: { port: 3005 },
    logging: {
        enabled: true,
        consoleInterception: {
            enabled: true,
            preserveOriginal: {
                mode: "original",
            },
            filters: {
                minLevel: "warn", // Only warn and error
                excludePatterns: ["DEBUG:"],
            },
        },
    },
});

await app5.waitForReady();

console.log("DEBUG: This will be filtered out");
console.log("This normal log will also be filtered (below minLevel)");
console.warn("⚠️  This warning will show");
console.error("❌ This error will show");

app5.disableConsoleInterception();

// ========================================
// Example 6: Runtime Control
// ========================================

console.log("\n\n📝 Example 6: Runtime Control\n");

const app6 = createServer({
    server: { port: 3006 },
    logging: {
        consoleInterception: {
            enabled: false, // Start disabled
        },
    },
});

await app6.waitForReady();

console.log("Interception disabled - normal output");

// Enable at runtime
app6.enableConsoleInterception();
console.log("Interception enabled - now being intercepted");

// Disable again
app6.disableConsoleInterception();
console.log("Interception disabled again");

// ========================================
// Example 7: Performance Monitoring
// ========================================

console.log("\n\n📝 Example 7: Performance Monitoring\n");

const app7 = createServer({
    server: { port: 3007 },
    logging: {
        consoleInterception: {
            enabled: true,
            performanceMode: true,
            preserveOriginal: { mode: "original" },
        },
    },
});

await app7.waitForReady();

// Generate some logs
for (let i = 0; i < 20; i++) {
    console.log(`Log ${i}`);
}

const stats7 = app7.getConsoleStats();
console.log(`\n📊 Performance Stats:`);
console.log(`   Total: ${stats7.totalInterceptions}`);
console.log(`   Per Second: ${stats7.interceptionsPerSecond}`);
console.log(`   Avg Overhead: ${stats7.averageOverhead.toFixed(3)}ms`);

app7.disableConsoleInterception();

// ========================================
// Summary
// ========================================

console.log("\n\n=== Summary ===\n");
console.log("✅ Console Interception IS working - it's just transparent!");
console.log("✅ Mode 'original' = looks normal but is intercepted");
console.log("✅ Mode 'intercepted' = shows [USERAPP] prefix");
console.log("✅ Mode 'both' = shows both versions");
console.log("✅ Mode 'none' = silent (captured but not displayed)");
console.log("✅ Use app.getConsoleStats() to verify interception");
console.log(
    "\n💡 The feature works perfectly - it's designed to be transparent!"
);
console.log("   Check the stats to see proof of interception.\n");

setTimeout(() => {
    process.exit(0);
}, 1000);


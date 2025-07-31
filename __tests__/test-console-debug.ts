/**
 * Debug Console Interception
 */

import { createServer } from "../integrations/express";

async function debugConsoleInterception() {
    console.log("Debugging: Testing Console Interception...\n");

    const capturedLogs: any[] = [];

    const app = createServer({
        logging: {
            customLogger: (level, component, message, ...args) => {
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    level,
                    component,
                    message,
                    args,
                };

                capturedLogs.push(logEntry);

                // Show everything that gets captured
                console.log(`[CAPTURED] ${component} | ${level} | ${message}`);

                if (component === "userApp") {
                    console.log(`  🎯 USER APP LOG DETECTED!`);
                } else {
                    console.log(`  🔧 System log: ${component}`);
                }
            },

            consoleInterception: {
                enabled: true,
                preserveOriginal: {
                    enabled: true,
                    mode: "intercepted", // Route through custom logger (NOT "none"!)
                    showPrefix: false, // Silent console output
                },
                performanceMode: false, // Disable for debugging
                filters: {
                    minLevel: "debug",
                    maxLength: 2000,
                    includePatterns: [],
                    excludePatterns: [],
                },
            },
        },
    });

    console.log("🚀 Starting server...");
    await app.waitForReady();
    console.log("✅ Server ready");

    // Wait for console interception to initialize
    console.log("⏳ Waiting for console interception to initialize...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("\n📋 Testing console interception:");

    // Test different console methods
    console.log("TEST 1: Regular log");
    console.info("TEST 2: Info log");
    console.warn("TEST 3: Warning log");
    console.error("TEST 4: Error log");
    console.debug("TEST 5: Debug log");

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    console.log("\n📊 Results:");
    console.log(`Total captured: ${capturedLogs.length}`);

    const byComponent = capturedLogs.reduce((acc, log) => {
        acc[log.component] = (acc[log.component] || 0) + 1;
        return acc;
    }, {});

    console.log("By component:", byComponent);

    // Check console interceptor status
    const interceptor = app.getConsoleInterceptor();
    if (interceptor) {
        const stats = interceptor.getStats();
        console.log("Interceptor stats:", stats);
    } else {
        console.log("❌ No console interceptor found");
    }

    return { capturedLogs, byComponent };
}

if (require.main === module) {
    debugConsoleInterception()
        .then((result) => {
            console.log("\n Debug completed");
            process.exit(0);
        })
        .catch((error) => {
            console.error("❌ Debug failed:", error);
            process.exit(1);
        });
}


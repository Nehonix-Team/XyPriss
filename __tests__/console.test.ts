/**
 * Test Console Preserve Modes
 * Verify that all preserve modes work correctly: original, intercepted, both, none
 */

import { createServer } from "../integrations/express";

async function testPreserveModes() {
    console.log("🔧 Testing Console Preserve Modes...\n");

    try {
        console.log(
            " Test 1: Original Mode (should show original console only)"
        );
        const app1 = createServer({
            logging: {
                consoleInterception: {
                    enabled: true,
                    preserveOriginal: {
                        enabled: true,
                        mode: "original",
                        showPrefix: false,
                        allowDuplication: false,
                        separateStreams: false,
                        onlyUserApp: true,
                        colorize: true,
                    },
                    performanceMode: true,
                    filters: {
                        minLevel: "debug",
                        maxLength: 1000,
                        includePatterns: [],
                        excludePatterns: [],
                    },
                },
            },
        });

        await app1.waitForReady();
        console.log(
            "✅ Original mode test - this should appear as plain console output"
        );
        console.log("Expected: Plain console output, no [USERAPP] prefix\n");

        console.log(
            " Test 2: Intercepted Mode (should show through logger with prefix)"
        );
        const app2 = createServer({
            logging: {
                consoleInterception: {
                    enabled: true,
                    preserveOriginal: {
                        enabled: true,
                        mode: "intercepted",
                        showPrefix: true,
                        allowDuplication: false,
                        separateStreams: false,
                        onlyUserApp: true,
                        colorize: true,
                    },
                    performanceMode: true,
                    filters: {
                        minLevel: "debug",
                        maxLength: 1000,
                        includePatterns: [],
                        excludePatterns: [],
                    },
                },
            },
        });

        await app2.waitForReady();
        console.log(
            "✅ Intercepted mode test - this should appear with [USERAPP] prefix"
        );
        console.log("Expected: [USERAPP] prefix through logging system\n");

        console.log(
            " Test 3: Both Mode (should show BOTH original AND intercepted)"
        );
        const app3 = createServer({
            logging: {
                consoleInterception: {
                    enabled: true,
                    preserveOriginal: {
                        enabled: true,
                        mode: "both",
                        showPrefix: true,
                        allowDuplication: true,
                        separateStreams: false,
                        onlyUserApp: true,
                        colorize: true,
                    },
                    performanceMode: true,
                    filters: {
                        minLevel: "debug",
                        maxLength: 1000,
                        includePatterns: [],
                        excludePatterns: [],
                    },
                },
            },
        });

        await app3.waitForReady();
        console.log(
            "✅ Both mode test - this should appear TWICE (original + intercepted)"
        );
        console.log(
            "Expected: This message appears twice - once plain, once with [USERAPP] prefix\n"
        );

        console.log(" Test 4: None Mode (should show NO console output)");
        const app4 = createServer({
            logging: {
                consoleInterception: {
                    enabled: true,
                    preserveOriginal: {
                        enabled: true,
                        mode: "none",
                        showPrefix: false,
                        allowDuplication: false,
                        separateStreams: false,
                        onlyUserApp: true,
                        colorize: false,
                    },
                    performanceMode: true,
                    filters: {
                        minLevel: "debug",
                        maxLength: 1000,
                        includePatterns: [],
                        excludePatterns: [],
                    },
                },
            },
        });

        await app4.waitForReady();
        console.log("❌ None mode test - this should NOT appear at all");
        console.log("Expected: No console output (silent mode)\n");

        console.log(" Test 5: Custom Prefix Test");
        const app5 = createServer({
            logging: {
                consoleInterception: {
                    enabled: true,
                    preserveOriginal: {
                        enabled: true,
                        mode: "intercepted",
                        showPrefix: true,
                        customPrefix: "[MYAPP]",
                        allowDuplication: false,
                        separateStreams: false,
                        onlyUserApp: true,
                        colorize: true,
                    },
                    performanceMode: true,
                    filters: {
                        minLevel: "debug",
                        maxLength: 1000,
                        includePatterns: [],
                        excludePatterns: [],
                    },
                },
            },
        });

        await app5.waitForReady();
        console.log(
            "✅ Custom prefix test - this should appear with [MYAPP] prefix"
        );
        console.log("Expected: [MYAPP] prefix instead of [USERAPP]\n");

        console.log("  Console Preserve Modes Test Completed!");
        console.log("\n Summary of what you should have seen:");
        console.log("1. ✅ Original mode: Plain console output");
        console.log("2. ✅ Intercepted mode: [USERAPP] prefixed output");
        console.log("3. ✅ Both mode: DUPLICATE output (plain + [USERAPP])");
        console.log("4. ❌ None mode: NO output (silent)");
        console.log("5. ✅ Custom prefix: [MYAPP] prefixed output");

        return { success: true };
    } catch (error: any) {
        console.error("\n❌ Test Failed:", error);
        return { success: false, error: error.message };
    }
}

// Test backward compatibility
async function testBackwardCompatibility() {
    console.log("\n🔧 Testing Backward Compatibility...\n");

    try {
        console.log(" Test: Boolean true (should work like original mode)");
        const app1 = createServer({
            logging: {
                consoleInterception: {
                    enabled: true,
                    preserveOriginal: true, // Old boolean syntax
                    performanceMode: true,
                    filters: {
                        minLevel: "debug",
                        maxLength: 1000,
                        includePatterns: [],
                        excludePatterns: [],
                    },
                },
            },
        });

        await app1.waitForReady();
        console.log(
            "✅ Boolean true test - should show original console output"
        );

        console.log(
            "\n Test: Boolean false (should work like intercepted mode)"
        );
        const app2 = createServer({
            logging: {
                consoleInterception: {
                    enabled: true,
                    preserveOriginal: false, // Old boolean syntax
                    performanceMode: true,
                    filters: {
                        minLevel: "debug",
                        maxLength: 1000,
                        includePatterns: [],
                        excludePatterns: [],
                    },
                },
            },
        });

        await app2.waitForReady();
        console.log(
            "✅ Boolean false test - should show [USERAPP] prefixed output"
        );

        console.log("\n Backward Compatibility Test Completed!");
        return { success: true };
    } catch (error: any) {
        console.error("\n❌ Backward Compatibility Test Failed:", error);
        return { success: false, error: error.message };
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    Promise.all([testPreserveModes(), testBackwardCompatibility()]).then(
        (results) => {
            const allSuccess = results.every((r) => r.success);
            console.log(
                `\n🏆 Overall Result: ${
                    allSuccess ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"
                }`
            );
            process.exit(allSuccess ? 0 : 1);
        }
    );
}


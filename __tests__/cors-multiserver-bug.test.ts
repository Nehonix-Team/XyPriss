/**
 * XyPriss CORS MultiServer Bug Reproduction Test
 *
 * This test reproduces the bug reported in:
 * .private/xypriss-cors-methods-array-bug.md
 *
 * Bug: When using multiServer configuration with CORS settings,
 * array properties (methods, allowedHeaders) are not properly
 * serialized to strings when setting HTTP headers.
 *
 * Expected: Arrays should be converted to comma-separated strings
 * Actual: Arrays output "[object Object]" or are completely omitted
 */

import { createServer } from "../src/server/ServerFactory";

console.log("🧪 Starting CORS MultiServer Bug Reproduction Test...\n");

// Test utilities
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILED: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ ${message}`);
    }
}

async function makeRequest(
    url: string,
    options: any = {}
): Promise<{ status: number; body: string; headers: any }> {
    try {
        const response = await fetch(url, options);
        const body = await response.text();
        const headers: any = {};
        response.headers.forEach((value, key) => {
            headers[key.toLowerCase()] = value;
        });
        return { status: response.status, body, headers };
    } catch (error) {
        console.error(`Request failed: ${error}`);
        return { status: 0, body: "", headers: {} };
    }
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Test: Reproduce the exact bug from the bug report
async function testMultiServerCorsArrayBug() {
    console.log("🔬 Test: MultiServer CORS Array Serialization Bug\n");
    console.log("Creating multiServer configuration with CORS arrays...");

    const app = createServer({
        logging: {
            enabled: true,
            level: "debug",
            consoleInterception: { enabled: false },
        },
        multiServer: {
            enabled: true,
            servers: [
                {
                    id: "test_server",
                    port: 6287,
                    host: "localhost",
                    security: {
                        cors: {
                            origin: "*",
                            // BUG: These arrays should be serialized to comma-separated strings
                            methods: [
                                "GET",
                                "POST",
                                "PUT",
                                "DELETE",
                                "OPTIONS",
                                "PATCH",
                                "HEAD",
                            ],
                            allowedHeaders: [
                                "Content-Type",
                                "Authorization",
                                "x-guest-token",
                                "xp-request-sig",
                            ],
                            credentials: true,
                        },
                    },
                },
            ],
        },
    });

    // Add a test route
    app.get("/api/v1/auth/login", (_req: any, res: any) => {
        res.json({ message: "Login endpoint" });
    });

    // Start the server
    await app.start();
    await sleep(500); // Give server time to start

    try {
        console.log("\n📡 Sending CORS preflight request...\n");

        // Simulate the exact preflight request from the bug report
        const response = await makeRequest(
            "http://localhost:6287/api/v1/auth/login",
            {
                method: "OPTIONS",
                headers: {
                    Origin: "http://localhost:5174",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers":
                        "xp-request-sig,content-type,authorization",
                },
            }
        );

        console.log("Response Status:", response.status);
        console.log("\nResponse Headers:");
        console.log("================");

        const corsHeaders = {
            "access-control-allow-origin":
                response.headers["access-control-allow-origin"],
            "access-control-allow-credentials":
                response.headers["access-control-allow-credentials"],
            "access-control-allow-methods":
                response.headers["access-control-allow-methods"],
            "access-control-allow-headers":
                response.headers["access-control-allow-headers"],
            "access-control-max-age":
                response.headers["access-control-max-age"],
        };

        Object.entries(corsHeaders).forEach(([key, value]) => {
            console.log(`${key}: ${value || "MISSING"}`);
        });

        console.log("\n🔍 Checking for bugs...\n");

        // Check for Bug 1: methods should NOT be "[object Object]"
        const methodsHeader = response.headers["access-control-allow-methods"];
        if (methodsHeader === "[object Object]") {
            console.error(
                "🐛 BUG CONFIRMED: Access-Control-Allow-Methods is '[object Object]'"
            );
            assert(
                false,
                "Methods header should be comma-separated string, not '[object Object]'"
            );
        } else if (!methodsHeader) {
            console.error(
                "🐛 BUG CONFIRMED: Access-Control-Allow-Methods header is MISSING"
            );
            assert(false, "Methods header should be present");
        } else {
            console.log(`✓ Methods header present: ${methodsHeader}`);

            // Verify it contains the expected methods
            const expectedMethods = [
                "GET",
                "POST",
                "PUT",
                "DELETE",
                "OPTIONS",
                "PATCH",
                "HEAD",
            ];
            const hasAllMethods = expectedMethods.every((method) =>
                methodsHeader.toUpperCase().includes(method)
            );
            assert(
                hasAllMethods,
                "Methods header should contain all configured methods"
            );
        }

        // Check for Bug 2: allowedHeaders should NOT be missing
        const headersHeader = response.headers["access-control-allow-headers"];
        if (!headersHeader) {
            console.error(
                "🐛 BUG CONFIRMED: Access-Control-Allow-Headers header is MISSING"
            );
            assert(false, "AllowedHeaders header should be present");
        } else {
            console.log(`✓ AllowedHeaders header present: ${headersHeader}`);

            // Verify it contains the expected headers
            const expectedHeaders = [
                "Content-Type",
                "Authorization",
                "x-guest-token",
                "xp-request-sig",
            ];
            const hasAllHeaders = expectedHeaders.every((header) =>
                headersHeader.toLowerCase().includes(header.toLowerCase())
            );
            assert(
                hasAllHeaders,
                "AllowedHeaders should contain all configured headers"
            );
        }

        // Check other CORS headers
        assert(
            response.headers["access-control-allow-origin"] === "*",
            "Origin should be '*'"
        );
        assert(
            response.headers["access-control-allow-credentials"] === "true",
            "Credentials should be 'true'"
        );

        console.log("\n🎉 All CORS headers are correctly formatted!");
        console.log("✅ Bug is FIXED (or not present in this version)");
    } catch (error) {
        console.error("\n💥 Test failed with error:", error);
        throw error;
    } finally {
        console.log("\n🧹 Cleaning up...");
        await app.stop();
        await sleep(500);
    }
}

// Run the test
async function runTest() {
    try {
        await testMultiServerCorsArrayBug();
        console.log("\n✅ Test completed successfully!");
        process.exit(0);
    } catch (error) {
        console.error("\n❌ Test failed:", error);
        process.exit(1);
    }
}

runTest();


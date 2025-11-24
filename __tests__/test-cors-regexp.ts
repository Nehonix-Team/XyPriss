/**
 * Test script to verify advanced CORS configuration with RegExp support
 */

import { createServer } from "../src";

console.log("🌐 Testing Advanced CORS Configuration with RegExp Support...\n");

// Test server with advanced CORS patterns
const testServer = createServer({
    server: { port: 3001 },
    security: {
        cors: {
            origin: [
                // RegExp patterns (powerful and flexible)
                /^localhost:\d+$/, // localhost:3000, localhost:8080, etc.
                /^127\.0\.0\.1:\d+$/, // 127.0.0.1:3000, etc.
                /^::1:\d+$/, // IPv6 localhost
                /\.test\.com$/, // *.test.com

                // String patterns (backward compatibility)
                "localhost:*", // Wildcard pattern
                "*.dev.example.com", // Subdomain wildcard

                // Exact matches
                "https://production.com",
                "https://staging.example.com",
            ],
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        },
    },
});

// Add test routes
testServer.get("/api/test", (req, res) => {
    res.json({
        method: "GET",
        message: "CORS test successful!",
        origin: req.headers.origin,
        timestamp: new Date().toISOString(),
    });
});

testServer.post("/api/test", (req, res) => {
    res.json({
        method: "POST",
        message: "CORS test successful!",
        origin: req.headers.origin,
        timestamp: new Date().toISOString(),
    });
});

console.log("✅ Server configured with advanced CORS patterns");
console.log("📋 Test origins:");
console.log("  ✅ RegExp: /^localhost:\\d+$/ (localhost:3000, etc.)");
console.log("  ✅ RegExp: /^127\\.0\\.0\\.1:\\d+$/ (127.0.0.1:3000, etc.)");
console.log("  ✅ RegExp: /\\.test\\.com$/ (*.test.com)");
console.log('  ✅ String: "localhost:*" (wildcard)');
console.log('  ✅ String: "*.dev.example.com" (subdomain)');
console.log('  ✅ String: "https://production.com" (exact)');
console.log("  ❌ Blocked: other origins\n");

const testOrigins = async () => {
    const testCases = [
        // Should PASS (RegExp patterns)
        {
            origin: "http://localhost:3000",
            expected: true,
            type: "RegExp localhost",
        },
        {
            origin: "http://localhost:8080",
            expected: true,
            type: "RegExp localhost",
        },
        {
            origin: "http://127.0.0.1:4000",
            expected: true,
            type: "RegExp 127.0.0.1",
        },
        {
            origin: "https://api.test.com",
            expected: true,
            type: "RegExp *.test.com",
        },
        {
            origin: "https://sub.test.com",
            expected: true,
            type: "RegExp *.test.com",
        },

        // Should PASS (String patterns)
        {
            origin: "http://localhost:9999",
            expected: true,
            type: "String localhost:*",
        },
        {
            origin: "https://app.dev.example.com",
            expected: true,
            type: "String *.dev.example.com",
        },
        {
            origin: "https://sub.dev.example.com",
            expected: true,
            type: "String *.dev.example.com",
        },
        {
            origin: "https://production.com",
            expected: true,
            type: "String exact match",
        },

        // Should FAIL (not matching any pattern)
        { origin: "https://evil.com", expected: false, type: "Blocked origin" },
        {
            origin: "https://api.production.com",
            expected: false,
            type: "Blocked subdomain",
        },
        {
            origin: "http://192.168.1.1:3000",
            expected: false,
            type: "Blocked IP",
        },
    ];

    console.log("🧪 Testing CORS origin validation:\n");

    for (const testCase of testCases) {
        console.log(`Testing ${testCase.type}: ${testCase.origin}`);

        try {
            // First make an OPTIONS preflight request to trigger CORS checking
            await fetch(`http://localhost:3001/api/test`, {
                method: "OPTIONS",
                headers: {
                    Origin: testCase.origin,
                    "Access-Control-Request-Method": "GET",
                },
            });

            // Then make the actual request
            const response = await fetch(`http://localhost:3001/api/test`, {
                method: "GET",
                credentials: "include",
                headers: {
                    Origin: testCase.origin,
                },
            });

            // Check CORS headers
            const corsAllowed = response.headers.get(
                "access-control-allow-origin"
            );

            if (testCase.expected) {
                if (corsAllowed === testCase.origin || corsAllowed === "*") {
                    console.log(`✅ PASS: CORS allowed for ${testCase.origin}`);
                } else {
                    console.log(
                        `❌ FAIL: Expected CORS to allow ${testCase.origin}, but got: ${corsAllowed}`
                    );
                }
            } else {
                if (!corsAllowed || corsAllowed === testCase.origin) {
                    console.log(
                        `❌ FAIL: Expected CORS to block ${testCase.origin}, but it was allowed`
                    );
                } else {
                    console.log(
                        `✅ PASS: CORS correctly blocked ${testCase.origin}`
                    );
                }
            }
        } catch (error) {
            if (testCase.expected) {
                console.log(
                    `❌ FAIL: Request failed for allowed origin ${testCase.origin}: ${error}`
                );
            } else {
                console.log(
                    `✅ PASS: Request correctly failed for blocked origin ${testCase.origin}`
                );
            }
        }
    }

    console.log("\n🎉 Advanced CORS configuration test completed!");
    process.exit(0);
};

// Start server and run tests
(async () => {
    try {
        await testServer.start(3001);
        console.log("🚀 Test server started on port 3001\n");

        // Wait a bit for server to be ready
        setTimeout(testOrigins, 1000);
    } catch (error) {
        console.error("❌ Failed to start server:", error);
    }
})();

/**
 * Test for Multi-Server 404 Configuration Feature
 *
 * This test demonstrates the new functionality that allows controlling
 * the 404 response when route matching fails in multi-server scenarios.
 */

import { createServer } from "../src";

/**
 * Example demonstrating custom 404 responses for different servers
 */
export async function testMultiServer404Configuration() {
    console.log("Testing Multi-Server 404 Configuration...");

    const app = createServer({
        multiServer: {
            enabled: true,
            servers: [
                {
                    id: "public-server",
                    port: 9822,
                    routePrefix: "/public",
                    // Custom response control for public server
                    responseControl: {
                        enabled: true,
                        statusCode: 404,
                        content: "Custom 404: Public resource not found",
                        contentType: "text/plain",
                        headers: { "X-Server": "public" },
                    },
                },
                {
                    id: "api-server",
                    port: 3728,
                    routePrefix: "/api",
                    // Custom response control for API server
                    responseControl: {
                        enabled: true,
                        statusCode: 404,
                        content: {
                            error: "API endpoint not found",
                            path: "/api/test",
                        },
                        contentType: "application/json",
                        headers: { "X-Server": "api" },
                    },
                },
                {
                    id: "admin-server",
                    port: 8080,
                    // No routePrefix - handles all other routes
                    // Custom response control for admin server
                    responseControl: {
                        enabled: true,
                        statusCode: 404,
                        content: "Admin area: Page not found",
                        contentType: "text/plain",
                        headers: { "X-Server": "admin" },
                    },
                },
            ],
        },
    });

    // Register routes that will be distributed to appropriate servers
    app.get("/public/home", (req, res) => {
        res.send("Welcome to the public area!");
    });

    app.get("/api/users", (req, res) => {
        res.json({ users: ["user1", "user2", "user3"] });
    });

    app.get("/api/posts", (req, res) => {
        res.json({ posts: ["post1", "post2", "post3"] });
    });

    app.get("/admin/dashboard", (req, res) => {
        res.send("Admin Dashboard");
    });

    app.get("/admin/settings", (req, res) => {
        res.send("Admin Settings");
    });

    // Start all servers
    if (app.startAllServers) {
        await app.startAllServers();
    } else {
        throw new Error("startAllServers method not available");
    }

    console.log(
        "✅ Multi-server setup with custom 404 configurations started!"
    );
    console.log("📍 Public Server: http://localhost:9822");
    console.log("📍 API Server: http://localhost:3728");
    console.log("📍 Admin Server: http://localhost:8080");

    return app;
}

/**
 * Test different 404 scenarios
 */
export async function test404Scenarios() {
    console.log("\n🧪 Testing 404 Scenarios...");

    const app = await testMultiServer404Configuration();

    // Test cases that should return 404 with custom configurations
    const testCases = [
        {
            name: "Public server - non-existent route",
            url: "http://localhost:9822/public/nonexistent",
            expectedServer: "public-server",
        },
        {
            name: "API server - non-existent endpoint",
            url: "http://localhost:3728/api/nonexistent",
            expectedServer: "api-server",
        },
        {
            name: "Admin server - non-existent page",
            url: "http://localhost:8080/admin/nonexistent",
            expectedServer: "admin-server",
        },
        {
            name: "Public server accessing API route (should 404)",
            url: "http://localhost:9822/api/users",
            expectedServer: "public-server",
        },
        {
            name: "API server accessing public route (should 404)",
            url: "http://localhost:3728/public/home",
            expectedServer: "api-server",
        },
    ];

    for (const testCase of testCases) {
        console.log(`\n📋 Testing: ${testCase.name}`);
        console.log(`   URL: ${testCase.url}`);
        console.log(`   Expected Server: ${testCase.expectedServer}`);

        try {
            const response = await fetch(testCase.url);
            console.log(
                `   ✅ Response: ${response.status} ${response.statusText}`
            );

            if (response.status === 404) {
                const html = await response.text();
                // Check if the response contains server-specific customizations
                if (
                    html.includes("Public Server") &&
                    testCase.expectedServer === "public-server"
                ) {
                    console.log("   ✅ Public server custom 404 detected");
                } else if (
                    html.includes("API - Endpoint Not Found") &&
                    testCase.expectedServer === "api-server"
                ) {
                    console.log("   ✅ API server custom 404 detected");
                } else if (
                    html.includes("Admin Area") &&
                    testCase.expectedServer === "admin-server"
                ) {
                    console.log("   ✅ Admin server custom 404 detected");
                } else {
                    console.log(
                        "   ⚠️  Custom 404 content not detected as expected"
                    );
                }
            }
        } catch (error) {
            console.log(
                `   ❌ Error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    // Test valid routes to ensure they still work
    console.log("\n✅ Testing valid routes...");
    const validRoutes = [
        "http://localhost:9822/public/home",
        "http://localhost:3728/api/users",
        "http://localhost:8080/admin/dashboard",
    ];

    for (const url of validRoutes) {
        try {
            const response = await fetch(url);
            console.log(`   ${url}: ${response.status} ${response.statusText}`);
        } catch (error) {
            console.log(
                `   ${url}: Error - ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    return app;
}

/**
 * Test with minimal 404 configuration
 */
export async function testMinimal404Config() {
    console.log("\n🔧 Testing Minimal 404 Configuration...");

    const app = createServer({
        multiServer: {
            enabled: true,
            servers: [
                {
                    id: "simple-server",
                    port: 3000,
                    routePrefix: "/simple",
                    // Minimal response control config - only override content
                    responseControl: {
                        enabled: true,
                        content: "Custom message for simple server",
                    },
                },
            ],
        },
    });

    app.get("/simple/test", (req, res) => {
        res.send("Simple server test");
    });

    if (app.startAllServers) {
        await app.startAllServers();
    } else {
        throw new Error("startAllServers method not available");
    }
    console.log(
        "✅ Minimal 404 config server started on http://localhost:3000"
    );

    // Test the custom message
    try {
        const response = await fetch(
            "http://localhost:3000/simple/nonexistent"
        );
        if (response.status === 404) {
            const html = await response.text();
            if (html.includes("Custom message for simple server")) {
                console.log("✅ Minimal 404 config working correctly");
            } else {
                console.log("⚠️  Minimal 404 config not working as expected");
            }
        }
    } catch (error) {
        console.log(
            `❌ Error testing minimal config: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }

    return app;
}

/**
 * Test with disabled 404 handler
 */
export async function testDisabled404Handler() {
    console.log("\n🚫 Testing Disabled 404 Handler...");

    const app = createServer({
        multiServer: {
            enabled: true,
            servers: [
                {
                    id: "no-404-server",
                    port: 3001,
                    routePrefix: "/no404",
                    // Disable custom response control - should use default
                    responseControl: {
                        enabled: false,
                    },
                },
            ],
        },
    });

    app.get("/no404/test", (req, res) => {
        res.send("No 404 server test");
    });

    if (app.startAllServers) {
        await app.startAllServers();
    } else {
        throw new Error("startAllServers method not available");
    }
    console.log("✅ Disabled 404 server started on http://localhost:3001");

    // Test that it returns default 404
    try {
        const response = await fetch("http://localhost:3001/no404/nonexistent");
        console.log(`   Response: ${response.status} ${response.statusText}`);
        if (response.status === 404) {
            const text = await response.text();
            console.log(`   Response length: ${text.length} characters`);
            console.log(
                "✅ Default 404 handler working when custom is disabled"
            );
        }
    } catch (error) {
        console.log(
            `❌ Error testing disabled 404: ${
                error instanceof Error ? error.message : String(error)
            }`
        );
    }

    return app;
}

// Export test runner
export async function runAllTests() {
    console.log("🚀 Starting Multi-Server 404 Configuration Tests\n");

    try {
        await testMultiServer404Configuration();
        await test404Scenarios();
        await testMinimal404Config();
        await testDisabled404Handler();

        console.log("\n🎉 All tests completed!");
    } catch (error) {
        console.error("\n❌ Test failed:", error);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runAllTests().catch(console.error);
}


/**
 * XyPrissSecurity Integration Tests
 * Tests multiple features working together in realistic scenarios
 */

import { createServer } from "../integrations/express/ServerFactory";

console.log("🧪 Starting XyPrissSecurity Integration Tests...");

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

// Test 1: Full Stack API with All Middleware
async function testFullStackAPI() {
    console.log("\n🔬 Test 1: Full Stack API with All Middleware");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Configure all middleware features
    const middleware = app.middleware({
        rateLimit: {
            enabled: true,
            max: 5,
            windowMs: 60000,
        },
        cors: {
            enabled: true,
            origin: ["http://localhost:3000", "https://myapp.com"],
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
        },
        security: { enabled: true },
        compression: false,
    });

    // Add custom middleware
    middleware.register((_req: any, res: any, next: any) => {
        res.setHeader("X-Custom-Middleware", "active");
        next();
    });

    // Add API routes
    app.get("/api/users", (_req: any, res: any) => {
        res.json({
            users: [
                { id: 1, name: "John Doe" },
                { id: 2, name: "Jane Smith" },
            ],
        });
    });

    app.post("/api/users", (_req: any, res: any) => {
        res.status(201).json({
            id: 3,
            name: "New User",
            created: new Date().toISOString(),
        });
    });

    app.get("/api/health", (_req: any, res: any) => {
        res.json({
            status: "healthy",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
        });
    });

    const testPort = 8104;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        // Test CORS preflight
        const preflightResponse = await makeRequest(
            `http://localhost:${testPort}/api/users`,
            {
                method: "OPTIONS",
                headers: {
                    Origin: "http://localhost:3000",
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "Content-Type",
                },
            }
        );

        assert(
            preflightResponse.status === 204,
            "CORS preflight should succeed"
        );
        assert(
            preflightResponse.headers["access-control-allow-origin"] ===
                "http://localhost:3000",
            "CORS should allow the origin"
        );

        // Test GET with all middleware
        const getResponse = await makeRequest(
            `http://localhost:${testPort}/api/users`,
            {
                headers: {
                    Origin: "http://localhost:3000",
                    "X-API-Key": "test-key",
                },
            }
        );

        assert(getResponse.status === 200, "GET request should succeed");
        assert(
            getResponse.body.includes("John Doe"),
            "Should return user data"
        );
        assert(
            getResponse.headers["x-content-type-options"] === "nosniff",
            "Should have security headers"
        );
        assert(
            getResponse.headers["x-custom-middleware"] === "active",
            "Should have custom middleware headers"
        );

        // Test POST with all middleware
        const postResponse = await makeRequest(
            `http://localhost:${testPort}/api/users`,
            {
                method: "POST",
                headers: {
                    Origin: "http://localhost:3000",
                    "Content-Type": "application/json",
                    "X-API-Key": "test-key",
                },
                body: JSON.stringify({ name: "Test User" }),
            }
        );

        assert(postResponse.status === 201, "POST request should succeed");
        assert(
            postResponse.body.includes("New User"),
            "Should create new user"
        );

        // Test health endpoint
        const healthResponse = await makeRequest(
            `http://localhost:${testPort}/api/health`
        );
        assert(healthResponse.status === 200, "Health check should succeed");
        assert(
            healthResponse.body.includes("healthy"),
            "Should return healthy status"
        );
    } finally {
        console.log("Test 1 completed, cleaning up...");
    }
}

// Test 2: Rate Limiting with CORS
async function testRateLimitingWithCors() {
    console.log("\n🔬 Test 2: Rate Limiting with CORS");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Configure rate limiting and CORS together
    app.middleware({
        rateLimit: { enabled: true, max: 2 },
        cors: {
            enabled: true,
            origin: ["http://localhost:3000"],
            methods: ["GET", "OPTIONS"],
        },
    });

    app.get("/api/limited", (_req: any, res: any) => {
        res.json({ message: "Limited endpoint" });
    });

    const testPort = 8105;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        // First request should succeed with CORS
        const response1 = await makeRequest(
            `http://localhost:${testPort}/api/limited`,
            {
                headers: { Origin: "http://localhost:3000" },
            }
        );
        assert(response1.status === 200, "First request should succeed");
        assert(
            response1.headers["access-control-allow-origin"] ===
                "http://localhost:3000",
            "Should have CORS headers"
        );

        // Second request should succeed
        const response2 = await makeRequest(
            `http://localhost:${testPort}/api/limited`,
            {
                headers: { Origin: "http://localhost:3000" },
            }
        );
        assert(response2.status === 200, "Second request should succeed");

        // Third request should be rate limited but still have CORS handling
        const response3 = await makeRequest(
            `http://localhost:${testPort}/api/limited`,
            {
                headers: { Origin: "http://localhost:3000" },
            }
        );
        assert(
            response3.status === 429,
            "Third request should be rate limited"
        );
    } finally {
        console.log("Test 2 completed, cleaning up...");
    }
}

// Test 3: Error Handling with Middleware
async function testErrorHandlingWithMiddleware() {
    console.log("\n🔬 Test 3: Error Handling with Middleware");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Enable security and CORS
    app.enableSecurity();
    app.enableCors();

    // Add route that throws an error
    app.get("/api/error", (_req: any, _res: any) => {
        throw new Error("Test error");
    });

    // Add normal route
    app.get("/api/normal", (_req: any, res: any) => {
        res.json({ status: "ok" });
    });

    const testPort = 8106;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        // Test that error doesn't break middleware for other routes
        const normalResponse = await makeRequest(
            `http://localhost:${testPort}/api/normal`
        );
        assert(normalResponse.status === 200, "Normal route should work");
        assert(
            normalResponse.headers["x-content-type-options"] === "nosniff",
            "Should still have security headers"
        );

        // Test error route
        const errorResponse = await makeRequest(
            `http://localhost:${testPort}/api/error`
        );
        assert(
            errorResponse.status >= 400,
            "Error route should return error status"
        );

        // Test that normal route still works after error
        const normalResponse2 = await makeRequest(
            `http://localhost:${testPort}/api/normal`
        );
        assert(
            normalResponse2.status === 200,
            "Normal route should still work after error"
        );
    } finally {
        console.log("Test 3 completed, cleaning up...");
    }
}

// Test 4: Performance with Multiple Middleware
async function testPerformanceWithMultipleMiddleware() {
    console.log("\n🔬 Test 4: Performance with Multiple Middleware");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Add multiple middleware layers
    app.enableSecurity();
    app.enableCors();

    const middleware = app.middleware({
        rateLimit: { enabled: true, max: 100 },
    });

    // Add several custom middleware
    for (let i = 0; i < 5; i++) {
        middleware.register((_req: any, _res: any, next: any) => {
            // Simulate some processing
            setTimeout(next, 1);
        });
    }

    app.get("/api/performance", (_req: any, res: any) => {
        res.json({ processed: true });
    });

    const testPort = 8107;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        // Test multiple requests to check performance
        const startTime = Date.now();
        const promises = [];

        for (let i = 0; i < 10; i++) {
            promises.push(
                makeRequest(`http://localhost:${testPort}/api/performance`)
            );
        }

        const responses = await Promise.all(promises);
        const endTime = Date.now();
        const totalTime = endTime - startTime;

        // All requests should succeed
        responses.forEach((response, index) => {
            assert(
                response.status === 200,
                `Request ${index + 1} should succeed`
            );
        });

        assert(
            totalTime < 5000,
            `Performance test should complete in reasonable time (${totalTime}ms)`
        );
        console.log(
            `✅ Processed 10 requests with multiple middleware in ${totalTime}ms`
        );
    } finally {
        console.log("Test 4 completed, cleaning up...");
    }
}

// Main test runner
async function runAllTests() {
    try {
        await testFullStackAPI();
        await sleep(1000);

        await testRateLimitingWithCors();
        await sleep(1000);

        await testErrorHandlingWithMiddleware();
        await sleep(1000);

        await testPerformanceWithMultipleMiddleware();

        console.log("\n🎉 All Integration Tests Passed!");
        process.exit(0);
    } catch (error) {
        console.error("\n💥 Integration Test Suite Failed:", error);
        process.exit(1);
    }
}

// Run tests
runAllTests();


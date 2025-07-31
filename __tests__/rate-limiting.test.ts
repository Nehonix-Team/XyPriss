/**
 * XyPrissSecurity Rate Limiting Tests
 * Simple direct tests without external dependencies
 */

import { createServer } from "../integrations/express/ServerFactory";

console.log("🧪 Starting XyPrissSecurity Rate Limiting Tests...");

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
): Promise<{ status: number; body: string }> {
    try {
        const response = await fetch(url, options);
        const body = await response.text();
        return { status: response.status, body };
    } catch (error) {
        console.error(`Request failed: ${error}`);
        return { status: 0, body: "" };
    }
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Test 1: Basic Rate Limiting
async function testBasicRateLimiting() {
    console.log("\n🔬 Test 1: Basic Rate Limiting");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Configure rate limiting with max 3 requests
    app.middleware({
        rateLimit: { enabled: true, max: 3 },
    });

    app.get("/rate-test", (_req: any, res: any) => {
        res.json({ success: true });
    });

    // Start server on a test port
    const testPort = 8090;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => {
            console.log(`Test server started on port ${testPort}`);
            resolve();
        });
    });

    // Wait a moment for server to be ready
    await sleep(100);

    try {
        // First 3 requests should succeed
        const response1 = await makeRequest(
            `http://localhost:${testPort}/rate-test`
        );
        const response2 = await makeRequest(
            `http://localhost:${testPort}/rate-test`
        );
        const response3 = await makeRequest(
            `http://localhost:${testPort}/rate-test`
        );

        assert(response1.status === 200, "First request should succeed");
        assert(response2.status === 200, "Second request should succeed");
        assert(response3.status === 200, "Third request should succeed");

        // 4th request should be rate limited
        const response4 = await makeRequest(
            `http://localhost:${testPort}/rate-test`
        );
        assert(
            response4.status === 429,
            "Fourth request should be rate limited (429)"
        );
        assert(
            response4.body.includes("Too many requests"),
            "Should return rate limit message"
        );
    } finally {
        console.log("Test 1 completed, cleaning up...");
    }
}

// Test 2: Rate Limit Window Reset
async function testRateLimitReset() {
    console.log("\n🔬 Test 2: Rate Limit Window Reset");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Configure rate limiting with max 1 request and short window
    app.middleware({
        rateLimit: {
            enabled: true,
            max: 1,
            windowMs: 200, // 200ms window for testing
        },
    });

    app.get("/reset-test", (_req: any, res: any) => {
        res.json({ success: true });
    });

    const testPort = 8091;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        // First request should succeed
        const response1 = await makeRequest(
            `http://localhost:${testPort}/reset-test`
        );
        assert(response1.status === 200, "First request should succeed");

        // Second request should be rate limited
        const response2 = await makeRequest(
            `http://localhost:${testPort}/reset-test`
        );
        assert(
            response2.status === 429,
            "Second request should be rate limited"
        );

        // Wait for rate limit window to reset
        await sleep(250);

        // Request after window reset should succeed
        const response3 = await makeRequest(
            `http://localhost:${testPort}/reset-test`
        );
        assert(
            response3.status === 200,
            "Request after window reset should succeed"
        );
    } finally {
        console.log("Test 2 completed, cleaning up...");
    }
}

// Test 3: Disabled Rate Limiting
async function testDisabledRateLimiting() {
    console.log("\n🔬 Test 3: Disabled Rate Limiting");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Configure with rate limiting disabled
    app.middleware({
        rateLimit: { enabled: false },
    });

    app.get("/no-limit-test", (_req: any, res: any) => {
        res.json({ success: true });
    });

    const testPort = 8092;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        // Multiple requests should all succeed
        for (let i = 1; i <= 10; i++) {
            const response = await makeRequest(
                `http://localhost:${testPort}/no-limit-test`
            );
            assert(
                response.status === 200,
                `Request ${i} should succeed when rate limiting is disabled`
            );
        }
    } finally {
        console.log("Test 3 completed, cleaning up...");
    }
}

// Main test runner
async function runAllTests() {
    try {
        await testBasicRateLimiting();
        await sleep(500); // Wait between tests

        await testRateLimitReset();
        await sleep(500);

        await testDisabledRateLimiting();

        console.log("\n🎉 All Rate Limiting Tests Passed!");
        process.exit(0);
    } catch (error) {
        console.error("\n💥 Test Suite Failed:", error);
        process.exit(1);
    }
}

// Run tests
runAllTests();


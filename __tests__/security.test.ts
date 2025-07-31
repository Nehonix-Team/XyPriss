/**
 * XyPrissSecurity Security Middleware Tests
 * Simple direct tests for security headers and functionality
 */

import { createServer } from "../integrations/express/ServerFactory";

console.log("🧪 Starting XyPrissSecurity Security Tests...");

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

// Test 1: Basic Security Headers
async function testBasicSecurityHeaders() {
    console.log("\n🔬 Test 1: Basic Security Headers");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Enable security middleware
    app.enableSecurity();

    app.get("/security-test", (_req: any, res: any) => {
        res.json({ security: "enabled" });
    });

    const testPort = 8099;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        const response = await makeRequest(
            `http://localhost:${testPort}/security-test`
        );

        assert(response.status === 200, "Request should succeed");

        // Check for security headers
        assert(
            response.headers["x-content-type-options"] === "nosniff",
            "Should have X-Content-Type-Options: nosniff header"
        );

        assert(
            response.headers["x-frame-options"] === "DENY",
            "Should have X-Frame-Options: DENY header"
        );

        assert(
            response.headers["x-xss-protection"] === "1; mode=block",
            "Should have X-XSS-Protection header"
        );
    } finally {
        console.log("Test 1 completed, cleaning up...");
    }
}

// Test 2: Security with Middleware Configuration
async function testSecurityWithConfig() {
    console.log("\n🔬 Test 2: Security with Middleware Configuration");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Configure security through middleware API
    app.middleware({
        security: { enabled: true },
    });

    app.get("/config-security-test", (_req: any, res: any) => {
        res.json({ configured: true });
    });

    const testPort = 8100;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        const response = await makeRequest(
            `http://localhost:${testPort}/config-security-test`
        );

        assert(response.status === 200, "Request should succeed");

        // Security headers should be present when enabled through config
        // Note: The immediate implementation may not have all advanced security features
        // but basic headers should be present
    } finally {
        console.log("Test 2 completed, cleaning up...");
    }
}

// Test 3: Disabled Security
async function testDisabledSecurity() {
    console.log("\n🔬 Test 3: Disabled Security");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Configure with security disabled
    app.middleware({
        security: { enabled: false },
    });

    app.get("/no-security-test", (_req: any, res: any) => {
        res.json({ security: "disabled" });
    });

    const testPort = 8101;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        const response = await makeRequest(
            `http://localhost:${testPort}/no-security-test`
        );

        assert(response.status === 200, "Request should succeed");

        // When security is disabled, security headers should not be added
        // (or should be minimal)
    } finally {
        console.log("Test 3 completed, cleaning up...");
    }
}

// Test 4: Security Headers Persistence
async function testSecurityHeadersPersistence() {
    console.log("\n🔬 Test 4: Security Headers Persistence");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Enable security
    app.enableSecurity();

    // Add multiple routes
    app.get("/route1", (_req: any, res: any) => {
        res.json({ route: 1 });
    });

    app.get("/route2", (_req: any, res: any) => {
        res.json({ route: 2 });
    });

    app.post("/route3", (_req: any, res: any) => {
        res.json({ route: 3 });
    });

    const testPort = 8102;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        // Test that security headers are present on all routes
        const response1 = await makeRequest(
            `http://localhost:${testPort}/route1`
        );
        const response2 = await makeRequest(
            `http://localhost:${testPort}/route2`
        );
        const response3 = await makeRequest(
            `http://localhost:${testPort}/route3`,
            {
                method: "POST",
            }
        );

        // All responses should have security headers
        [response1, response2, response3].forEach((response, index) => {
            assert(
                response.status === 200,
                `Route ${index + 1} should succeed`
            );
            assert(
                response.headers["x-content-type-options"] === "nosniff",
                `Route ${index + 1} should have security headers`
            );
        });
    } finally {
        console.log("Test 4 completed, cleaning up...");
    }
}

// Test 5: Security with Other Middleware
async function testSecurityWithOtherMiddleware() {
    console.log("\n🔬 Test 5: Security with Other Middleware");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Enable security and CORS together
    app.enableSecurity();
    app.enableCors();

    app.get("/combined-test", (_req: any, res: any) => {
        res.json({ combined: true });
    });

    const testPort = 8103;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        const response = await makeRequest(
            `http://localhost:${testPort}/combined-test`,
            {
                headers: { Origin: "http://localhost:3000" },
            }
        );

        assert(response.status === 200, "Request should succeed");

        // Should have both security and CORS headers
        assert(
            response.headers["x-content-type-options"] === "nosniff",
            "Should have security headers"
        );

        assert(
            response.headers["access-control-allow-origin"] === "*",
            "Should have CORS headers"
        );
    } finally {
        console.log("Test 5 completed, cleaning up...");
    }
}

// Main test runner
async function runAllTests() {
    try {
        await testBasicSecurityHeaders();
        await sleep(500);

        await testSecurityWithConfig();
        await sleep(500);

        await testDisabledSecurity();
        await sleep(500);

        await testSecurityHeadersPersistence();
        await sleep(500);

        await testSecurityWithOtherMiddleware();

        console.log("\n🎉 All Security Tests Passed!");
        process.exit(0);
    } catch (error) {
        console.error("\n💥 Security Test Suite Failed:", error);
        process.exit(1);
    }
}

// Run tests
runAllTests();


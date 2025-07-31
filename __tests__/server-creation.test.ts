/**
 * XyPrissSecurity Server Creation Tests
 * Simple direct tests for basic server creation and functionality
 */

import { createServer } from "../integrations/express/ServerFactory";

console.log("🧪 Starting XyPrissSecurity Server Creation Tests...");

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

// Test 1: Server Instance Creation
async function testServerCreation() {
    console.log("\n🔬 Test 1: Server Instance Creation");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Debug: Check what we actually got
    console.log("🔍 Debug - app type:", typeof app);
    console.log("🔍 Debug - app value:", app);
    console.log(
        "🔍 Debug - app methods:",
        Object.getOwnPropertyNames(app || {})
    );

    // Test that server instance is created with required methods
    assert(
        typeof app === "object" && app !== null,
        "Server should be an object"
    );
    assert(typeof app.use === "function", "Server should have use() method");
    assert(typeof app.get === "function", "Server should have get() method");
    assert(typeof app.post === "function", "Server should have post() method");
    assert(
        typeof app.start === "function",
        "Server should have start() method"
    );
    assert(
        typeof app.middleware === "function",
        "Server should have middleware() method"
    );
    assert(
        typeof app.waitForReady === "function",
        "Server should have waitForReady() method"
    );

    console.log("✅ Server instance created with all required methods");
}

// Test 2: Immediate Middleware API
async function testImmediateMiddlewareAPI() {
    console.log("\n🔬 Test 2: Immediate Middleware API");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Test middleware API is available immediately
    const middleware = app.middleware();
    assert(
        typeof middleware === "object",
        "Middleware API should return an object"
    );
    assert(
        typeof middleware.register === "function",
        "Middleware should have register() method"
    );

    // Test convenience methods are available
    assert(
        typeof app.enableSecurity === "function",
        "Should have enableSecurity() method"
    );
    assert(
        typeof app.enableCors === "function",
        "Should have enableCors() method"
    );
    assert(
        typeof app.enableCompression === "function",
        "Should have enableCompression() method"
    );
    assert(
        typeof app.enableRateLimit === "function",
        "Should have enableRateLimit() method"
    );

    console.log("✅ Immediate middleware API is available");
}

// Test 3: Basic Route Handling
async function testBasicRoutes() {
    console.log("\n🔬 Test 3: Basic Route Handling");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Add test routes
    app.get("/test-get", (_req: any, res: any) => {
        res.json({ method: "GET", success: true });
    });

    app.post("/test-post", (_req: any, res: any) => {
        res.json({ method: "POST", success: true });
    });

    const testPort = 8097;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        // Test GET request
        const getResponse = await makeRequest(
            `http://localhost:${testPort}/test-get`
        );
        assert(getResponse.status === 200, "GET request should succeed");
        assert(
            getResponse.body.includes("GET"),
            "GET response should contain method"
        );

        // Test POST request
        const postResponse = await makeRequest(
            `http://localhost:${testPort}/test-post`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ test: "data" }),
            }
        );
        assert(postResponse.status === 200, "POST request should succeed");
        assert(
            postResponse.body.includes("POST"),
            "POST response should contain method"
        );
    } finally {
        console.log("Test 3 completed, cleaning up...");
    }
}

// Test 4: Middleware Registration and Execution
async function testMiddlewareExecution() {
    console.log("\n🔬 Test 4: Middleware Registration and Execution");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    let middlewareExecuted = false;

    // Register middleware immediately
    const middleware = app.middleware();
    middleware.register((_req: any, _res: any, next: any) => {
        middlewareExecuted = true;
        next();
    });

    app.get("/middleware-test", (_req: any, res: any) => {
        res.json({ middlewareExecuted });
    });

    const testPort = 8098;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        const response = await makeRequest(
            `http://localhost:${testPort}/middleware-test`
        );
        assert(response.status === 200, "Request should succeed");
        assert(
            response.body.includes("true"),
            "Middleware should have executed"
        );
    } finally {
        console.log("Test 4 completed, cleaning up...");
    }
}

// Test 5: Method Chaining
async function testMethodChaining() {
    console.log("\n🔬 Test 5: Method Chaining");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Test that convenience methods support chaining
    const result = app.enableSecurity().enableCors().enableCompression();

    assert(
        result === app,
        "Methods should return the app instance for chaining"
    );
    console.log("✅ Method chaining works correctly");
}

// Main test runner
async function runAllTests() {
    try {
        await testServerCreation();
        await testImmediateMiddlewareAPI();
        await testBasicRoutes();
        await sleep(500);
        await testMiddlewareExecution();
        await sleep(500);
        await testMethodChaining();

        console.log("\n🎉 All Server Creation Tests Passed!");
        process.exit(0);
    } catch (error) {
        console.error("\n💥 Server Creation Test Suite Failed:", error);
        process.exit(1);
    }
}

// Run tests
runAllTests();


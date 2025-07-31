/**
 * XyPrissSecurity CORS Tests
 * Simple direct tests for Cross-Origin Resource Sharing functionality
 */

import { createServer } from "../integrations/express/ServerFactory";

console.log("🧪 Starting XyPrissSecurity CORS Tests...");

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

// Test 1: Basic CORS Configuration
async function testBasicCors() {
    console.log("\n🔬 Test 1: Basic CORS Configuration");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Configure CORS with specific origins
    app.middleware({
        cors: {
            enabled: true,
            origin: ["http://localhost:3000", "https://example.com"],
            methods: ["GET", "POST", "OPTIONS"],
            allowedHeaders: ["Content-Type", "Authorization"],
        },
    });

    app.get("/cors-test", (_req: any, res: any) => {
        res.json({ cors: "working" });
    });

    const testPort = 8093;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        // Test preflight request with allowed origin
        const preflightResponse = await makeRequest(
            `http://localhost:${testPort}/cors-test`,
            {
                method: "OPTIONS",
                headers: {
                    Origin: "http://localhost:3000",
                    "Access-Control-Request-Method": "GET",
                },
            }
        );

        assert(
            preflightResponse.status === 204,
            "Preflight request should return 204"
        );
        assert(
            preflightResponse.headers["access-control-allow-origin"] ===
                "http://localhost:3000",
            "Should allow the specified origin"
        );
        assert(
            preflightResponse.headers["access-control-allow-methods"]?.includes(
                "GET"
            ),
            "Should allow GET method"
        );

        // Test actual request with allowed origin
        const actualResponse = await makeRequest(
            `http://localhost:${testPort}/cors-test`,
            {
                method: "GET",
                headers: {
                    Origin: "http://localhost:3000",
                },
            }
        );

        assert(actualResponse.status === 200, "Actual request should succeed");
        assert(
            actualResponse.headers["access-control-allow-origin"] ===
                "http://localhost:3000",
            "Actual response should include CORS headers"
        );
    } finally {
        console.log("Test 1 completed, cleaning up...");
    }
}

// Test 2: CORS Origin Filtering
async function testCorsOriginFiltering() {
    console.log("\n🔬 Test 2: CORS Origin Filtering");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Configure CORS with specific allowed origins
    app.middleware({
        cors: {
            enabled: true,
            origin: ["https://allowed.com"],
            methods: ["GET", "POST"],
            allowedHeaders: ["Content-Type"],
        },
    });

    app.get("/origin-test", (_req: any, res: any) => {
        res.json({ message: "success" });
    });

    const testPort = 8094;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        // Test with allowed origin
        const allowedResponse = await makeRequest(
            `http://localhost:${testPort}/origin-test`,
            {
                method: "OPTIONS",
                headers: {
                    Origin: "https://allowed.com",
                    "Access-Control-Request-Method": "GET",
                },
            }
        );

        assert(
            allowedResponse.headers["access-control-allow-origin"] ===
                "https://allowed.com",
            "Should allow the whitelisted origin"
        );

        // Test with disallowed origin
        const disallowedResponse = await makeRequest(
            `http://localhost:${testPort}/origin-test`,
            {
                method: "OPTIONS",
                headers: {
                    Origin: "https://malicious.com",
                    "Access-Control-Request-Method": "GET",
                },
            }
        );

        assert(
            !disallowedResponse.headers["access-control-allow-origin"] ||
                disallowedResponse.headers["access-control-allow-origin"] !==
                    "https://malicious.com",
            "Should not allow non-whitelisted origin"
        );
    } finally {
        console.log("Test 2 completed, cleaning up...");
    }
}

// Test 3: CORS Method and Header Restrictions
async function testCorsMethodHeaders() {
    console.log("\n🔬 Test 3: CORS Method and Header Restrictions");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Configure CORS with restricted methods and headers
    app.middleware({
        cors: {
            enabled: true,
            origin: ["http://localhost:3000"],
            methods: ["GET", "POST"], // Only allow GET and POST
            allowedHeaders: ["Content-Type"], // Only allow Content-Type header
        },
    });

    app.get("/method-test", (_req: any, res: any) => {
        res.json({ method: "GET" });
    });

    app.post("/method-test", (_req: any, res: any) => {
        res.json({ method: "POST" });
    });

    const testPort = 8095;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        // Test allowed method
        const allowedMethodResponse = await makeRequest(
            `http://localhost:${testPort}/method-test`,
            {
                method: "OPTIONS",
                headers: {
                    Origin: "http://localhost:3000",
                    "Access-Control-Request-Method": "GET",
                },
            }
        );

        assert(
            allowedMethodResponse.headers[
                "access-control-allow-methods"
            ]?.includes("GET"),
            "Should allow GET method"
        );

        // Test allowed headers
        assert(
            allowedMethodResponse.headers[
                "access-control-allow-headers"
            ]?.includes("Content-Type"),
            "Should allow Content-Type header"
        );
    } finally {
        console.log("Test 3 completed, cleaning up...");
    }
}

// Test 4: Disabled CORS
async function testDisabledCors() {
    console.log("\n🔬 Test 4: Disabled CORS");

    const app = createServer({
        logging: { enabled: false, consoleInterception: { enabled: false } },
    });

    // Configure with CORS disabled
    app.middleware({
        cors: { enabled: false },
    });

    app.get("/no-cors-test", (_req: any, res: any) => {
        res.json({ cors: "disabled" });
    });

    const testPort = 8096;
    await new Promise<void>((resolve) => {
        app.start(testPort, () => resolve());
    });

    await sleep(100);

    try {
        const response = await makeRequest(
            `http://localhost:${testPort}/no-cors-test`,
            {
                method: "GET",
                headers: {
                    Origin: "http://localhost:3000",
                },
            }
        );

        assert(response.status === 200, "Request should succeed");
        // When CORS is disabled, there should be no CORS headers
        // (or default browser behavior applies)
    } finally {
        console.log("Test 4 completed, cleaning up...");
    }
}

// Main test runner
async function runAllTests() {
    try {
        await testBasicCors();
        await sleep(500);

        await testCorsOriginFiltering();
        await sleep(500);

        await testCorsMethodHeaders();
        await sleep(500);

        await testDisabledCors();

        console.log("\n🎉 All CORS Tests Passed!");
        process.exit(0);
    } catch (error) {
        console.error("\n💥 CORS Test Suite Failed:", error);
        process.exit(1);
    }
}

// Run tests
runAllTests();


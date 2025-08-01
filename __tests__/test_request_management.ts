// Test request management and func() serialization fixes

import { createServer, func } from "../mods/security/src/index";

// Create server with request management configuration
const app = createServer({
    server: {
        port: 3001,
        host: "localhost",
    },
    env: "development",

    // Request management configuration
    requestManagement: {
        timeout: {
            enabled: true,
            defaultTimeout: 10000, // 10 seconds default
            routes: {
                "/slow": 15000, // 15 seconds for slow endpoint
                "/quick": 2000, // 2 seconds for quick endpoint
            },
            includeStackTrace: true,
        },
        concurrency: {
            maxConcurrentRequests: 100,
            maxPerIP: 10,
            queueTimeout: 5000,
        },
        lifecycle: {
            enabled: true,
            trackStartTime: true,
            trackStages: true,
            warnAfter: 5000, // Warn after 5 seconds
        },
        payload: {
            maxBodySize: 1024 * 1024, // 1MB
            maxUrlLength: 2048,
        },
    },
});

// Test func() with Express req/res objects (should not throw serialization errors)
const handleRequest = func((req: any, res: any) => {
    console.log(`🎯 Processing ${req.method} ${req.url}`);

    // Add some processing time
    const startTime = Date.now();

    // Return response data (not the res object itself)
    return {
        message: "Request processed successfully",
        method: req.method,
        url: req.url,
        timestamp: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        userAgent: req.headers["user-agent"],
    };
});

// Test routes
app.get("/", async (req, res) => {
    try {
        const result = await handleRequest(req, res);
        res.json(result);
    } catch (error) {
        console.error("❌ Error in handleRequest:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Quick endpoint (should complete within 2 seconds)
app.get("/quick", async (req, res) => {
    const result = await handleRequest(req, res);
    res.json({ ...result, endpoint: "quick" });
});

// Slow endpoint (has 15 seconds timeout)
app.get("/slow", async (req, res) => {
    // Simulate slow processing
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const result = await handleRequest(req, res);
    res.json({ ...result, endpoint: "slow", delayed: true });
});

// Timeout test endpoint (will exceed default timeout)
app.get("/timeout", async (req, res) => {
    // This will exceed the 10 second default timeout
    await new Promise((resolve) => setTimeout(resolve, 12000));
    const result = await handleRequest(req, res);
    res.json({ ...result, endpoint: "timeout" });
});

// Endpoint that creates circular references (tests safe JSON middleware)
app.get("/circular", (req, res) => {
    const data = {
        message: "Testing circular references",
        timestamp: Date.now(),
        request: {
            method: req.method,
            url: req.url,
            headers: req.headers,
        },
    };

    // Create circular reference
    (data as any).self = data;
    (data.request as any).fullRequest = req;

    res.json(data);
});

// Test concurrent requests
app.get("/concurrent", async (req, res) => {
    const delay = Math.random() * 2000; // Random delay up to 2 seconds
    await new Promise((resolve) => setTimeout(resolve, delay));

    const result = await handleRequest(req, res);
    res.json({
        ...result,
        endpoint: "concurrent",
        delay: Math.round(delay),
    });
});

// Start server
app.listen(() => {
    console.log("🚀 Test server started!");
    console.log("📋 Test endpoints:");
    console.log("  GET http://localhost:3001/          - Basic request");
    console.log(
        "  GET http://localhost:3001/quick     - Quick endpoint (2s timeout)"
    );
    console.log(
        "  GET http://localhost:3001/slow      - Slow endpoint (15s timeout)"
    );
    console.log(
        "  GET http://localhost:3001/timeout   - Timeout test (will timeout)"
    );
    console.log(
        "  GET http://localhost:3001/circular  - Circular reference test"
    );
    console.log("  GET http://localhost:3001/concurrent - Concurrency test");
    console.log("");
    console.log("🧪 Test scenarios:");
    console.log(
        "  1. func() with Express objects - should not throw serialization errors"
    );
    console.log("  2. Request timeouts - /timeout should return 408 after 10s");
    console.log("  3. Route-specific timeouts - /quick has 2s, /slow has 15s");
    console.log(
        "  4. Circular references - /circular should work without errors"
    );
    console.log(
        "  5. Concurrency limits - try many concurrent requests to /concurrent"
    );
    console.log("");
    console.log("💡 Try: curl http://localhost:3001/ or open in browser");
});

export { app };


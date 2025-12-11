#!/usr/bin/env bun
/**
 * Manual Network Plugins Verification Demo
 *
 * This creates a demo server where you can manually test each plugin
 * and see the actual outputs and behaviors.
 */

import { createServer } from "../src/index";

console.log(`
╔════════════════════════════════════════════════════════════╗
║     XyPriss Network Plugins - Manual Verification Demo    ║
╚════════════════════════════════════════════════════════════╝
`);

const PORT = 9999;

const app = createServer({
    server: {
        port: PORT,
        host: "localhost",
    },
    network: {
        // Connection Plugin
        connection: {
            enabled: true,
            http2: {
                enabled: false, // Keep simple for demo
                maxConcurrentStreams: 100,
            },
            keepAlive: {
                enabled: true,
                timeout: 30000,
                maxRequests: 100,
            },
            connectionPool: {
                maxConnections: 1000,
                timeout: 5000,
                idleTimeout: 60000,
            },
        },

        // Compression Plugin
        compression: {
            enabled: true,
            algorithms: ["br", "deflate"],
            level: 6,
            threshold: 100, // Compress responses > 100 bytes
            contentTypes: [
                "text/html",
                "text/css",
                "text/javascript",
                "application/json",
                "application/xml",
            ],
        },

        // Rate Limiting Plugin
        rateLimit: {
            enabled: true,
            strategy: "sliding-window",
            global: {
                requests: 1000,
                window: "1h",
            },
            perIP: {
                requests: 20,
                window: "1m",
            },
            headers: {
                enabled: true,
                prefix: "X-RateLimit",
            },
        },

        // Proxy Plugin (disabled for this demo)
        proxy: {
            enabled: false,
            upstreams: [],
            loadBalancing: "round-robin",
        },
    },
    logging: {
        enabled: true,
        level: "info",
    },
});

// ============================================================================
// TEST ENDPOINTS
// ============================================================================

// 1. Basic endpoint to test connection
app.get("/", (req, res) => {
    res.json({
        message: "🎉 XyPriss Network Plugins Demo Server",
        timestamp: new Date().toISOString(),
        endpoints: {
            "/": "This page",
            "/test/connection": "Test Connection Plugin",
            "/test/compression": "Test Compression Plugin",
            "/test/compression/large": "Test Compression with large data",
            "/test/ratelimit": "Test Rate Limiting Plugin",
            "/test/headers": "View all response headers",
            "/test/all": "Test all plugins together",
            "/stats": "View plugin statistics",
        },
        activePlugins: {
            connection: true,
            compression: true,
            rateLimit: true,
            proxy: false,
        },
    });
});

// 2. Connection Plugin Test
app.get("/test/connection", (req, res) => {
    const connectionInfo = {
        plugin: "Connection Plugin",
        status: "✅ Active",
        features: {
            keepAlive: "enabled",
            timeout: "30000ms",
            maxRequests: 100,
            connectionPool: {
                maxConnections: 1000,
                timeout: 5000,
            },
        },
        requestInfo: {
            ip: req.ip,
            protocol: req.protocol,
            httpVersion: req.httpVersion,
            method: req.method,
            path: req.path,
        },
        headers: {
            connection: req.get("connection"),
            keepAlive: req.get("keep-alive"),
            userAgent: req.get("user-agent"),
        },
        timestamp: new Date().toISOString(),
    };

    console.log("\n📡 Connection Plugin Test:");
    console.log(JSON.stringify(connectionInfo, null, 2));

    res.json(connectionInfo);
});

// 3. Compression Plugin Test - Small Response
app.get("/test/compression", (req, res) => {
    const compressionInfo = {
        plugin: "Compression Plugin",
        status: "✅ Active",
        message: "This is a small response that might not be compressed",
        note: "Compression threshold is 100 bytes",
        acceptEncoding: req.get("accept-encoding"),
        timestamp: new Date().toISOString(),
    };

    console.log("\n🗜️  Compression Plugin Test (Small):");
    console.log(`Accept-Encoding: ${req.get("accept-encoding")}`);
    console.log(
        `Response size: ~${JSON.stringify(compressionInfo).length} bytes`
    );

    res.json(compressionInfo);
});

// 4. Compression Plugin Test - Large Response
app.get("/test/compression/large", (req, res) => {
    const largeData = {
        plugin: "Compression Plugin",
        status: "✅ Active",
        message: "This is a large response that SHOULD be compressed",
        note: "This response is over 100 bytes and contains repetitive data",
        data: Array.from({ length: 100 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            description:
                `This is a detailed description for item ${i}. `.repeat(5),
            metadata: {
                created: new Date().toISOString(),
                tags: [`tag${i}`, `category${i % 10}`, "test", "demo"],
                active: i % 2 === 0,
                score: Math.random() * 100,
            },
        })),
        stats: {
            totalItems: 100,
            uncompressedSize: "~50KB",
            compressionAlgorithms: ["br", "gzip", "deflate"],
            threshold: "100 bytes",
        },
        timestamp: new Date().toISOString(),
    };

    const uncompressedSize = JSON.stringify(largeData).length;

    console.log("\n🗜️  Compression Plugin Test (Large):");
    console.log(`Accept-Encoding: ${req.get("accept-encoding")}`);
    console.log(`Uncompressed size: ${uncompressedSize} bytes`);
    console.log(`Expected compression: Yes (> 100 bytes threshold)`);

    res.json(largeData);
});

// 5. Rate Limiting Plugin Test
let rateLimitCounter = 0;
app.get("/test/ratelimit", (req, res) => {
    rateLimitCounter++;

    const rateLimitInfo = {
        plugin: "Rate Limiting Plugin",
        status: "✅ Active",
        requestNumber: rateLimitCounter,
        limits: {
            perIP: "20 requests per minute",
            global: "1000 requests per hour",
            strategy: "sliding-window",
        },
        clientInfo: {
            ip: req.ip,
            userAgent: req.get("user-agent"),
        },
        rateLimitHeaders: {
            limit: res.get("RateLimit-Limit"),
            remaining: res.get("RateLimit-Remaining"),
            reset: res.get("RateLimit-Reset"),
        },
        message:
            "Try making 21+ requests within 1 minute to see rate limiting in action",
        timestamp: new Date().toISOString(),
    };

    console.log("\n⏱️  Rate Limiting Plugin Test:");
    console.log(`Request #${rateLimitCounter} from ${req.ip}`);
    console.log(`Rate Limit Headers:`, rateLimitInfo.rateLimitHeaders);

    res.json(rateLimitInfo);
});

// 6. Headers Inspection
app.get("/test/headers", (req, res) => {
    const allHeaders = {
        requestHeaders: req.headers,
        responseHeaders: {
            note: "Response headers will be visible in the HTTP response",
            checkFor: [
                "Content-Encoding (compression)",
                "Connection (keep-alive)",
                "RateLimit-* (rate limiting)",
                "Content-Security-Policy (security)",
            ],
        },
        timestamp: new Date().toISOString(),
    };

    console.log("\n📋 Headers Inspection:");
    console.log("Request Headers:", JSON.stringify(req.headers, null, 2));

    res.json(allHeaders);
});

// 7. Test All Plugins Together
app.get("/test/all", (req, res) => {
    const allPluginsTest = {
        message: "Testing all network plugins simultaneously",
        plugins: {
            connection: {
                status: "✅ Active",
                keepAlive: true,
                connectionInfo: {
                    ip: req.ip,
                    protocol: req.protocol,
                },
            },
            compression: {
                status: "✅ Active",
                willCompress: true,
                algorithms: ["br", "gzip", "deflate"],
                acceptEncoding: req.get("accept-encoding"),
            },
            rateLimit: {
                status: "✅ Active",
                strategy: "sliding-window",
                limits: "20 req/min per IP",
            },
        },
        largeDataForCompression: Array.from({ length: 50 }, (_, i) => ({
            id: i,
            text: "This is test data that will be compressed. ".repeat(10),
            timestamp: new Date().toISOString(),
        })),
        timestamp: new Date().toISOString(),
    };

    console.log("\n🎯 All Plugins Test:");
    console.log(`- Connection: ${req.ip} via ${req.protocol}`);
    console.log(`- Compression: ${req.get("accept-encoding")}`);
    console.log(`- Rate Limit: Request from ${req.ip}`);

    res.json(allPluginsTest);
});

// 8. Statistics Endpoint
app.get("/stats", (req, res) => {
    const stats = {
        server: {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            platform: process.platform,
            nodeVersion: process.version,
        },
        requests: {
            rateLimitTestCount: rateLimitCounter,
        },
        plugins: {
            connection: "Active - Managing connections with keep-alive",
            compression: "Active - Compressing responses > 100 bytes",
            rateLimit: "Active - 20 req/min per IP, 1000 req/hour global",
            proxy: "Inactive - Not configured for this demo",
        },
        timestamp: new Date().toISOString(),
    };

    console.log("\n📊 Statistics Request");

    res.json(stats);
});

// Start server
app.start(undefined, () => {
    console.log(`
✅ Demo server is running!

🌐 URL: http://localhost:${PORT}

📝 Test the following endpoints in your browser or with curl:

1️⃣  Connection Plugin:
   curl http://localhost:${PORT}/test/connection

2️⃣  Compression Plugin (small):
   curl -H "Accept-Encoding: gzip" http://localhost:${PORT}/test/compression

3️⃣  Compression Plugin (large):
   curl -H "Accept-Encoding: gzip" -v http://localhost:${PORT}/test/compression/large
   (Check for "Content-Encoding: gzip" in response headers)

4️⃣  Rate Limiting Plugin:
   # Run this multiple times quickly (21+ times)
   for i in {1..25}; do curl http://localhost:${PORT}/test/ratelimit; done

5️⃣  Headers Inspection:
   curl -v http://localhost:${PORT}/test/headers

6️⃣  All Plugins Together:
   curl -H "Accept-Encoding: gzip" -v http://localhost:${PORT}/test/all

7️⃣  Statistics:
   curl http://localhost:${PORT}/stats

💡 Tips:
   - Use -v flag with curl to see response headers
   - Use -H "Accept-Encoding: gzip" to request compression
   - Watch the console output for plugin activity
   - Try the endpoints in your browser for formatted JSON

Press Ctrl+C to stop the server
`);
});


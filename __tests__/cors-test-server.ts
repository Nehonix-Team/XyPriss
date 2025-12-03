/**
 * Simple test server for CORS bug reproduction
 * Use this with curl to test CORS headers
 *
 * Start this server, then run:
 * curl -I -X OPTIONS http://localhost:6287/api/v1/auth/login \
 *   -H "Origin: http://localhost:5174" \
 *   -H "Access-Control-Request-Method: POST" \
 *   -H "Access-Control-Request-Headers: xp-request-sig,content-type"
 */

import { createServer } from "../src/server/ServerFactory";

console.log("🚀 Starting CORS Test Server...\n");

const app = createServer({
    logging: {
        enabled: true,
        level: "info",
        consoleInterception: { enabled: false },
    },
    server: {
        port: 6287,
        host: "localhost",
    },
    security: {
        cors: {
            origin: "*",
            // These arrays should be serialized to comma-separated strings
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
    multiServer: {
        enabled: false,
        servers: [
            {
                id: "cross_platform_",
                port: 6287,
                host: "localhost",
                security: {
                    cors: {
                        origin: "*",
                        // These arrays should be serialized to comma-separated strings
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

// Add test routes
app.get("/api/v1/auth/login", (_req: any, res: any) => {
    res.json({ message: "Login endpoint" });
});

app.post("/api/v1/auth/login", (_req: any, res: any) => {
    res.json({ message: "Login successful" });
});

// Start the server
app.start()
    .then(() => {
        console.log("\n✅ Server started successfully!");
        console.log("\n📋 Test with curl:");
        console.log(
            "\ncurl -I -X OPTIONS http://localhost:6287/api/v1/auth/login \\"
        );
        console.log('  -H "Origin: http://localhost:5174" \\');
        console.log('  -H "Access-Control-Request-Method: POST" \\');
        console.log(
            '  -H "Access-Control-Request-Headers: xp-request-sig,content-type,authorization"'
        );
        console.log("\n🔍 Look for these headers in the response:");
        console.log(
            "  - Access-Control-Allow-Methods (should be comma-separated, NOT '[object Object]')"
        );
        console.log(
            "  - Access-Control-Allow-Headers (should be present, NOT missing)"
        );
        console.log("\nPress Ctrl+C to stop the server\n");
    })
    .catch((error) => {
        console.error("❌ Failed to start server:", error);
        process.exit(1);
    });

// Handle graceful shutdown
process.on("SIGINT", async () => {
    console.log("\n\n🛑 Shutting down server...");
    await app.stop();
    process.exit(0);
});


import { createServer } from "../integrations/express/ServerFactory";

console.log("🧪 Testing Auto Port Switching with Available Port");
console.log("=================================================");

// Test with a port that should be available (no conflict)
const app = createServer({
    server: {
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 5,
            strategy: "random",
        },
    },
    logging: {
        enabled: true,
        level: "debug", // Enable debug logs to see what's happening
    },
});

app.get("/", (req, res) => {
    res.json({
        message: "Hello from server!",
        port: app.getPort(),
        requestedPort: 9999,
    });
});

console.log(
    "🔧 About to call app.start(9999) - port should be available, no switching needed..."
);

// This should NOT trigger auto port switching since port 9999 should be available
app.start(9999, () => {
    console.log(`\n✅ Server started successfully!`);
    console.log(`📍 Final port: ${app.getPort()}`);
    console.log(`🌐 Test URL: http://localhost:${app.getPort()}/`);

    if (app.getPort() === 9999) {
        console.log(
            "✅ Correct behavior: Used requested port since it was available"
        );
    } else {
        console.log(
            "❌ Unexpected behavior: Port switched even though 9999 should be available"
        );
    }

    // Test the server
    setTimeout(() => {
        console.log("\n🧪 Testing the server...");

        import("http").then(({ default: http }) => {
            const options = {
                hostname: "localhost",
                port: app.getPort(),
                path: "/",
                method: "GET",
            };

            const req = http.request(options, (res) => {
                let data = "";
                res.on("data", (chunk) => {
                    data += chunk;
                });
                res.on("end", () => {
                    console.log("📡 Response:", JSON.parse(data));
                    console.log("\n✅ Test completed successfully!");

                    // Cleanup
                    setTimeout(() => {
                        process.exit(0);
                    }, 1000);
                });
            });

            req.on("error", (err) => {
                console.error("❌ Test request failed:", err.message);
                process.exit(1);
            });

            req.end();
        });
    }, 1000);
}).catch((error) => {
    console.error("❌ Failed to start server:", error.message);
    console.error("❌ Stack:", error.stack);
    process.exit(1);
});

// Handle cleanup on exit
process.on("SIGINT", () => {
    console.log("\n🧹 Cleaning up...");
    process.exit(0);
});

process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught exception:", err.message);
    console.error("❌ Stack:", err.stack);
    process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
    console.error("❌ Unhandled rejection:", reason);
    process.exit(1);
});


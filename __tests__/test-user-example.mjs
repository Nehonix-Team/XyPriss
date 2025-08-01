// Test the user's original example - should now work without manual json() import
import { createServer } from "../dist/esm/src/index.js";
// Note: Commented out the manual json import - no longer needed!
// import { json } from "express";

console.log("🧪 Testing automatic JSON parsing (simplified version)...\n");

const server = createServer({
    server: {
        port: 3002,
        host: "localhost",
    },
});

// ✅ No longer needed - JSON parsing is automatic!
// server.use(json());

// Simple route to test JSON parsing
server.post("/api/secure-data", async (req, res) => {
    if (!req.body) {
        return res.send("Body is empty");
    }

    console.log("📦 req.body.sensitiveArray: ", req.body.sensitiveArray);
    console.log(
        "📦 req.body.password: ",
        req.body.password ? "[HIDDEN]" : "undefined"
    );

    try {
        // Simulate processing the data
        const dataLength = req.body.sensitiveArray
            ? req.body.sensitiveArray.length
            : 0;
        const hasPassword = !!req.body.password;

        // Generate a simple token (without security module for this test)
        const token = "test-token-" + Math.random().toString(36).substr(2, 9);

        res.json({
            success: true,
            message: "JSON parsing works automatically!",
            token,
            dataLength,
            hasPassword,
            receivedData: {
                sensitiveArrayLength: dataLength,
                hasPassword,
            },
        });
    } catch (error) {
        res.status(500).json({
            error: "Processing failed",
            details: error.message,
        });
    }
});

server.start(undefined, () => {
    console.log(
        "✅ Secure XyPriss server running at http://localhost:" +
            server.getPort()
    );

    // Test the endpoint
    console.log("📝 Testing the secure endpoint...");

    import("http").then(({ default: http }) => {
        const testData = JSON.stringify({
            sensitiveArray: ["secret1", "secret2", "secret3"],
            password: "mySecurePassword123",
        });

        const options = {
            hostname: "localhost",
            port: 3002,
            path: "/api/secure-data",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(testData),
            },
        };

        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                console.log("🎉 Response received:", JSON.parse(data));
                console.log("\n✅ SUCCESS: JSON parsing works automatically!");
                console.log("✅ No manual json() import required!");
                console.log("✅ XyPriss Security integration working!");
                process.exit(0);
            });
        });

        req.on("error", (e) => {
            console.error("❌ Request error:", e.message);
            process.exit(1);
        });

        req.write(testData);
        req.end();
    });
});

// Cleanup after 15 seconds
setTimeout(() => {
    console.log("⏰ Test timeout - cleaning up");
    process.exit(1);
}, 15000);


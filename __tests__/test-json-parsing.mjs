// Test script to verify if JSON parsing is working automatically
import { createServer } from "../dist/esm/src/index.js";

console.log("🧪 Testing automatic JSON parsing...\n");

const server = createServer({
    server: {
        port: 3001,
        host: "localhost",
    },
});

// Test route that expects JSON body
server.post("/test-json", (req, res) => {
    console.log("📦 Received body:", req.body);
    console.log("📦 Body type:", typeof req.body);
    console.log(
        "📦 Is object:",
        typeof req.body === "object" && req.body !== null
    );

    if (req.body && typeof req.body === "object") {
        res.json({
            success: true,
            message: "JSON parsing works automatically!",
            receivedData: req.body,
        });
    } else {
        res.json({
            success: false,
            message: "JSON parsing not working - body is not parsed",
            bodyType: typeof req.body,
            rawBody: req.body,
        });
    }
});

server.start(undefined, () => {
    console.log("🚀 Test server running on http://localhost:3001");
    console.log("📝 Testing JSON parsing...");

    // Test with a POST request
    import("http").then(({ default: http }) => {
        const postData = JSON.stringify({
            test: "data",
            number: 123,
            array: [1, 2, 3],
        });

        const options = {
            hostname: "localhost",
            port: 3001,
            path: "/test-json",
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(postData),
            },
        };

        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => {
                data += chunk;
            });
            res.on("end", () => {
                console.log("📨 Response:", JSON.parse(data));
                process.exit(0);
            });
        });

        req.on("error", (e) => {
            console.error("❌ Request error:", e.message);
            process.exit(1);
        });

        req.write(postData);
        req.end();
    });
});

// Cleanup after 10 seconds
setTimeout(() => {
    console.log("⏰ Test timeout - cleaning up");
    process.exit(1);
}, 10000);


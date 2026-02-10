import { createServer } from "../src";
import { Configs } from "../src/config";
import http from "node:http";

// Setup unique port
const PORT = 8088;
Configs.set("server.port", PORT); // Force port in config

// Create Server
const app = createServer({
    server: { port: PORT },
});

// 1. DELETE Handler (JSON Body test)
app.delete("/api/resource", (req: any, res: any) => {
    console.log("[SERVER] DELETE request received");
    const body = req.body;
    if (body && body.id) {
        res.json({ success: true, receivedId: body.id });
    } else {
        res.status(400).json({ error: "Missing ID in body" });
    }
});

// 2. CONNECT Handler (Routing test)
app.connect("/tunnel", (req: any, res: any) => {
    console.log("[SERVER] CONNECT request received");
    // Standard CONNECT usually returns 200 to indicate tunnel is ready
    // We will send headers and end response to simulate "Connected"
    res.writeHead(200, {
        "X-Tunnel-Status": "Simulated",
    });
    // In a real proxy, we would pipe sockets here.
    // For this test, we just satisfy the HTTP handshake.
    res.end();
});

// Start Server
console.log(`[TEST] Starting server on port ${PORT}...`);
app.start();

// Utilities for testing
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runTests() {
    // Wait for server to be ready (naive wait, normally would use callback or event)
    await sleep(2000);

    console.log("\n--- TEST 1: DELETE with JSON Body ---\n");

    // Test DELETE
    const deleteData = JSON.stringify({ id: "test-user-123" });
    const deleteOptions = {
        hostname: "localhost",
        port: PORT,
        path: "/api/resource",
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(deleteData),
        },
    };

    const deleteReq = http.request(deleteOptions, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
            console.log(`[CLIENT] DELETE Response Status: ${res.statusCode}`);
            console.log(`[CLIENT] DELETE Response Body: ${data}`);

            if (res.statusCode === 200 && data.includes("test-user-123")) {
                console.log("✅ DELETE Test PASSED");
            } else {
                console.log("❌ DELETE Test FAILED");
            }
        });
    });

    deleteReq.write(deleteData);
    deleteReq.end();

    // Give time for DELETE to finish
    await sleep(1000);

    console.log("\n--- TEST 2: CONNECT Method ---\n");

    // Test CONNECT
    const connectOptions = {
        hostname: "localhost",
        port: PORT,
        path: "/tunnel",
        method: "CONNECT",
    };

    const connectReq = http.request(connectOptions);

    // 'connect' event is emitted when server responds to CONNECT method with 2xx
    connectReq.on("connect", (res, socket, head) => {
        console.log(`[CLIENT] CONNECT Response Status: ${res.statusCode}`);
        console.log(
            `[CLIENT] Custom Header: ${res.headers["x-tunnel-status"]}`,
        );

        if (res.statusCode === 200) {
            console.log("✅ CONNECT Test PASSED (Tunnel Established)");
        } else {
            console.log("❌ CONNECT Test FAILED");
        }
        socket.end(); // Close the tunnel
    });

    connectReq.on("response", (res) => {
        // Fallback: some servers or clients handle CONNECT as regular request if not proxied correctly
        console.log(
            `[CLIENT] Standard Response received for CONNECT: ${res.statusCode}`,
        );
        if (res.statusCode === 200) {
            console.log("✅ CONNECT Test PASSED (Standard Response)");
        }
    });

    connectReq.on("error", (e) => {
        console.error(`[CLIENT] CONNECT Error: ${e.message}`);
    });

    connectReq.end();

    await sleep(2000);
    console.log("\n[TEST] Tests completed. Shutting down...");
    process.exit(0);
}

runTests();


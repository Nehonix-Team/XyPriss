/**
 * Simple Cluster Example
 * Demonstrates how easy it is to enable clustering in XyPriss
 * No complex worker detection logic needed!
 */

import { createServer } from "../src/server/ServerFactory";

console.log("🚀 Simple Cluster Example - No Complex Setup Required!");

// Create server with clustering enabled - that's it!
const server = createServer({
    server: { 
        port: 3000,
        host: "localhost",
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 10,
            strategy: "increment" 
        },
    },
    cluster: {
        enabled: true,  // Just enable clustering - XyPriss handles the rest!
        config: {
            workers: 2,
        }
    },
    security: {
        enabled: true,
        level: "enhanced",
        csrf: true,
        helmet: true,
        xss: true,
        bruteForce: true,
    },
    logging: { 
        enabled: true,
        level: "info",
        types: {
            debug: true,
            portSwitching: true,
        },
    }
});

// Add your routes normally - no worker detection needed!
server.get("/", (req, res) => {
    res.json({
        message: "Hello from XyPriss with automatic clustering!",
        worker: process.env.WORKER_ID || "master",
        port: process.env.WORKER_PORT || "master-process",
        pid: process.pid,
        timestamp: new Date().toISOString()
    });
});

server.get("/api/health", (req, res) => {
    res.json({
        status: "healthy",
        worker: process.env.WORKER_ID || "master",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

server.post("/api/data", (req, res) => {
    res.json({
        message: "Data processed successfully",
        worker: process.env.WORKER_ID || "master",
        data: req.body,
        timestamp: new Date().toISOString()
    });
});

// Start the server - clustering is handled automatically!
console.log("🎯 Starting server with automatic clustering...");
server.start();

console.log("✅ That's it! No complex worker detection logic needed.");
console.log("🔧 XyPriss automatically handles:");
console.log("   - Worker process detection");
console.log("   - Configuration passing");
console.log("   - Port management");
console.log("   - Route registration");
console.log("");
console.log("🧪 Test the cluster:");
console.log("   curl http://localhost:3000/");
console.log("   curl http://localhost:3000/api/health");

// Auto-shutdown after 30 seconds for demo
setTimeout(() => {
    console.log("🛑 Demo completed - shutting down");
    process.exit(0);
}, 30000);

/**
 * Debug Security Middleware
 * Simple test to identify the hanging issue
 */

import { createServer } from "../src/server/ServerFactory";

console.log("Creating server with minimal security config...");

const server = createServer({
    server: {
        port: 3000,
        host: "localhost",
    },
    security: {
        enabled: true,
        level: "enhanced",
        csrf: true,
        helmet: true,
        xss: true,
        sqlInjection: false, // Keep this disabled for now
        bruteForce: true,
    },
    logging: {
        enabled: true,
        level: "debug",
        types: {
            debug: true, // This is the key - enable debug type logging
        },
    },
});

server.get("/test", (req, res) => {
    console.log("Route handler called!");
    res.json({
        message: "Test successful!",
        timestamp: new Date().toISOString(),
    });
});

server.get("/", (req, res) => {
    console.log("Root route handler called!");
    res.json({
        message: "Hello from XyPriss!",
        security: "minimal",
    });
});

console.log("Starting server...");
server.start();

console.log("Server should be running on http://localhost:3000");
console.log("Test with: curl http://localhost:3000/test");


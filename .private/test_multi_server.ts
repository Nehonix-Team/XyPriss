import { createServer } from "../src";
import type { MultiServerApp } from "../src";
import { MultiServRouter } from "./router/index.router";

const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "api-server",
                port: 3003,
                routePrefix: "/api",
                allowedRoutes: ["/api/*"],
                server: {
                    host: "192.168.0.46",
                },
            },
            {
                id: "admin-server",
                port: 3009,
                routePrefix: "/admin",
                allowedRoutes: ["/admin/*"],
                security: {
                    level: "maximum",
                },
            },
        ],
    },
    security: {
        enabled: false, // Disable for testing
    },
});

// This won't work in multi-server mode - routes need to be defined per server
// Instead, we need to access individual servers

app.use("/api", MultiServRouter);
app.get("/api/test", (req, res) => {
    res.send("Hello world");
});

// Debug: Log that we're in multi-server mode
console.log("Multi-server mode initialized - routes will be distributed to individual servers");

console.log("Multi-server configuration created");
app.get("/", (req, res) => {
    res.send("Hello world");
});

app.get("/admin/test", (req, res) => {
    res.send("Hello world");
});

// In multi-server mode, the returned app is a MultiServerApp
console.log("Multi-server mode detected");

const multiServerApp = app as any; // Type assertion for multi-server methods

// Start all servers (simple API)
multiServerApp
    .startAllServers()
    .then(() => {
        console.log("All servers started successfully");

        const servers = multiServerApp.getServers();
        console.log(`Running ${servers.length} servers:`);
        servers.forEach((server) => {
            console.log(`- ${server.id}: ${server.host}:${server.port}`);
        });

        // Get stats
        const stats = multiServerApp.getStats();
        console.log("Multi-server stats:", stats);
    })
    .catch((error) => {
        console.error("Failed to start servers:", error);
    });


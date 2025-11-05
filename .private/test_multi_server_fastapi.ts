/**
 * Multi-Server FastAPI Test
 * 
 * Demonstrates FastAPI working in multi-server mode where routes are
 * automatically distributed to appropriate servers based on their configuration.
 */

import { createServer } from "../src";

const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "api-server",
                port: 4001,
                routePrefix: "/api",
                allowedRoutes: ["/api/*"],
                server: {
                    host: "localhost",
                },
            },
            {
                id: "admin-server",
                port: 4002,
                routePrefix: "/admin",
                allowedRoutes: ["/admin/*"],
                server: {
                    host: "localhost",
                },
            },
            {
                id: "public-server",
                port: 4003,
                routePrefix: "/",
                allowedRoutes: ["/", "/health", "/status"],
                server: {
                    host: "localhost",
                },
            },
        ],
    },
    security: {
        enabled: false,
    },
    logging: {
        enabled: true,
        components: {
            routing: true,
            server: true,
        },
    },
});

console.log("\n🚀 Registering FastAPI routes for multi-server distribution...\n");

// ===== API SERVER ROUTES (will go to port 4001) =====

app.fast().group("/api/v1", (group) => {
    group.get("/users", async (req, res, ctx) => {
        res.json({
            message: "List all users",
            server: "api-server",
            port: 4001,
            route: ctx.route,
        });
    });

    group.get("/users/:id<id>", async (req, res, ctx) => {
        res.json({
            message: "Get user by ID",
            userId: ctx.params.id,
            server: "api-server",
            port: 4001,
        });
    });

    group.post("/users", async (req, res, ctx) => {
        res.json({
            message: "Create user",
            body: req.body,
            server: "api-server",
            port: 4001,
        });
    });
});

app.fast().routes([
    {
        method: "GET",
        path: "/api/products",
        handler: async (req, res, ctx) => {
            res.json({
                message: "List all products",
                server: "api-server",
                port: 4001,
            });
        },
    },
    {
        method: "GET",
        path: "/api/products/:id<id>",
        handler: async (req, res, ctx) => {
            res.json({
                message: "Get product by ID",
                productId: ctx.params.id,
                server: "api-server",
                port: 4001,
            });
        },
    },
]);

// ===== ADMIN SERVER ROUTES (will go to port 4002) =====

app.fast().group("/admin", (group) => {
    group.use(async (req, res, ctx) => {
        console.log(`[Admin Middleware] ${ctx.method} ${ctx.route}`);
    });

    group.get("/dashboard", async (req, res, ctx) => {
        res.json({
            message: "Admin dashboard",
            server: "admin-server",
            port: 4002,
        });
    });

    group.get("/users", async (req, res, ctx) => {
        res.json({
            message: "Admin user management",
            server: "admin-server",
            port: 4002,
        });
    });

    group.get("/settings", async (req, res, ctx) => {
        res.json({
            message: "Admin settings",
            server: "admin-server",
            port: 4002,
        });
    });
});

// ===== PUBLIC SERVER ROUTES (will go to port 4003) =====

app.fast().get("/health", async (req, res, ctx) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        server: "public-server",
        port: 4003,
    });
});

app.fast().get("/status", async (req, res, ctx) => {
    const stats = app.getFastAPIStats();
    res.json({
        message: "Multi-server status",
        server: "public-server",
        port: 4003,
        stats,
    });
});

app.fast().get("/", async (req, res, ctx) => {
    res.json({
        message: "Welcome to Multi-Server FastAPI Demo",
        server: "public-server",
        port: 4003,
        endpoints: {
            api: "http://localhost:4001/api/v1/users",
            admin: "http://localhost:4002/admin/dashboard",
            health: "http://localhost:4003/health",
            status: "http://localhost:4003/status",
        },
    });
});

console.log("✅ FastAPI routes registered!\n");
console.log("📊 Pre-startup FastAPI Stats:");
console.log(JSON.stringify(app.getFastAPIStats(), null, 2));
console.log("\n");

console.log("Starting multi-server configuration...");
console.log("\n🔗 Test URLs:");
console.log("\n📡 API Server (port 4001):");
console.log("  - http://localhost:4001/api/v1/users");
console.log("  - http://localhost:4001/api/v1/users/123");
console.log("  - http://localhost:4001/api/products");
console.log("  - http://localhost:4001/api/products/456");
console.log("\n🔐 Admin Server (port 4002):");
console.log("  - http://localhost:4002/admin/dashboard");
console.log("  - http://localhost:4002/admin/users");
console.log("  - http://localhost:4002/admin/settings");
console.log("\n🌐 Public Server (port 4003):");
console.log("  - http://localhost:4003/");
console.log("  - http://localhost:4003/health");
console.log("  - http://localhost:4003/status");
console.log("\n");

app.start();

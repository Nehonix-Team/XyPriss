/**
 * Simple Plugin API Examples
 * Quick reference for common plugin patterns
 */

import { createServer, Plugin } from "xypriss";

// ============================================
// Example 1: Simple Plugin with Plugin.create()
// ============================================
const loggerPlugin = Plugin.create({
    name: "logger",
    version: "1.0.0",
    description: "Simple request logger",

    onRequest: (req, res, next) => {
        console.log(`${req.method} ${req.url}`);
        next();
    },
});

Plugin.register(loggerPlugin);

// ============================================
// Example 2: Plugin Factory with Configuration
// ============================================
const createDatabasePlugin = Plugin.factory((config: { url: string }) => ({
    name: "database",
    version: "1.0.0",

    onServerStart: async (server) => {
        // Connect to database
        server.db = await connectToDatabase(config.url);
        console.log("Database connected");
    },

    onServerStop: async (server) => {
        // Cleanup
        await server.db?.disconnect();
        console.log("Database disconnected");
    },

    registerRoutes: (app) => {
        app.get("/db/health", (req, res) => {
            res.json({ connected: true });
        });
    },
}));

// Use the factory
const dbPlugin = createDatabasePlugin({ url: "postgresql://localhost/mydb" });
Plugin.register(dbPlugin);

// ============================================
// Example 3: Plugin with Dependencies
// ============================================
Plugin.register({
    name: "auth",
    version: "1.0.0",
    dependencies: ["database"], // Loaded after database plugin

    registerRoutes: (app) => {
        app.post("/auth/login", async (req, res) => {
            const { username, password } = req.body;
            // Use server.db from database plugin
            const user = await (req as any).app.db.findUser(username);
            // ... auth logic
            res.json({ token: "..." });
        });
    },
});

// ============================================
// Example 4: Metrics Plugin
// ============================================
const createMetricsPlugin = Plugin.factory(() => {
    const metrics = {
        requests: 0,
        errors: 0,
    };

    return {
        name: "metrics",
        version: "1.0.0",

        onRequest: (req, res, next) => {
            metrics.requests++;

            res.on("finish", () => {
                if (res.statusCode >= 400) {
                    metrics.errors++;
                }
            });

            next();
        },

        registerRoutes: (app) => {
            app.get("/metrics", (req, res) => {
                res.json(metrics);
            });
        },
    };
});

Plugin.register(createMetricsPlugin());

// ============================================
// Example 5: Create Server and Retrieve Plugins
// ============================================
const app = createServer({
    server: {
        port: 3000,
    },
});

// Retrieve a plugin after server creation
const logger = Plugin.get("logger");
console.log(`Logger plugin: ${logger?.name}@${logger?.version}`);

// Start server
app.start(3000, () => {
    console.log("Server running with plugins:");
    console.log("- Logger ✓");
    console.log("- Database ✓");
    console.log("- Auth ✓");
    console.log("- Metrics ✓");
});

// ============================================
// Helper function (mock)
// ============================================
async function connectToDatabase(url: string) {
    return {
        findUser: async (username: string) => ({ id: 1, username }),
        disconnect: async () => {},
    };
}


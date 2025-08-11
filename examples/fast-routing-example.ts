/**
 * FastRouteHandler Example
 * 
 * This example demonstrates how to use the new FastRouteHandler
 * for high-performance routing that bypasses Express parsing.
 */

import { createServer } from "../src/server/ServerFactory";

// Create server with fast routing enabled
const app = createServer({
    server: {
        port: 3000,
        host: "localhost",
    },
    env: "development",
    logging: {
        enabled: true,
        level: "debug",
        components: {
            routing: true, // Enable routing logs
            server: true,
            performance: true,
        },
    },
});

// Wait for server to be ready
app.waitForReady().then(() => {
    console.log("🚀 Server is ready! Setting up fast routes...");

    // Example 1: Simple fast GET route
    app.fastGet("/api/hello", (req, res) => {
        res.json({ message: "Hello from FastRoute!", timestamp: Date.now() });
    });

    // Example 2: Fast POST route with options
    app.fastPost("/api/users", {
        cache: { ttl: 300 },
        security: { headers: { "X-Custom": "FastRoute" } }
    }, (req, res) => {
        const user = req.body;
        res.json({ 
            message: "User created via FastRoute", 
            user,
            id: Math.random().toString(36).substr(2, 9)
        });
    });

    // Example 3: Fast route with parameters
    app.fastGet("/api/users/:id", (req, res) => {
        const { id } = req.params;
        res.json({ 
            message: "User retrieved via FastRoute",
            userId: id,
            data: { name: `User ${id}`, email: `user${id}@example.com` }
        });
    });

    // Example 4: Fast PUT route
    app.fastPut("/api/users/:id", {
        cache: { ttl: 60 }
    }, (req, res) => {
        const { id } = req.params;
        const updates = req.body;
        res.json({ 
            message: "User updated via FastRoute",
            userId: id,
            updates
        });
    });

    // Example 5: Fast DELETE route
    app.fastDelete("/api/users/:id", (req, res) => {
        const { id } = req.params;
        res.json({ 
            message: "User deleted via FastRoute",
            userId: id,
            deleted: true
        });
    });

    // Example 6: Wildcard route
    app.fastGet("/api/files/*", (req, res) => {
        const filePath = req.params[0]; // Wildcard parameter
        res.json({ 
            message: "File accessed via FastRoute",
            path: filePath,
            exists: Math.random() > 0.5 // Simulate file existence
        });
    });

    // Regular Express routes for comparison
    app.get("/api/slow/hello", (req, res) => {
        res.json({ message: "Hello from Express route", timestamp: Date.now() });
    });

    // Route statistics endpoint
    app.fastGet("/api/stats/routes", (req, res) => {
        const stats = app.getFastRouteStats();
        res.json({
            message: "Fast route statistics",
            stats,
            timestamp: Date.now()
        });
    });

    // Performance comparison endpoint
    app.fastGet("/api/performance/test", (req, res) => {
        const start = process.hrtime.bigint();
        
        // Simulate some work
        const data = { 
            message: "Performance test via FastRoute",
            timestamp: Date.now(),
            random: Math.random()
        };
        
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // Convert to milliseconds
        
        res.json({
            ...data,
            processingTime: `${duration.toFixed(3)}ms`
        });
    });

    console.log("✅ Fast routes configured!");
    console.log("\n📊 Available endpoints:");
    console.log("  GET    /api/hello");
    console.log("  POST   /api/users");
    console.log("  GET    /api/users/:id");
    console.log("  PUT    /api/users/:id");
    console.log("  DELETE /api/users/:id");
    console.log("  GET    /api/files/*");
    console.log("  GET    /api/stats/routes");
    console.log("  GET    /api/performance/test");
    console.log("  GET    /api/slow/hello (Express route for comparison)");
    console.log("\n🔧 Management endpoints:");
    console.log("  Use app.clearFastRoutes() to clear all fast routes");
    console.log("  Use app.optimizeFastRoutes() to optimize route matching");
    console.log("  Use app.getFastRouteStats() to get statistics");
});

// Start the server
app.start(3000, () => {
    console.log("🌟 FastRoute Example Server started on http://localhost:3000");
    console.log("\n🧪 Try these commands:");
    console.log("  curl http://localhost:3000/api/hello");
    console.log("  curl -X POST http://localhost:3000/api/users -H 'Content-Type: application/json' -d '{\"name\":\"John\"}'");
    console.log("  curl http://localhost:3000/api/users/123");
    console.log("  curl http://localhost:3000/api/stats/routes");
    console.log("  curl http://localhost:3000/api/performance/test");
    console.log("\n⚡ Compare performance:");
    console.log("  Fast:  curl http://localhost:3000/api/performance/test");
    console.log("  Slow:  curl http://localhost:3000/api/slow/hello");
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down FastRoute example server...');
    process.exit(0);
});

// Export for testing
export { app };

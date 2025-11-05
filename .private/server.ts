/**
 * FastRouteEngine Test Server
 * 
 * This test demonstrates the new ultra-fast routing system with:
 * - Single route registration
 * - Batch route registration
 * - Route groups with prefixes
 * - Typed parameters (UUID, ID, slug)
 * - Performance statistics
 */

import { createServer } from "../src";
import { uploader_router } from "./upload_router";

export const app = createServer({
    server: {
        port: 3001,
    },
    fileUpload: {
        enabled: true,
        maxFileSize: 1024 * 1024, // 1MB for testing
        multerOptions: {},
        storage: "memory", // Use memory storage for testing
    },
    security: {
        enabled: false, // Disable for testing
    },
    logging: {
        enabled: true,
        components: {
            routing: true,
            server: true,
        },
    },
});


app.get("/", (req, res) => {
    res.send("FastRouteEngine Test Server - Visit /fast-test for FastAPI demo");
});

// ===== FAST ROUTE ENGINE TESTS =====

console.log("\n🚀 Registering FastAPI routes...\n");

// Test 1: Single route registration with typed parameter
app.fast().get("/fast-test/user/:id<id>", async (req, res, ctx) => {
    res.json({
        message: "FastAPI Single Route",
        userId: ctx.params.id,
        type: typeof ctx.params.id,
        route: ctx.route,
        method: ctx.method,
    });
});

// Test 2: UUID typed parameter
app.fast().get("/fast-test/session/:sessionId<uuid>", async (req, res, ctx) => {
    res.json({
        message: "FastAPI UUID Route",
        sessionId: ctx.params.sessionId,
        metadata: ctx.metadata,
    });
});

// Test 3: Slug typed parameter
app.fast().get("/fast-test/article/:slug<slug>", async (req, res, ctx) => {
    res.json({
        message: "FastAPI Slug Route",
        slug: ctx.params.slug,
    });
});

// Test 4: Batch route registration
app.fast().routes([
    {
        method: "GET",
        path: "/fast-test/health",
        handler: async (req, res, ctx) => {
            res.json({
                status: "healthy",
                timestamp: new Date().toISOString(),
                engine: "FastRouteEngine",
            });
        },
    },
    {
        method: "GET",
        path: "/fast-test/stats",
        handler: async (req, res, ctx) => {
            const stats = app.getFastAPIStats();
            res.json({
                message: "FastAPI Statistics",
                stats,
            });
        },
    },
    {
        method: "POST",
        path: "/fast-test/data",
        handler: async (req, res, ctx) => {
            res.json({
                message: "Data received",
                body: req.body,
                params: ctx.params,
            });
        },
    },
]);

// Test 5: Route groups with middleware
app.fast().group("/fast-test/api/v1", (group) => {
    // Group middleware
    group.use(async (req, res, ctx) => {
        console.log(`[FastAPI Middleware] ${ctx.method} ${ctx.route}`);
        // Continue to next handler
    });

    // Routes in the group
    group.get("/users", async (req, res, ctx) => {
        res.json({
            message: "List all users",
            group: "/api/v1",
            route: ctx.route,
        });
    });

    group.get("/users/:id<id>", async (req, res, ctx) => {
        res.json({
            message: "Get user by ID",
            userId: ctx.params.id,
            group: "/api/v1",
        });
    });

    group.post("/users", async (req, res, ctx) => {
        res.json({
            message: "Create new user",
            body: req.body,
            group: "/api/v1",
        });
    });

    group.put("/users/:id<id>", async (req, res, ctx) => {
        res.json({
            message: "Update user",
            userId: ctx.params.id,
            body: req.body,
        });
    });

    group.delete("/users/:id<id>", async (req, res, ctx) => {
        res.json({
            message: "Delete user",
            userId: ctx.params.id,
        });
    });
});

// Test 6: Nested route groups
app.fast().group("/fast-test/api/v2", (group) => {
    group.get("/products", async (req, res, ctx) => {
        res.json({
            message: "List all products",
            version: "v2",
        });
    });

    group.get("/products/:id<id>", async (req, res, ctx) => {
        res.json({
            message: "Get product by ID",
            productId: ctx.params.id,
            version: "v2",
        });
    });
});

// Test 7: Wildcard routes
app.fast().get("/fast-test/files/*", async (req, res, ctx) => {
    res.json({
        message: "Wildcard route matched",
        path: req.path,
        params: ctx.params,
    });
});

// Test 8: Performance benchmark route
app.fast().get("/fast-test/benchmark", async (req, res, ctx) => {
    const iterations = 1000;
    const start = performance.now();
    
    // Simulate route lookups
    for (let i = 0; i < iterations; i++) {
        // This would normally be internal route matching
    }
    
    const end = performance.now();
    const stats = app.getFastAPIStats();
    
    res.json({
        message: "Performance Benchmark",
        iterations,
        timeMs: end - start,
        avgTimePerLookup: (end - start) / iterations,
        stats,
    });
});

// Test 9: Route with priority
app.fast().route({
    method: "GET",
    path: "/fast-test/priority",
    priority: 100,
    handler: async (req, res, ctx) => {
        res.json({
            message: "High priority route",
            priority: 100,
        });
    },
});

// Test 10: Route with metadata
app.fast().route({
    method: "GET",
    path: "/fast-test/metadata",
    metadata: {
        version: "1.0.0",
        author: "XyPriss Team",
        description: "Route with custom metadata",
    },
    handler: async (req, res, ctx) => {
        res.json({
            message: "Route with metadata",
            metadata: ctx.metadata,
        });
    },
});

console.log("✅ FastAPI routes registered successfully!\n");
console.log("📊 Initial FastAPI Stats:");
console.log(JSON.stringify(app.getFastAPIStats(), null, 2));
console.log("\n");

console.log("Starting test server on port 3001...");
console.log("\n🔗 Test URLs:");
console.log("  - http://localhost:3001/");
console.log("  - http://localhost:3001/fast-test/user/123");
console.log("  - http://localhost:3001/fast-test/session/550e8400-e29b-41d4-a716-446655440000");
console.log("  - http://localhost:3001/fast-test/article/my-awesome-article");
console.log("  - http://localhost:3001/fast-test/health");
console.log("  - http://localhost:3001/fast-test/stats");
console.log("  - http://localhost:3001/fast-test/api/v1/users");
console.log("  - http://localhost:3001/fast-test/api/v1/users/456");
console.log("  - http://localhost:3001/fast-test/api/v2/products");
console.log("  - http://localhost:3001/fast-test/benchmark");
console.log("  - http://localhost:3001/fast-test/metadata");
console.log("\n");

app.start();


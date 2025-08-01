// Test both Route Optimization and Server Maintenance plugins

import { createServer } from "../mods/security/src/index";

// Create server with both plugins enabled
const app = createServer({
    server: {
        port: 3002,
        host: "localhost",
    },
    env: "development",

    // Plugin configuration
    plugins: {
        // Route Optimization Plugin
        routeOptimization: {
            enabled: true,
            analysisInterval: 30000, // 30 seconds for testing
            optimizationThreshold: 5, // Low threshold for testing
            popularityWindow: 300000, // 5 minutes
            maxTrackedRoutes: 100,
            autoOptimization: true,
            customRules: [
                {
                    pattern: "/api/*",
                    minHits: 3,
                    maxResponseTime: 500,
                    cacheStrategy: "aggressive",
                    preloadEnabled: true,
                },
                {
                    pattern: "/slow/*",
                    minHits: 2,
                    maxResponseTime: 1000,
                    cacheStrategy: "moderate",
                },
            ],
            onOptimization: (route, optimization) => {
                console.log(`🚀 Route optimized: ${route} -> ${optimization}`);
            },
            onAnalysis: (stats) => {
                console.log(
                    `📊 Analysis complete: ${stats.length} routes analyzed`
                );
                if (stats.length > 0) {
                    console.log(
                        `   Top route: ${stats[0].method} ${stats[0].path} (${stats[0].hitCount} hits)`
                    );
                }
            },
        },

        // Server Maintenance Plugin
        serverMaintenance: {
            enabled: true,
            checkInterval: 15000, // 15 seconds for testing
            errorThreshold: 10, // 10% error rate
            memoryThreshold: 70, // 70% memory usage
            responseTimeThreshold: 800, // 800ms response time
            logRetentionDays: 1, // 1 day for testing
            maxLogFileSize: 1024 * 1024, // 1MB
            autoCleanup: true,
            autoRestart: false,
            onIssueDetected: (issue) => {
                console.log(
                    `⚠️  Maintenance issue: ${issue.message} (severity: ${issue.severity})`
                );
            },
            onMaintenanceComplete: (actions) => {
                console.log(`🧹 Maintenance completed: ${actions.join(", ")}`);
            },
        },
    },
});

// Test routes for route optimization
app.get("/", (req, res) => {
    res.json({
        message: "Home page",
        timestamp: new Date(),
        hits: Math.floor(Math.random() * 100),
    });
});

app.get("/api/users", (req, res) => {
    // Simulate some processing time
    setTimeout(() => {
        res.json({
            users: [
                { id: 1, name: "Alice" },
                { id: 2, name: "Bob" },
                { id: 3, name: "Charlie" },
            ],
            timestamp: new Date(),
        });
    }, Math.random() * 200); // 0-200ms delay
});

app.get("/api/products", (req, res) => {
    // Simulate variable processing time
    setTimeout(() => {
        res.json({
            products: [
                { id: 1, name: "Laptop", price: 999 },
                { id: 2, name: "Phone", price: 599 },
                { id: 3, name: "Tablet", price: 399 },
            ],
            timestamp: new Date(),
        });
    }, Math.random() * 300); // 0-300ms delay
});

app.get("/slow/operation", (req, res) => {
    // Simulate slow operation
    setTimeout(() => {
        res.json({
            message: "Slow operation completed",
            timestamp: new Date(),
            processingTime: "2000ms",
        });
    }, 2000); // 2 second delay
});

app.get("/error-test", (req, res) => {
    // Randomly return errors to test error rate monitoring
    if (Math.random() < 0.3) {
        // 30% error rate
        res.status(500).json({
            error: "Simulated server error",
            timestamp: new Date(),
        });
    } else {
        res.json({
            message: "Success",
            timestamp: new Date(),
        });
    }
});

app.get("/memory-test", (req, res) => {
    // Create some memory usage for testing
    const largeArray = new Array(100000).fill("test data");

    res.json({
        message: "Memory test completed",
        arraySize: largeArray.length,
        memoryUsage: process.memoryUsage(),
        timestamp: new Date(),
    });
});

// Plugin status endpoint
app.get("/plugin-status", (req, res) => {
    const pluginManager = app.getServerPluginManager?.();
    const routePlugin = pluginManager?.getRouteOptimizationPlugin();
    const maintenancePlugin = pluginManager?.getServerMaintenancePlugin();

    const status = {
        timestamp: new Date(),
        plugins: {
            routeOptimization: {
                enabled: !!routePlugin,
                stats: routePlugin
                    ? {
                          trackedRoutes: routePlugin.getRouteStats().length,
                          optimizedRoutes:
                              routePlugin.getOptimizedRoutes().length,
                          topRoutes: routePlugin.getRouteStats().slice(0, 3),
                      }
                    : null,
            },
            serverMaintenance: {
                enabled: !!maintenancePlugin,
                health: maintenancePlugin
                    ? maintenancePlugin.getHealthMetrics()
                    : null,
                issues: maintenancePlugin
                    ? {
                          total: maintenancePlugin.getIssues().length,
                          unresolved:
                              maintenancePlugin.getUnresolvedIssues().length,
                          recent: maintenancePlugin
                              .getUnresolvedIssues()
                              .slice(-3),
                      }
                    : null,
            },
        },
    };

    res.json(status);
});

// Cache test endpoint to demonstrate caching optimization
app.get("/cache-test", (req, res) => {
    // Simulate some processing
    const data = {
        message: "This response should be cached after optimization",
        timestamp: new Date(),
        randomData: Array.from({ length: 100 }, () => Math.random()),
        processingTime: Math.random() * 500 + 200, // 200-700ms
    };

    setTimeout(() => {
        res.json(data);
    }, data.processingTime);
});

// Compression test endpoint
app.get("/compression-test", (req, res) => {
    // Generate large response to trigger compression
    const largeData = {
        message:
            "This is a large response that should trigger compression optimization",
        timestamp: new Date(),
        largeArray: Array.from({ length: 1000 }, (_, i) => ({
            id: i,
            name: `Item ${i}`,
            description: `This is a detailed description for item ${i} with lots of text to make the response larger`,
            metadata: {
                created: new Date(),
                tags: [`tag${i}`, `category${i % 10}`, `type${i % 5}`],
                properties: {
                    weight: Math.random() * 100,
                    size: Math.random() * 50,
                    color: ["red", "blue", "green", "yellow"][i % 4],
                },
            },
        })),
    };

    res.json(largeData);
});

// Force memory usage endpoint
app.get("/force-memory", (req, res) => {
    // Create memory pressure to test maintenance plugin
    const memoryHogs: any[] = [];
    for (let i = 0; i < 10; i++) {
        memoryHogs.push(
            new Array(100000).fill(`memory-test-${i}-${Date.now()}`)
        );
    }

    // Keep references to prevent immediate GC
    setTimeout(() => {
        memoryHogs.length = 0; // Clear after response
    }, 5000);

    res.json({
        message: "Memory pressure created",
        memoryUsage: process.memoryUsage(),
        timestamp: new Date(),
    });
});

// Start server
app.listen(() => {
    console.log("🚀 Plugin test server started!");
    console.log("");
    console.log("📋 Test endpoints:");
    console.log("  GET http://localhost:3002/              - Home page");
    console.log(
        "  GET http://localhost:3002/api/users     - API endpoint (fast)"
    );
    console.log(
        "  GET http://localhost:3002/api/products  - API endpoint (medium)"
    );
    console.log("  GET http://localhost:3002/slow/operation - Slow endpoint");
    console.log("  GET http://localhost:3002/error-test    - Error simulation");
    console.log(
        "  GET http://localhost:3002/memory-test   - Memory usage test"
    );
    console.log("  GET http://localhost:3002/plugin-status - Plugin status");
    console.log("");
    console.log("🧪 Plugin testing scenarios:");
    console.log("  1. Route Optimization:");
    console.log("     - Hit endpoints multiple times to trigger optimization");
    console.log("     - Check /plugin-status to see route statistics");
    console.log("     - Watch console for optimization messages");
    console.log("");
    console.log("  2. Server Maintenance:");
    console.log(
        "     - Hit /error-test multiple times to trigger error rate alerts"
    );
    console.log("     - Hit /memory-test to increase memory usage");
    console.log(
        "     - Watch console for maintenance issues and health checks"
    );
    console.log("");
    console.log("💡 Try these commands:");
    console.log("  # Generate traffic for route optimization");
    console.log(
        "  for i in {1..10}; do curl http://localhost:3002/api/users; done"
    );
    console.log("");
    console.log("  # Test error rate monitoring");
    console.log(
        "  for i in {1..20}; do curl http://localhost:3002/error-test; done"
    );
    console.log("");
    console.log("  # Check plugin status");
    console.log("  curl http://localhost:3002/plugin-status | jq");
});

export { app };


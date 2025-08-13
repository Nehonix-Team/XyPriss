/**
 * XyPriss Network Plugin System Example
 * 
 * Demonstrates how to use the new network plugin system for advanced
 * networking capabilities including connection management and optimization
 */

import { createServer } from "xypriss";
import { ConnectionPlugin, NetworkCategory } from "xypriss/plugins";

console.log("🚀 Starting XyPriss server with Network Plugin System...\n");

// Create server with network plugin configuration
const server = createServer({
    server: {
        port: 3000,
        host: "localhost",
    },
    // Network plugin configuration
    plugins: {
        network: {
            connection: {
                enabled: true,
                http2: {
                    enabled: true,
                    maxConcurrentStreams: 100
                },
                keepAlive: {
                    enabled: true,
                    timeout: 30000,
                    maxRequests: 1000
                },
                connectionPool: {
                    maxConnections: 1000,
                    timeout: 5000
                },
                timeouts: {
                    connection: 10000,
                    request: 30000,
                    response: 30000
                }
            }
        }
    },
    logging: {
        enabled: true,
        level: "info"
    }
});

// Test routes to demonstrate network plugin functionality
server.get("/", (req, res) => {
    res.json({
        message: "XyPriss Network Plugin System Demo",
        features: [
            "HTTP/2 Support",
            "Connection Pooling", 
            "Keep-Alive Management",
            "Connection Optimization",
            "Performance Monitoring"
        ],
        timestamp: new Date().toISOString()
    });
});

// Route to test connection reuse
server.get("/connection-info", (req, res) => {
    res.json({
        connection: {
            remoteAddress: req.ip,
            protocol: req.protocol,
            httpVersion: req.httpVersion,
            secure: req.secure,
            headers: {
                connection: req.get('connection'),
                keepAlive: req.get('keep-alive'),
                userAgent: req.get('user-agent')
            }
        },
        server: {
            nodeVersion: process.version,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage()
        },
        timestamp: new Date().toISOString()
    });
});

// Route to simulate load for testing connection pooling
server.get("/load-test", async (req, res) => {
    const iterations = parseInt(req.query.iterations) || 100;
    const delay = parseInt(req.query.delay) || 10;
    
    console.log(`🔄 Processing load test: ${iterations} iterations with ${delay}ms delay`);
    
    const results = [];
    for (let i = 0; i < iterations; i++) {
        await new Promise(resolve => setTimeout(resolve, delay));
        results.push({
            iteration: i + 1,
            timestamp: Date.now(),
            memoryUsage: process.memoryUsage().heapUsed
        });
    }
    
    res.json({
        message: "Load test completed",
        iterations,
        delay,
        results: results.slice(0, 10), // Return first 10 results
        totalResults: results.length,
        averageMemory: results.reduce((sum, r) => sum + r.memoryUsage, 0) / results.length,
        timestamp: new Date().toISOString()
    });
});

// Health check endpoint
server.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        networkPlugins: {
            connection: {
                enabled: true,
                category: NetworkCategory.CONNECTION,
                features: [
                    "HTTP/2 Support",
                    "Connection Pooling",
                    "Keep-Alive Management"
                ]
            }
        },
        performance: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
        },
        timestamp: new Date().toISOString()
    });
});

// Plugin status endpoint
server.get("/plugin-status", (req, res) => {
    // This would typically get actual plugin status from the plugin manager
    res.json({
        networkPlugins: {
            connection: {
                id: "xypriss.network.connection",
                name: "Connection Management Plugin",
                version: "1.0.0",
                category: NetworkCategory.CONNECTION,
                status: "active",
                health: "healthy",
                metrics: {
                    totalExecutions: 0,
                    averageExecutionTime: 0,
                    errorCount: 0,
                    activeConnections: 0
                }
            }
        },
        systemInfo: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            uptime: process.uptime()
        },
        timestamp: new Date().toISOString()
    });
});

// Start the server
server.start(undefined, () => {
    console.log(`✅ XyPriss server with Network Plugins running at http://localhost:${server.getPort()}`);
    console.log("\n📝 Available endpoints:");
    console.log("  GET  / - Main demo page");
    console.log("  GET  /connection-info - Connection information");
    console.log("  GET  /load-test?iterations=100&delay=10 - Load testing");
    console.log("  GET  /health - Health check");
    console.log("  GET  /plugin-status - Plugin status information");
    
    console.log("\n🔌 Active Network Plugins:");
    console.log("  ✅ ConnectionPlugin - HTTP/2, connection pooling, keep-alive");
    console.log("  🔄 ProxyPlugin - Coming soon");
    console.log("  🔄 CompressionPlugin - Coming soon");
    console.log("  🔄 RateLimitPlugin - Coming soon");
    
    console.log("\n🎯 Network Features:");
    console.log("  ✅ HTTP/2 Support (if enabled)");
    console.log("  ✅ Connection Pooling");
    console.log("  ✅ Keep-Alive Management");
    console.log("  ✅ Connection Optimization");
    console.log("  ✅ Performance Monitoring");
    
    console.log("\n💡 Try making multiple requests to test connection reuse!");
    console.log("💡 Use /load-test to simulate high load scenarios!");
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    console.log('🔌 Cleaning up network plugins...');
    process.exit(0);
});

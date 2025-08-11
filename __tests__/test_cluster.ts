#!/usr/bin/env bun

import { createServer } from "../index";
import { performance } from "perf_hooks";
import cluster from "cluster";
import os from "os";

/**
 * Comprehensive test for XyPriss cluster functionality and implemented TODOs
 */

async function testClusterFunctionality() {
    console.log("🚀 Starting XyPriss Cluster Functionality Test");
    console.log(
        `📊 System Info: ${os.cpus().length} CPUs, ${Math.round(
            os.totalmem() / 1024 / 1024 / 1024
        )}GB RAM`
    );

    if (cluster.isPrimary) {
        console.log(`🎯 Master Process PID: ${process.pid}`);

        // Create server with clustering enabled
        const app = createServer({
            server: {
                port: 8888,
                host: "localhost",
            },
            cluster: {
                enabled: true,
                config: {
                    workers: 2,
                },
            },
            cache: {
                enabled: true,
                strategy: "memory",
                maxSize: 100,
                ttl: 300,
            },
        });

        // Test implemented TODO methods
        await testImplementedMethods(app);

        // Setup test routes
        setupTestRoutes(app);

        // Start server
        await app.start();

        // Wait for workers to start
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Run cluster tests
        await runClusterTests();
    } else {
        console.log(
            `👷 Worker Process PID: ${process.pid}, Worker ID: ${cluster.worker?.id}`
        );
    }
}

async function testImplementedMethods(app: any) {
    console.log("\n🧪 Testing Implemented TODO Methods");

    try {
        // Test cache warmup
        console.log("📝 Testing cache warmup...");
        await app.warmUpCache([
            { key: "test1", value: "value1", ttl: 60 },
            { key: "test2", value: { data: "complex" }, ttl: 120 },
            { key: "test3", value: [1, 2, 3] },
        ]);

        // Test cache stats
        console.log("📊 Testing cache stats...");
        const stats = await app.getCacheStats();
        console.log("Cache Stats:", JSON.stringify(stats, null, 2));

        // Test cache invalidation
        console.log("🗑️ Testing cache invalidation...");
        await app.invalidateCache("test1");
        await app.invalidateCache("test*"); // Pattern-based

        // Test bulk route registration
        console.log("🛣️ Testing bulk route registration...");
        app.ultraRoutes([
            {
                method: "GET",
                path: "/bulk/test1",
                options: {},
                handler: (req: any, res: any) => res.json({ route: "bulk1" }),
            },
            {
                method: "POST",
                path: "/bulk/test2",
                options: {},
                handler: (req: any, res: any) => res.json({ route: "bulk2" }),
            },
        ]);

        // Test cached middleware
        console.log("💾 Testing cached middleware...");
        app.useCached((req: any, res: any, next: any) => {
            res.locals.cached = true;
            next();
        }, 60);

        // Test security enablement
        console.log("🔒 Testing security enablement...");
        app.enableSecurity({
            helmet: { contentSecurityPolicy: false },
            cors: { origin: "*" },
            rateLimit: { windowMs: 60000, max: 100 },
        });

        // Test request pre-compiler
        console.log("⚡ Testing request pre-compiler...");
        const preCompiler = app.getRequestPreCompiler();
        console.log("Pre-compiler stats:", preCompiler.getStats());

        console.log("✅ All TODO methods tested successfully");
    } catch (error) {
        console.error("❌ Error testing TODO methods:", error);
    }
}

function setupTestRoutes(app: any) {
    console.log("🛣️ Setting up test routes...");

    // Basic route
    app.get("/", (req: any, res: any) => {
        res.json({
            message: "Hello from XyPriss Cluster!",
            pid: process.pid,
            workerId: cluster.worker?.id || "master",
            timestamp: Date.now(),
        });
    });

    // CPU intensive route to test load balancing
    app.get("/cpu-intensive", (req: any, res: any) => {
        const start = performance.now();

        // Simulate CPU work
        let result = 0;
        for (let i = 0; i < 1000000; i++) {
            result += Math.sqrt(i);
        }

        const duration = performance.now() - start;

        res.json({
            message: "CPU intensive task completed",
            pid: process.pid,
            workerId: cluster.worker?.id || "master",
            duration: `${duration.toFixed(2)}ms`,
            result: Math.round(result),
            timestamp: Date.now(),
        });
    });

    // Memory usage route
    app.get("/memory", (req: any, res: any) => {
        const memUsage = process.memoryUsage();
        res.json({
            pid: process.pid,
            workerId: cluster.worker?.id || "master",
            memory: {
                rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
                heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
                heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
            },
            timestamp: Date.now(),
        });
    });

    // Cache test route
    app.get("/cache-test", async (req: any, res: any) => {
        const key = `cache-test-${Date.now()}`;
        const value = { data: "cached data", pid: process.pid };

        // Set cache
        if (app.cache) {
            await app.cache.set(key, value, { ttl: 30 });
            const retrieved = await app.cache.get(key);

            res.json({
                message: "Cache test",
                key,
                setValue: value,
                retrievedValue: retrieved,
                pid: process.pid,
                workerId: cluster.worker?.id || "master",
            });
        } else {
            res.json({ message: "Cache not available" });
        }
    });
}

async function runClusterTests() {
    console.log("\n🔬 Running Cluster Tests");

    const baseUrl = "http://localhost:8888";
    const testRequests = 20;
    const concurrentRequests = 5;

    try {
        // Test 1: Basic load distribution
        console.log("📊 Test 1: Basic Load Distribution");
        const responses: any[] = [];

        for (let i = 0; i < testRequests; i++) {
            try {
                const response = await fetch(`${baseUrl}/`);
                const data = await response.json();
                responses.push(data);

                if (i % 5 === 0) {
                    console.log(
                        `Request ${i + 1}: PID ${data.pid}, Worker ${
                            data.workerId
                        }`
                    );
                }
            } catch (error) {
                console.error(`Request ${i + 1} failed:`, error);
            }
        }

        // Analyze load distribution
        const pidCounts = responses.reduce((acc: any, resp) => {
            acc[resp.pid] = (acc[resp.pid] || 0) + 1;
            return acc;
        }, {});

        console.log("📈 Load Distribution Results:");
        Object.entries(pidCounts).forEach(([pid, count]) => {
            console.log(
                `  PID ${pid}: ${count} requests (${(
                    ((count as number) / responses.length) *
                    100
                ).toFixed(1)}%)`
            );
        });

        // Test 2: CPU intensive load balancing
        console.log("\n⚡ Test 2: CPU Intensive Load Balancing");
        const cpuPromises: Promise<any>[] = [];

        for (let i = 0; i < concurrentRequests; i++) {
            cpuPromises.push(
                fetch(`${baseUrl}/cpu-intensive`)
                    .then((res) => res.json())
                    .then((data) => {
                        console.log(
                            `CPU Task ${i + 1}: PID ${data.pid}, Duration ${
                                data.duration
                            }`
                        );
                        return data;
                    })
            );
        }

        const cpuResults = await Promise.all(cpuPromises);
        const avgDuration =
            cpuResults.reduce((sum, result) => {
                return sum + parseFloat(result.duration);
            }, 0) / cpuResults.length;

        console.log(
            `📊 Average CPU task duration: ${avgDuration.toFixed(2)}ms`
        );

        // Test 3: Memory usage across workers
        console.log("\n💾 Test 3: Memory Usage Across Workers");
        const memoryResponses: any[] = [];

        for (let i = 0; i < 10; i++) {
            try {
                const response = await fetch(`${baseUrl}/memory`);
                const data = await response.json();
                memoryResponses.push(data);
            } catch (error) {
                console.error(`Memory request ${i + 1} failed:`, error);
            }
        }

        const memoryByWorker = memoryResponses.reduce((acc: any, resp) => {
            if (!acc[resp.pid]) {
                acc[resp.pid] = [];
            }
            acc[resp.pid].push(resp.memory);
            return acc;
        }, {});

        console.log("📊 Memory Usage by Worker:");
        Object.entries(memoryByWorker).forEach(
            ([pid, memories]: [string, any[]]) => {
                const avgHeapUsed =
                    memories.reduce((sum, mem) => {
                        return sum + parseInt(mem.heapUsed);
                    }, 0) / memories.length;
                console.log(
                    `  PID ${pid}: Avg Heap Used ${avgHeapUsed.toFixed(1)}MB`
                );
            }
        );

        // Test 4: Cache functionality across workers
        console.log("\n💾 Test 4: Cache Functionality");
        for (let i = 0; i < 5; i++) {
            try {
                const response = await fetch(`${baseUrl}/cache-test`);
                const data = await response.json();
                console.log(
                    `Cache Test ${i + 1}: PID ${data.pid}, Key ${data.key}`
                );
            } catch (error) {
                console.error(`Cache test ${i + 1} failed:`, error);
            }
        }

        console.log("\n✅ Cluster tests completed successfully!");
    } catch (error) {
        console.error("❌ Cluster tests failed:", error);
    } finally {
        // Cleanup
        setTimeout(() => {
            console.log("🛑 Shutting down cluster test");
            process.exit(0);
        }, 2000);
    }
}

// Run the test
testClusterFunctionality().catch(console.error);


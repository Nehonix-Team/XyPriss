#!/usr/bin/env bun

import { createServer } from "../index";
import cluster from "cluster";
import os from "os";

/**
 * Simple cluster test with lower memory requirements
 */

async function testClusterSimple() {
    console.log("🚀 Starting Simple XyPriss Cluster Test");
    console.log(`📊 System Info: ${os.cpus().length} CPUs, ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB RAM`);
    
    if (cluster.isPrimary) {
        console.log(`🎯 Master Process PID: ${process.pid}`);
        
        // Create server with minimal clustering (1 worker to test functionality)
        const app = createServer({
            server: { 
                port: 8889,
                host: "localhost"
            },
            cluster: { 
                enabled: true,
                config: {
                    workers: 1, // Use only 1 worker to reduce memory usage
                    resources: {
                        maxMemoryPerWorker: "128MB", // Reduce memory per worker
                        maxCpuPerWorker: 50
                    }
                }
            },
            cache: {
                enabled: true,
                strategy: "memory",
                maxSize: 50, // Smaller cache
                ttl: 60
            }
        });

        // Test implemented TODO methods quickly
        await testTODOMethods(app);

        // Setup simple test routes
        setupSimpleRoutes(app);

        // Start server
        await app.start();
        
        // Wait for workers to start
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Run simple cluster tests
        await runSimpleClusterTests();
        
    } else {
        console.log(`👷 Worker Process PID: ${process.pid}, Worker ID: ${cluster.worker?.id}`);
    }
}

async function testTODOMethods(app: any) {
    console.log("\n🧪 Testing Implemented TODO Methods (Quick)");
    
    try {
        // Test cache warmup with minimal data
        await app.warmUpCache([
            { key: "test1", value: "value1", ttl: 30 }
        ]);
        
        // Test cache stats
        const stats = await app.getCacheStats();
        console.log("✅ Cache stats retrieved");
        
        // Test cache invalidation
        await app.invalidateCache("test1");
        console.log("✅ Cache invalidation tested");
        
        // Test bulk route registration
        app.ultraRoutes([
            {
                method: "GET",
                path: "/bulk/test",
                options: {},
                handler: (req: any, res: any) => res.json({ route: "bulk" })
            }
        ]);
        console.log("✅ Bulk route registration tested");
        
        // Test security enablement
        app.enableSecurity();
        console.log("✅ Security enablement tested");
        
        console.log("✅ All TODO methods tested successfully");
        
    } catch (error) {
        console.error("❌ Error testing TODO methods:", error);
    }
}

function setupSimpleRoutes(app: any) {
    console.log("🛣️ Setting up simple test routes...");
    
    // Basic route
    app.get("/", (req: any, res: any) => {
        res.json({ 
            message: "Hello from XyPriss!",
            pid: process.pid,
            workerId: cluster.worker?.id || "master",
            timestamp: Date.now()
        });
    });
    
    // Worker identification route
    app.get("/worker-info", (req: any, res: any) => {
        res.json({
            pid: process.pid,
            workerId: cluster.worker?.id || "master",
            isWorker: cluster.isWorker,
            isMaster: cluster.isPrimary,
            timestamp: Date.now()
        });
    });
    
    // Simple cache test
    app.get("/cache-test", async (req: any, res: any) => {
        if (app.cache) {
            const key = `test-${Date.now()}`;
            const value = { pid: process.pid, data: "cached" };
            
            await app.cache.set(key, value, { ttl: 30 });
            const retrieved = await app.cache.get(key);
            
            res.json({
                message: "Cache working",
                key,
                setValue: value,
                retrievedValue: retrieved
            });
        } else {
            res.json({ message: "Cache not available" });
        }
    });
}

async function runSimpleClusterTests() {
    console.log("\n🔬 Running Simple Cluster Tests");
    
    const baseUrl = "http://localhost:8889";
    
    try {
        // Test 1: Basic functionality
        console.log("📊 Test 1: Basic Server Response");
        
        for (let i = 0; i < 5; i++) {
            try {
                const response = await fetch(`${baseUrl}/`);
                const data = await response.json();
                console.log(`Request ${i + 1}: PID ${data.pid}, Worker ${data.workerId}`);
            } catch (error) {
                console.error(`Request ${i + 1} failed:`, error);
            }
        }
        
        // Test 2: Worker information
        console.log("\n📊 Test 2: Worker Information");
        
        for (let i = 0; i < 3; i++) {
            try {
                const response = await fetch(`${baseUrl}/worker-info`);
                const data = await response.json();
                console.log(`Worker Info ${i + 1}:`, {
                    pid: data.pid,
                    workerId: data.workerId,
                    isWorker: data.isWorker,
                    isMaster: data.isMaster
                });
            } catch (error) {
                console.error(`Worker info request ${i + 1} failed:`, error);
            }
        }
        
        // Test 3: Cache functionality
        console.log("\n📊 Test 3: Cache Functionality");
        
        for (let i = 0; i < 3; i++) {
            try {
                const response = await fetch(`${baseUrl}/cache-test`);
                const data = await response.json();
                console.log(`Cache Test ${i + 1}: ${data.message}, Key: ${data.key}`);
            } catch (error) {
                console.error(`Cache test ${i + 1} failed:`, error);
            }
        }
        
        // Test 4: Bulk route
        console.log("\n📊 Test 4: Bulk Route Test");
        
        try {
            const response = await fetch(`${baseUrl}/bulk/test`);
            const data = await response.json();
            console.log("Bulk route response:", data);
        } catch (error) {
            console.error("Bulk route test failed:", error);
        }
        
        console.log("\n✅ Simple cluster tests completed!");
        
    } catch (error) {
        console.error("❌ Cluster tests failed:", error);
    } finally {
        // Cleanup
        setTimeout(() => {
            console.log("🛑 Shutting down simple cluster test");
            process.exit(0);
        }, 2000);
    }
}

// Run the test
testClusterSimple().catch(console.error);

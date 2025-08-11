#!/usr/bin/env bun

import { createServer } from "../index";

/**
 * Test WorkerPoolComponent integration with XyPriss server
 */

async function testWorkerPoolIntegration() {
    console.log("🚀 Starting WorkerPool Integration Test");
    
    try {
        // Create server with worker pool enabled
        const app = createServer({
            server: { 
                port: 8890,
                host: "localhost"
            },
            workerPool: { 
                enabled: true,
                config: {
                    cpu: {
                        min: 1,
                        max: 2
                    },
                    io: {
                        min: 1,
                        max: 2
                    },
                    maxConcurrentTasks: 10
                }
            },
            cache: {
                enabled: true,
                strategy: "memory",
                maxSize: 50,
                ttl: 60
            }
        });

        console.log("✅ Server created with WorkerPool configuration");

        // Setup test routes that use worker pool
        setupWorkerPoolRoutes(app);

        // Start server
        await app.start();
        console.log("✅ Server started successfully");
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test worker pool functionality
        await testWorkerPoolFunctionality();
        
    } catch (error) {
        console.error("❌ WorkerPool integration test failed:", error);
    } finally {
        // Cleanup
        setTimeout(() => {
            console.log("🛑 Shutting down WorkerPool test");
            process.exit(0);
        }, 2000);
    }
}

function setupWorkerPoolRoutes(app: any) {
    console.log("🛣️ Setting up WorkerPool test routes...");
    
    // Basic route to check server
    app.get("/", (req: any, res: any) => {
        res.json({ 
            message: "WorkerPool Test Server",
            timestamp: Date.now()
        });
    });
    
    // Route to check if worker pool is available
    app.get("/worker-pool/status", (req: any, res: any) => {
        const isEnabled = app.isWorkerPoolEnabled ? app.isWorkerPoolEnabled() : false;
        const stats = app.getWorkerPoolStats ? app.getWorkerPoolStats() : null;
        
        res.json({
            message: "WorkerPool status",
            enabled: isEnabled,
            stats: stats,
            timestamp: Date.now()
        });
    });
    
    // Route to test CPU task execution
    app.get("/worker-pool/cpu-task", (req: any, res: any) => {
        try {
            if (app.executeCPUTask) {
                const taskData = {
                    method: req.method,
                    path: req.path,
                    query: req.query,
                    body: req.body,
                    headers: req.headers
                };
                
                app.executeCPUTask(taskData, 1);
                
                res.json({
                    message: "CPU task submitted to worker pool",
                    taskData: taskData,
                    timestamp: Date.now()
                });
            } else {
                res.status(503).json({
                    error: "WorkerPool CPU task execution not available",
                    timestamp: Date.now()
                });
            }
        } catch (error: any) {
            res.status(500).json({
                error: "Failed to execute CPU task",
                details: error.message,
                timestamp: Date.now()
            });
        }
    });
    
    // Route to test I/O task execution
    app.get("/worker-pool/io-task", (req: any, res: any) => {
        try {
            if (app.executeIOTask) {
                const taskData = {
                    method: req.method,
                    path: req.path,
                    query: req.query,
                    body: req.body,
                    headers: req.headers
                };
                
                app.executeIOTask(taskData, 1);
                
                res.json({
                    message: "I/O task submitted to worker pool",
                    taskData: taskData,
                    timestamp: Date.now()
                });
            } else {
                res.status(503).json({
                    error: "WorkerPool I/O task execution not available",
                    timestamp: Date.now()
                });
            }
        } catch (error: any) {
            res.status(500).json({
                error: "Failed to execute I/O task",
                details: error.message,
                timestamp: Date.now()
            });
        }
    });
    
    // Route to get worker pool statistics
    app.get("/worker-pool/stats", (req: any, res: any) => {
        try {
            const stats = app.getWorkerPoolStats ? app.getWorkerPoolStats() : null;
            
            res.json({
                message: "WorkerPool statistics",
                stats: stats,
                timestamp: Date.now()
            });
        } catch (error: any) {
            res.status(500).json({
                error: "Failed to get worker pool stats",
                details: error.message,
                timestamp: Date.now()
            });
        }
    });
}

async function testWorkerPoolFunctionality() {
    console.log("\n🔬 Testing WorkerPool Functionality");
    
    const baseUrl = "http://localhost:8890";
    
    try {
        // Test 1: Basic server response
        console.log("📊 Test 1: Basic Server Response");
        const response1 = await fetch(`${baseUrl}/`);
        const data1 = await response1.json();
        console.log("✅ Basic response:", data1.message);
        
        // Test 2: Worker pool status
        console.log("\n📊 Test 2: WorkerPool Status");
        const response2 = await fetch(`${baseUrl}/worker-pool/status`);
        const data2 = await response2.json();
        console.log("✅ WorkerPool enabled:", data2.enabled);
        console.log("✅ WorkerPool stats:", JSON.stringify(data2.stats, null, 2));
        
        // Test 3: CPU task execution
        console.log("\n📊 Test 3: CPU Task Execution");
        const response3 = await fetch(`${baseUrl}/worker-pool/cpu-task`);
        const data3 = await response3.json();
        console.log("✅ CPU task response:", data3.message);
        
        // Test 4: I/O task execution
        console.log("\n📊 Test 4: I/O Task Execution");
        const response4 = await fetch(`${baseUrl}/worker-pool/io-task`);
        const data4 = await response4.json();
        console.log("✅ I/O task response:", data4.message);
        
        // Test 5: Worker pool statistics
        console.log("\n📊 Test 5: WorkerPool Statistics");
        const response5 = await fetch(`${baseUrl}/worker-pool/stats`);
        const data5 = await response5.json();
        console.log("✅ WorkerPool stats:", JSON.stringify(data5.stats, null, 2));
        
        console.log("\n✅ All WorkerPool functionality tests completed!");
        
    } catch (error) {
        console.error("❌ WorkerPool functionality tests failed:", error);
    }
}

// Run the test
testWorkerPoolIntegration().catch(console.error);

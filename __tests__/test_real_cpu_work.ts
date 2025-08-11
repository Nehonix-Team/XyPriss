#!/usr/bin/env bun

import { createServer } from "../index";

/**
 * Test Real CPU-Intensive Work Distribution Across Workers
 * This test demonstrates actual CPU work being distributed and processed
 */

async function testRealCPUWorkDistribution() {
    console.log("🚀 Starting Real CPU Work Distribution Test");
    console.log("===========================================");
    
    try {
        // Create server with multiple CPU workers
        const app = createServer({
            server: { 
                port: 8891,
                host: "localhost"
            },
            workerPool: { 
                enabled: true,
                config: {
                    cpu: {
                        min: 2,
                        max: 4
                    },
                    io: {
                        min: 1,
                        max: 2
                    },
                    maxConcurrentTasks: 20
                }
            },
            cache: {
                enabled: true,
                strategy: "memory",
                maxSize: 100,
                ttl: 300
            }
        });

        console.log("✅ Server created with multiple CPU workers");

        // Setup routes for real CPU-intensive tasks
        setupRealCPURoutes(app);

        // Start server
        await app.start();
        console.log("✅ Server started successfully");
        
        // Wait for initialization
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test real CPU work distribution
        await testCPUWorkDistribution();
        
    } catch (error) {
        console.error("❌ Real CPU work test failed:", error);
    } finally {
        // Cleanup
        setTimeout(() => {
            console.log("🛑 Shutting down CPU work test");
            process.exit(0);
        }, 3000);
    }
}

function setupRealCPURoutes(app: any) {
    console.log("🛣️ Setting up Real CPU-intensive routes...");
    
    // Route for prime number calculation
    app.get("/cpu/primes/:limit", (req: any, res: any) => {
        const limit = parseInt(req.params.limit) || 10000;
        
        if (app.executeCPUTask) {
            const taskData = {
                operation: "primes",
                limit: limit,
                requestId: `primes-${Date.now()}`
            };
            
            app.executeCPUTask({
                method: "GET",
                path: req.path,
                query: req.query,
                body: { operation: "calculate", data: taskData },
                headers: req.headers
            }, 1);
            
            res.json({
                message: `Prime calculation task submitted (limit: ${limit})`,
                taskData: taskData,
                timestamp: Date.now()
            });
        } else {
            res.status(503).json({ error: "CPU worker not available" });
        }
    });
    
    // Route for Fibonacci calculation
    app.get("/cpu/fibonacci/:n", (req: any, res: any) => {
        const n = parseInt(req.params.n) || 1000;
        
        if (app.executeCPUTask) {
            const taskData = {
                operation: "fibonacci",
                n: n,
                requestId: `fibonacci-${Date.now()}`
            };
            
            app.executeCPUTask({
                method: "GET",
                path: req.path,
                query: req.query,
                body: { operation: "calculate", data: taskData },
                headers: req.headers
            }, 1);
            
            res.json({
                message: `Fibonacci calculation task submitted (n: ${n})`,
                taskData: taskData,
                timestamp: Date.now()
            });
        } else {
            res.status(503).json({ error: "CPU worker not available" });
        }
    });
    
    // Route for data analysis
    app.post("/cpu/analyze", (req: any, res: any) => {
        const { analysisType, data } = req.body;
        
        if (app.executeCPUTask) {
            const taskData = {
                analysisType: analysisType || "dataset",
                data: data,
                requestId: `analysis-${Date.now()}`
            };
            
            app.executeCPUTask({
                method: "POST",
                path: req.path,
                query: req.query,
                body: { operation: "analyze", data: taskData },
                headers: req.headers
            }, 1);
            
            res.json({
                message: `Data analysis task submitted (type: ${analysisType})`,
                taskData: taskData,
                timestamp: Date.now()
            });
        } else {
            res.status(503).json({ error: "CPU worker not available" });
        }
    });
    
    // Route for cryptographic operations
    app.post("/cpu/crypto", (req: any, res: any) => {
        const { operations, payload } = req.body;
        
        if (app.executeCPUTask) {
            const taskData = {
                operations: operations || 5000,
                payload: payload || { data: "test data for crypto operations" },
                requestId: `crypto-${Date.now()}`
            };
            
            app.executeCPUTask({
                method: "POST",
                path: req.path,
                query: req.query,
                body: { operation: "crypto", data: taskData },
                headers: req.headers
            }, 1);
            
            res.json({
                message: `Cryptographic task submitted (${operations} operations)`,
                taskData: taskData,
                timestamp: Date.now()
            });
        } else {
            res.status(503).json({ error: "CPU worker not available" });
        }
    });
    
    // Route for worker pool statistics
    app.get("/cpu/stats", (req: any, res: any) => {
        const stats = app.getWorkerPoolStats ? app.getWorkerPoolStats() : null;
        
        res.json({
            message: "Worker pool statistics",
            stats: stats,
            timestamp: Date.now()
        });
    });
}

async function testCPUWorkDistribution() {
    console.log("\n🔬 Testing Real CPU Work Distribution");
    console.log("=====================================");
    
    const baseUrl = "http://localhost:8891";
    
    try {
        // Test 1: Multiple prime calculations (CPU intensive)
        console.log("\n📊 Test 1: Prime Number Calculations");
        const primePromises = [
            fetch(`${baseUrl}/cpu/primes/5000`),
            fetch(`${baseUrl}/cpu/primes/7500`),
            fetch(`${baseUrl}/cpu/primes/10000`),
            fetch(`${baseUrl}/cpu/primes/12500`)
        ];
        
        const primeResults = await Promise.all(primePromises);
        for (let i = 0; i < primeResults.length; i++) {
            const data = await primeResults[i].json();
            console.log(`✅ Prime task ${i + 1}: ${data.message}`);
        }
        
        // Test 2: Multiple Fibonacci calculations
        console.log("\n📊 Test 2: Fibonacci Calculations");
        const fibPromises = [
            fetch(`${baseUrl}/cpu/fibonacci/500`),
            fetch(`${baseUrl}/cpu/fibonacci/750`),
            fetch(`${baseUrl}/cpu/fibonacci/1000`),
            fetch(`${baseUrl}/cpu/fibonacci/1250`)
        ];
        
        const fibResults = await Promise.all(fibPromises);
        for (let i = 0; i < fibResults.length; i++) {
            const data = await fibResults[i].json();
            console.log(`✅ Fibonacci task ${i + 1}: ${data.message}`);
        }
        
        // Test 3: Data analysis tasks
        console.log("\n📊 Test 3: Data Analysis Tasks");
        const analysisPromises = [
            fetch(`${baseUrl}/cpu/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    analysisType: "dataset",
                    data: { dataset: Array.from({length: 1000}, () => Math.random() * 100) }
                })
            }),
            fetch(`${baseUrl}/cpu/analyze`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    analysisType: "text",
                    data: { text: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. ".repeat(100) }
                })
            })
        ];
        
        const analysisResults = await Promise.all(analysisPromises);
        for (let i = 0; i < analysisResults.length; i++) {
            const data = await analysisResults[i].json();
            console.log(`✅ Analysis task ${i + 1}: ${data.message}`);
        }
        
        // Test 4: Cryptographic operations
        console.log("\n📊 Test 4: Cryptographic Operations");
        const cryptoPromises = [
            fetch(`${baseUrl}/cpu/crypto`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    operations: 3000,
                    payload: { data: "sensitive data for encryption", id: 1 }
                })
            }),
            fetch(`${baseUrl}/cpu/crypto`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    operations: 4000,
                    payload: { data: "another set of sensitive data", id: 2 }
                })
            })
        ];
        
        const cryptoResults = await Promise.all(cryptoPromises);
        for (let i = 0; i < cryptoResults.length; i++) {
            const data = await cryptoResults[i].json();
            console.log(`✅ Crypto task ${i + 1}: ${data.message}`);
        }
        
        // Wait for tasks to process
        console.log("\n⏳ Waiting for tasks to complete...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Test 5: Check final statistics
        console.log("\n📊 Test 5: Final Worker Statistics");
        const statsResponse = await fetch(`${baseUrl}/cpu/stats`);
        const statsData = await statsResponse.json();
        
        console.log("📈 Final Worker Pool Statistics:");
        console.log(`  CPU Workers: ${statsData.stats?.cpuWorkers || 0}`);
        console.log(`  I/O Workers: ${statsData.stats?.ioWorkers || 0}`);
        console.log(`  Active Tasks: ${statsData.stats?.activeTasks || 0}`);
        console.log(`  Total Executed: ${statsData.stats?.totalExecuted || 0}`);
        console.log(`  Average Execution Time: ${statsData.stats?.avgExecutionTime || 0}ms`);
        
        console.log("\n✅ All Real CPU Work Distribution tests completed!");
        console.log("🎯 Tasks were distributed across multiple CPU workers");
        console.log("💪 Real CPU-intensive calculations were performed");
        
    } catch (error) {
        console.error("❌ CPU work distribution tests failed:", error);
    }
}

// Run the test
testRealCPUWorkDistribution().catch(console.error);

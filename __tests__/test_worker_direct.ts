#!/usr/bin/env bun

/**
 * Test worker processes directly to verify cluster load balancing
 */

async function testWorkerDirect() {
    console.log("🚀 Testing Worker Processes Directly");
    
    const masterPort = 8889;
    const workerPort = 9030; // From the cluster test output
    
    console.log("\n📊 Testing Master Process (Load Balancer)");
    
    // Test master process
    for (let i = 0; i < 5; i++) {
        try {
            const response = await fetch(`http://localhost:${masterPort}/worker-info`);
            const data = await response.json();
            console.log(`Master Request ${i + 1}:`, {
                pid: data.pid,
                workerId: data.workerId,
                isMaster: data.isMaster
            });
        } catch (error) {
            console.error(`Master request ${i + 1} failed:`, error);
        }
    }
    
    console.log("\n📊 Testing Worker Process Directly");
    
    // Test worker process directly
    for (let i = 0; i < 5; i++) {
        try {
            const response = await fetch(`http://localhost:${workerPort}/worker-info`);
            const data = await response.json();
            console.log(`Worker Request ${i + 1}:`, {
                pid: data.pid,
                workerId: data.workerId,
                isWorker: data.isWorker
            });
        } catch (error) {
            console.error(`Worker request ${i + 1} failed:`, error);
        }
    }
    
    console.log("\n📊 Load Distribution Test");
    
    // Test load distribution by making many requests to master
    const responses: any[] = [];
    
    for (let i = 0; i < 20; i++) {
        try {
            const response = await fetch(`http://localhost:${masterPort}/`);
            const data = await response.json();
            responses.push(data);
        } catch (error) {
            console.error(`Load test request ${i + 1} failed:`, error);
        }
    }
    
    // Analyze distribution
    const pidCounts = responses.reduce((acc: any, resp) => {
        acc[resp.pid] = (acc[resp.pid] || 0) + 1;
        return acc;
    }, {});
    
    console.log("📈 Load Distribution Results:");
    Object.entries(pidCounts).forEach(([pid, count]) => {
        console.log(`  PID ${pid}: ${count} requests (${((count as number / responses.length) * 100).toFixed(1)}%)`);
    });
    
    console.log("\n✅ Worker direct test completed!");
}

// Run the test
testWorkerDirect().catch(console.error);

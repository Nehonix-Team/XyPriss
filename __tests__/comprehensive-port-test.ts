import { createServer } from "../integrations/express/ServerFactory";

console.log("🧪 Comprehensive Port Switch Test");
console.log("=================================");

async function comprehensiveTest() {
    const testPort = 8097;
    
    console.log(`\n🔧 Test 1: Creating first server on port ${testPort}...`);
    
    // Create first server
    const server1 = createServer({
        logging: { enabled: true, level: "debug" }
    });
    
    server1.get("/server1", (req, res) => {
        res.json({ 
            message: "Server 1", 
            port: server1.getPort(),
            serverInstance: "server1"
        });
    });
    
    await new Promise<void>((resolve) => {
        server1.start(testPort, () => {
            console.log(`✅ Server 1 started on port ${server1.getPort()}`);
            resolve();
        });
    });
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`\n🔧 Test 2: Creating second server with auto port switch...`);
    
    // Create second server with auto port switch
    const server2 = createServer({
        server: {
            autoPortSwitch: {
                enabled: true,
                maxAttempts: 3,
                strategy: "increment",
                onPortSwitch(originalPort, newPort) {
                    console.log(`🔄 Server 2 port switch callback: ${originalPort} → ${newPort}`);
                },
            },
        },
        logging: { enabled: true, level: "debug" }
    });
    
    server2.get("/server2", (req, res) => {
        res.json({ 
            message: "Server 2", 
            port: server2.getPort(),
            serverInstance: "server2",
            originalRequestedPort: testPort
        });
    });
    
    await new Promise<void>((resolve) => {
        server2.start(testPort, () => {
            console.log(`✅ Server 2 started on port ${server2.getPort()}`);
            resolve();
        });
    });
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`\n🧪 Test 3: Checking actual port usage...`);
    console.log(`Server 1 reports port: ${server1.getPort()}`);
    console.log(`Server 2 reports port: ${server2.getPort()}`);
    
    // Test both servers with HTTP requests
    const http = require('http');
    
    console.log(`\n🧪 Test 4: Testing HTTP responses...`);
    
    // Test server 1
    try {
        console.log(`Testing server 1 on port ${server1.getPort()}...`);
        const response1 = await new Promise<string>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: server1.getPort(),
                path: '/server1',
                method: 'GET'
            }, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.setTimeout(5000, () => reject(new Error('Request timeout')));
            req.end();
        });
        console.log("📡 Server 1 response:", JSON.parse(response1));
    } catch (err) {
        console.log("❌ Server 1 test failed:", err);
    }
    
    // Test server 2
    try {
        console.log(`Testing server 2 on port ${server2.getPort()}...`);
        const response2 = await new Promise<string>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: server2.getPort(),
                path: '/server2',
                method: 'GET'
            }, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.setTimeout(5000, () => reject(new Error('Request timeout')));
            req.end();
        });
        console.log("📡 Server 2 response:", JSON.parse(response2));
    } catch (err) {
        console.log("❌ Server 2 test failed:", err);
    }
    
    // Test cross-server requests to see if they're actually different
    console.log(`\n🧪 Test 5: Cross-testing servers...`);
    
    // Try to access server1 endpoint on server2 port
    try {
        console.log(`Testing /server1 on server 2's port ${server2.getPort()}...`);
        const crossResponse1 = await new Promise<string>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: server2.getPort(),
                path: '/server1',
                method: 'GET'
            }, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.setTimeout(5000, () => reject(new Error('Request timeout')));
            req.end();
        });
        console.log("📡 Cross-test 1 response:", crossResponse1.substring(0, 100) + "...");
    } catch (err) {
        console.log("✅ Cross-test 1 correctly failed (servers are separate):", err.message);
    }
    
    // Try to access server2 endpoint on server1 port
    try {
        console.log(`Testing /server2 on server 1's port ${server1.getPort()}...`);
        const crossResponse2 = await new Promise<string>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: server1.getPort(),
                path: '/server2',
                method: 'GET'
            }, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.setTimeout(5000, () => reject(new Error('Request timeout')));
            req.end();
        });
        console.log("📡 Cross-test 2 response:", crossResponse2.substring(0, 100) + "...");
    } catch (err) {
        console.log("✅ Cross-test 2 correctly failed (servers are separate):", err.message);
    }
    
    console.log(`\n✅ Comprehensive test completed!`);
    
    // Cleanup
    setTimeout(() => {
        process.exit(0);
    }, 2000);
}

// Run the test
comprehensiveTest().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});

// Handle cleanup
process.on('SIGINT', () => {
    console.log("\n🧹 Cleaning up...");
    process.exit(0);
});

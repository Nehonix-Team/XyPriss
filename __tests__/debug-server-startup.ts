import { createServer } from "../integrations/express/ServerFactory";

console.log("🧪 Debug Server Startup Process");
console.log("===============================");

async function debugServerStartup() {
    const testPort = 8096;
    
    console.log(`\n🔧 Step 1: Starting first server on port ${testPort}...`);
    
    // Create first server
    const server1 = createServer({
        logging: { enabled: true, level: "debug" }
    });
    
    server1.get("/debug1", (req, res) => {
        res.json({ 
            message: "Debug Server 1", 
            port: server1.getPort(),
            timestamp: Date.now()
        });
    });
    
    await new Promise<void>((resolve, reject) => {
        console.log("🔧 Calling server1.start()...");
        server1.start(testPort, () => {
            console.log(`✅ Server 1 callback executed - port: ${server1.getPort()}`);
            resolve();
        });
        
        // Add timeout to detect hanging
        setTimeout(() => {
            reject(new Error("Server 1 start timeout"));
        }, 10000);
    });
    
    // Wait and verify server 1 is working
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`\n🧪 Step 2: Verifying server 1 is working...`);
    const http = require('http');
    
    try {
        const response1 = await new Promise<string>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: testPort,
                path: '/debug1',
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
        console.log("📡 Server 1 verification:", JSON.parse(response1));
    } catch (err) {
        console.log("❌ Server 1 verification failed:", err);
        return;
    }
    
    console.log(`\n🔧 Step 3: Starting second server with detailed logging...`);
    
    // Create second server with auto port switch and detailed logging
    const server2 = createServer({
        server: {
            autoPortSwitch: {
                enabled: true,
                maxAttempts: 3,
                strategy: "increment",
                onPortSwitch(originalPort, newPort) {
                    console.log(`🔄 [CALLBACK] Port switch: ${originalPort} → ${newPort}`);
                },
            },
        },
        logging: { enabled: true, level: "debug" }
    });
    
    server2.get("/debug2", (req, res) => {
        res.json({ 
            message: "Debug Server 2", 
            port: server2.getPort(),
            timestamp: Date.now()
        });
    });
    
    console.log("🔧 About to call server2.start()...");
    
    try {
        await new Promise<void>((resolve, reject) => {
            let callbackExecuted = false;
            
            const timeout = setTimeout(() => {
                if (!callbackExecuted) {
                    reject(new Error("Server 2 start timeout - callback never executed"));
                }
            }, 15000);
            
            server2.start(testPort, () => {
                callbackExecuted = true;
                clearTimeout(timeout);
                console.log(`✅ Server 2 callback executed - port: ${server2.getPort()}`);
                resolve();
            });
        });
        
        console.log(`\n🧪 Step 4: Verifying both servers...`);
        console.log(`Server 1 reports port: ${server1.getPort()}`);
        console.log(`Server 2 reports port: ${server2.getPort()}`);
        
        // Test server 2
        try {
            const response2 = await new Promise<string>((resolve, reject) => {
                const req = http.request({
                    hostname: 'localhost',
                    port: server2.getPort(),
                    path: '/debug2',
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
            console.log("📡 Server 2 verification:", JSON.parse(response2));
        } catch (err) {
            console.log("❌ Server 2 verification failed:", err);
        }
        
        // Test if servers are actually on different ports
        if (server1.getPort() !== server2.getPort()) {
            console.log("✅ Servers are on different ports - port switching worked!");
        } else {
            console.log("❌ Servers report same port - port switching failed!");
            
            // Try to access server2 endpoint on server1 port
            try {
                const crossTest = await new Promise<string>((resolve, reject) => {
                    const req = http.request({
                        hostname: 'localhost',
                        port: server1.getPort(),
                        path: '/debug2',
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
                console.log("🔍 Cross-test result:", crossTest.substring(0, 100));
            } catch (err) {
                console.log("🔍 Cross-test failed (expected):", err.message);
            }
        }
        
    } catch (error) {
        console.error("❌ Server 2 startup failed:", error);
    }
    
    console.log(`\n✅ Debug test completed!`);
    
    // Cleanup
    setTimeout(() => {
        process.exit(0);
    }, 2000);
}

// Run the test
debugServerStartup().catch(err => {
    console.error("❌ Debug test failed:", err);
    process.exit(1);
});

// Handle cleanup
process.on('SIGINT', () => {
    console.log("\n🧹 Cleaning up...");
    process.exit(0);
});

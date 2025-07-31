import { createServer } from "../integrations/express/ServerFactory";
import { PortManager } from "../integrations/express/server/utils/PortManager";

console.log("🧪 Testing Port Availability Detection");
console.log("=====================================");

async function testPortAvailability() {
    const testPort = 8099;
    
    console.log(`\n🔍 Testing port availability detection for port ${testPort}`);
    
    // Test 1: Check if port is available when nothing is running
    console.log("\n1️⃣ Testing empty port availability...");
    const portManager1 = new PortManager(testPort, { enabled: true });
    const result1 = await portManager1.findAvailablePort();
    console.log("Result:", result1);
    
    // Test 2: Start a server and check if port detection works
    console.log("\n2️⃣ Starting a server on the test port...");
    const blockingServer = createServer({
        logging: { enabled: true, level: "debug" }
    });
    
    blockingServer.get("/test", (req, res) => {
        res.json({ message: "Blocking server", port: testPort });
    });
    
    await new Promise<void>((resolve) => {
        blockingServer.start(testPort, () => {
            console.log(`✅ Blocking server started on port ${testPort}`);
            resolve();
        });
    });
    
    // Wait a moment for the server to fully start
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Now check if port is detected as unavailable
    console.log("\n3️⃣ Testing port availability with server running...");
    const portManager2 = new PortManager(testPort, { 
        enabled: true,
        maxAttempts: 3,
        strategy: "increment"
    });
    const result2 = await portManager2.findAvailablePort();
    console.log("Result:", result2);
    
    // Test 4: Test the actual auto port switch
    console.log("\n4️⃣ Testing auto port switch with real conflict...");
    const switchingServer = createServer({
        server: {
            autoPortSwitch: {
                enabled: true,
                maxAttempts: 3,
                strategy: "increment",
                onPortSwitch(originalPort, newPort) {
                    console.log(`🔄 Port switch callback: ${originalPort} → ${newPort}`);
                },
            },
        },
        logging: { enabled: true, level: "debug" }
    });
    
    switchingServer.get("/switched", (req, res) => {
        res.json({ 
            message: "Auto-switched server", 
            port: switchingServer.getPort(),
            originalPort: testPort
        });
    });
    
    try {
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Server start timeout"));
            }, 10000);
            
            switchingServer.start(testPort, () => {
                clearTimeout(timeout);
                console.log(`✅ Switching server started on port ${switchingServer.getPort()}`);
                resolve();
            });
        });
        
        // Test both servers are working
        console.log("\n5️⃣ Testing both servers...");
        const http = require('http');
        
        // Test original server
        try {
            const response1 = await new Promise<string>((resolve, reject) => {
                const req = http.request({
                    hostname: 'localhost',
                    port: testPort,
                    path: '/test',
                    method: 'GET'
                }, (res: any) => {
                    let data = '';
                    res.on('data', (chunk: any) => data += chunk);
                    res.on('end', () => resolve(data));
                });
                req.on('error', reject);
                req.end();
            });
            console.log("📡 Original server response:", JSON.parse(response1));
        } catch (err) {
            console.log("❌ Original server test failed:", err);
        }
        
        // Test switched server
        try {
            const response2 = await new Promise<string>((resolve, reject) => {
                const req = http.request({
                    hostname: 'localhost',
                    port: switchingServer.getPort(),
                    path: '/switched',
                    method: 'GET'
                }, (res: any) => {
                    let data = '';
                    res.on('data', (chunk: any) => data += chunk);
                    res.on('end', () => resolve(data));
                });
                req.on('error', reject);
                req.end();
            });
            console.log("📡 Switched server response:", JSON.parse(response2));
        } catch (err) {
            console.log("❌ Switched server test failed:", err);
        }
        
        console.log("\n✅ Port availability test completed!");
        
    } catch (error) {
        console.error("❌ Auto port switch test failed:", error);
    }
    
    // Cleanup
    setTimeout(() => {
        process.exit(0);
    }, 2000);
}

// Run the test
testPortAvailability().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});

// Handle cleanup
process.on('SIGINT', () => {
    console.log("\n🧹 Cleaning up...");
    process.exit(0);
});

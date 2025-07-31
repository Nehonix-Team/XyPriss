import { createServer } from "../integrations/express/ServerFactory";

console.log("🧪 Testing Port Switch Conflict Resolution");
console.log("==========================================");

async function testPortSwitchConflict() {
    // Create a blocking server that will occupy port 8095
    const blockingServer = createServer({
        logging: {
            enabled: true,
            level: "debug",
        },
    });

    blockingServer.get("/blocking", (req, res) => {
        res.json({ message: "Blocking server", port: 8095 });
    });

    // Start blocking server
    await new Promise<void>((resolve) => {
        blockingServer.start(8095, () => {
            console.log("🚫 Blocking server started on port 8095");
            resolve();
        });
    });

    // Wait a moment to ensure the port is occupied
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log("\n🔧 Now testing auto port switch with conflict...");

    // Create server with auto port switch
    const switchingServer = createServer({
        server: {
            autoPortSwitch: {
                enabled: true,
                maxAttempts: 5,
                strategy: "increment", // Use increment for predictable testing
                onPortSwitch(originalPort, newPort) {
                    console.log(`🔄 onPortSwitch callback: ${originalPort} → ${newPort}`);
                    // Test the problematic behavior
                    console.log("🔧 Attempting forceClosePort on original port...");
                    switchingServer.forceClosePort(originalPort).then(success => {
                        console.log(`🔧 forceClosePort result: ${success}`);
                    }).catch(err => {
                        console.log(`❌ forceClosePort error: ${err.message}`);
                    });
                },
            },
        },
        logging: {
            enabled: true,
            level: "debug",
        },
    });

    switchingServer.get("/switched", (req, res) => {
        res.json({ 
            message: "Auto-switched server", 
            port: switchingServer.getPort(),
            originalRequestedPort: 8095
        });
    });

    // Try to start on the same port - this should trigger auto port switch
    try {
        await new Promise<void>((resolve, reject) => {
            switchingServer.start(8095, () => {
                console.log(`✅ Switching server started on port ${switchingServer.getPort()}`);
                resolve();
            });
            
            // Add error handling
            setTimeout(() => {
                reject(new Error("Server start timeout"));
            }, 10000);
        });

        // Test the servers
        console.log("\n🧪 Testing both servers...");
        
        const http = require('http');
        
        // Test blocking server
        await new Promise<void>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: 8095,
                path: '/blocking',
                method: 'GET'
            }, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => data += chunk);
                res.on('end', () => {
                    console.log("📡 Blocking server response:", JSON.parse(data));
                    resolve();
                });
            });
            req.on('error', reject);
            req.end();
        });

        // Test switched server
        await new Promise<void>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: switchingServer.getPort(),
                path: '/switched',
                method: 'GET'
            }, (res: any) => {
                let data = '';
                res.on('data', (chunk: any) => data += chunk);
                res.on('end', () => {
                    console.log("📡 Switched server response:", JSON.parse(data));
                    resolve();
                });
            });
            req.on('error', reject);
            req.end();
        });

        console.log("\n✅ Port switch conflict test completed successfully!");

    } catch (error) {
        console.error("❌ Port switch test failed:", error);
    }

    // Cleanup
    setTimeout(() => {
        process.exit(0);
    }, 2000);
}

// Run the test
testPortSwitchConflict().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});

// Handle cleanup
process.on('SIGINT', () => {
    console.log("\n🧹 Cleaning up...");
    process.exit(0);
});

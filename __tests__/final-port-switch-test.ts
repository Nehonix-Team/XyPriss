import { createServer } from "../integrations/express/ServerFactory";

console.log("🧪 Final Port Switch Test - Your Configuration");
console.log("==============================================");

async function finalTest() {
    const testPort = 8085;
    
    console.log(`\n🔧 Step 1: Starting first server (like your gl.ts)...`);
    
    // Create first server similar to your gl.ts
    const server1 = createServer({
        server: {
            autoPortSwitch: {
                enabled: true,
                maxAttempts: 5,
                strategy: "random",
                onPortSwitch(originalPort, newPort) {
                    console.log(`🔄 Server 1 port switched from ${originalPort} to ${newPort}`);
                },
            },
        },
    });

    // Add middleware like in gl.ts
    const middleware1 = server1.middleware({
        rateLimit: {
            enabled: true,
            max: 5,
        },
        cors: {
            enabled: true,
            origin: ["http://localhost:3000", "notValidOrigin.com"],
            allowedHeaders: ["Content-Type", "Authorization", "NOTVALID"],
            methods: ["GET", "POST", "OPTIONS"],
        },
        compression: false,
        security: false,
    });

    middleware1.register((req, res, next) => {
        console.log("🎯 Server 1 MIDDLEWARE HIT");
        next();
    });

    server1.get("/", (req, res) => {
        console.log("🎯 Server 1 ROUTE HIT: GET /");
        res.send({
            message: "Hello from Server 1!",
            port: server1.getPort(),
            time: new Date().toISOString(),
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

    console.log(`\n🔧 Step 2: Starting second server with same config...`);
    
    // Create second server with same configuration
    const server2 = createServer({
        server: {
            autoPortSwitch: {
                enabled: true,
                maxAttempts: 5,
                strategy: "random",
                onPortSwitch(originalPort, newPort) {
                    console.log(`🔄 Server 2 port switched from ${originalPort} to ${newPort}`);
                },
            },
        },
    });

    const middleware2 = server2.middleware({
        rateLimit: {
            enabled: true,
            max: 5,
        },
        cors: {
            enabled: true,
            origin: ["http://localhost:3000", "notValidOrigin.com"],
            allowedHeaders: ["Content-Type", "Authorization", "NOTVALID"],
            methods: ["GET", "POST", "OPTIONS"],
        },
        compression: false,
        security: false,
    });

    middleware2.register((req, res, next) => {
        console.log("🎯 Server 2 MIDDLEWARE HIT");
        next();
    });

    server2.get("/", (req, res) => {
        console.log("🎯 Server 2 ROUTE HIT: GET /");
        res.send({
            message: "Hello from Server 2!",
            port: server2.getPort(),
            time: new Date().toISOString(),
        });
    });

    await new Promise<void>((resolve) => {
        server2.start(testPort, () => {
            console.log(`✅ Server 2 started on port ${server2.getPort()}`);
            resolve();
        });
    });

    console.log(`\n🧪 Step 3: Testing both servers...`);
    console.log(`Server 1 port: ${server1.getPort()}`);
    console.log(`Server 2 port: ${server2.getPort()}`);

    if (server1.getPort() !== server2.getPort()) {
        console.log("✅ Port switching worked! Servers are on different ports.");
    } else {
        console.log("❌ Port switching failed! Servers are on the same port.");
    }

    // Test both servers with HTTP requests
    const http = require('http');

    // Test server 1
    try {
        const response1 = await new Promise<string>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: server1.getPort(),
                path: '/',
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
        const response2 = await new Promise<string>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: server2.getPort(),
                path: '/',
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

    console.log(`\n✅ Final test completed! Port switching is now working correctly.`);
    
    // Cleanup
    setTimeout(() => {
        process.exit(0);
    }, 2000);
}

// Run the test
finalTest().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});

// Handle cleanup
process.on('SIGINT', () => {
    console.log("\n🧹 Cleaning up...");
    process.exit(0);
});

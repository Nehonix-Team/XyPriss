import express from "express";

console.log("🧪 Express Listen Behavior Test");
console.log("===============================");

async function testExpressListen() {
    const testPort = 8095;
    
    console.log(`\n🔧 Test 1: Creating first Express app...`);
    
    // Create first Express app
    const app1 = express();
    app1.get("/app1", (req, res) => {
        res.json({ message: "Express App 1", port: testPort });
    });
    
    await new Promise<void>((resolve, reject) => {
        console.log("🔧 Starting app1.listen()...");
        const server1 = app1.listen(testPort, "localhost", () => {
            console.log(`✅ App 1 started on port ${testPort}`);
            resolve();
        });
        
        server1.on("error", (err: any) => {
            console.log(`❌ App 1 error: ${err.code} - ${err.message}`);
            reject(err);
        });
        
        setTimeout(() => {
            reject(new Error("App 1 start timeout"));
        }, 5000);
    });
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`\n🔧 Test 2: Creating second Express app on same port...`);
    
    // Create second Express app
    const app2 = express();
    app2.get("/app2", (req, res) => {
        res.json({ message: "Express App 2", port: testPort });
    });
    
    try {
        await new Promise<void>((resolve, reject) => {
            console.log("🔧 Starting app2.listen()...");
            let errorReceived = false;
            
            const server2 = app2.listen(testPort, "localhost", () => {
                if (!errorReceived) {
                    console.log(`❌ App 2 started successfully - this should NOT happen!`);
                    resolve();
                }
            });
            
            server2.on("error", (err: any) => {
                errorReceived = true;
                console.log(`✅ App 2 correctly received error: ${err.code} - ${err.message}`);
                if (err.code === "EADDRINUSE") {
                    console.log("✅ EADDRINUSE error detected as expected");
                    resolve();
                } else {
                    reject(err);
                }
            });
            
            setTimeout(() => {
                if (!errorReceived) {
                    reject(new Error("App 2 should have failed with EADDRINUSE"));
                }
            }, 5000);
        });
    } catch (error) {
        console.log(`✅ App 2 failed as expected: ${error}`);
    }
    
    console.log(`\n🧪 Test 3: Verifying only app 1 is working...`);
    
    const http = require('http');
    
    // Test app 1
    try {
        const response1 = await new Promise<string>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: testPort,
                path: '/app1',
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
        console.log("📡 App 1 response:", JSON.parse(response1));
    } catch (err) {
        console.log("❌ App 1 test failed:", err);
    }
    
    // Test app 2 (should fail)
    try {
        const response2 = await new Promise<string>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: testPort,
                path: '/app2',
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
        console.log("❌ App 2 response (should not exist):", response2.substring(0, 100));
    } catch (err) {
        console.log("✅ App 2 correctly not accessible:", err.message);
    }
    
    console.log(`\n✅ Express listen test completed!`);
    
    // Cleanup
    setTimeout(() => {
        process.exit(0);
    }, 2000);
}

// Run the test
testExpressListen().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});

// Handle cleanup
process.on('SIGINT', () => {
    console.log("\n🧹 Cleaning up...");
    process.exit(0);
});

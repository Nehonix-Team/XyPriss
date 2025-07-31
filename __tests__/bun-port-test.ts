import { createServer } from "http";

console.log("🧪 Bun Port Binding Test");
console.log("========================");
console.log(`Runtime: ${process.versions.bun ? 'Bun' : 'Node.js'}`);

async function testBunPortBinding() {
    const testPort = 8094;
    
    console.log(`\n🔧 Test 1: Creating first HTTP server...`);
    
    // Create first HTTP server
    const server1 = createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: "Server 1", port: testPort }));
    });
    
    await new Promise<void>((resolve, reject) => {
        console.log("🔧 Starting server1.listen()...");
        server1.listen(testPort, "localhost", () => {
            console.log(`✅ Server 1 started on port ${testPort}`);
            resolve();
        });
        
        server1.on("error", (err: any) => {
            console.log(`❌ Server 1 error: ${err.code} - ${err.message}`);
            reject(err);
        });
        
        setTimeout(() => {
            reject(new Error("Server 1 start timeout"));
        }, 5000);
    });
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`\n🔧 Test 2: Creating second HTTP server on same port...`);
    
    // Create second HTTP server
    const server2 = createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: "Server 2", port: testPort }));
    });
    
    try {
        await new Promise<void>((resolve, reject) => {
            console.log("🔧 Starting server2.listen()...");
            let errorReceived = false;
            
            server2.listen(testPort, "localhost", () => {
                if (!errorReceived) {
                    console.log(`❌ Server 2 started successfully - this should NOT happen!`);
                    resolve();
                }
            });
            
            server2.on("error", (err: any) => {
                errorReceived = true;
                console.log(`✅ Server 2 correctly received error: ${err.code} - ${err.message}`);
                if (err.code === "EADDRINUSE") {
                    console.log("✅ EADDRINUSE error detected as expected");
                    resolve();
                } else {
                    reject(err);
                }
            });
            
            setTimeout(() => {
                if (!errorReceived) {
                    reject(new Error("Server 2 should have failed with EADDRINUSE"));
                }
            }, 5000);
        });
    } catch (error) {
        console.log(`✅ Server 2 failed as expected: ${error}`);
    }
    
    console.log(`\n🧪 Test 3: Testing with different hosts...`);
    
    // Test with 127.0.0.1 instead of localhost
    const server3 = createServer((req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: "Server 3", port: testPort }));
    });
    
    try {
        await new Promise<void>((resolve, reject) => {
            console.log("🔧 Starting server3.listen() on 127.0.0.1...");
            let errorReceived = false;
            
            server3.listen(testPort, "127.0.0.1", () => {
                if (!errorReceived) {
                    console.log(`❌ Server 3 started successfully on 127.0.0.1 - checking if this conflicts...`);
                    resolve();
                }
            });
            
            server3.on("error", (err: any) => {
                errorReceived = true;
                console.log(`✅ Server 3 correctly received error: ${err.code} - ${err.message}`);
                resolve();
            });
            
            setTimeout(() => {
                if (!errorReceived) {
                    console.log("🔍 Server 3 started without error - testing if it actually works...");
                    resolve();
                }
            }, 3000);
        });
    } catch (error) {
        console.log(`Server 3 result: ${error}`);
    }
    
    console.log(`\n🧪 Test 4: Verifying which servers are actually working...`);
    
    const http = require('http');
    
    // Test localhost
    try {
        const response1 = await new Promise<string>((resolve, reject) => {
            const req = http.request({
                hostname: 'localhost',
                port: testPort,
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
        console.log("📡 localhost response:", JSON.parse(response1));
    } catch (err) {
        console.log("❌ localhost test failed:", err);
    }
    
    // Test 127.0.0.1
    try {
        const response2 = await new Promise<string>((resolve, reject) => {
            const req = http.request({
                hostname: '127.0.0.1',
                port: testPort,
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
        console.log("📡 127.0.0.1 response:", JSON.parse(response2));
    } catch (err) {
        console.log("❌ 127.0.0.1 test failed:", err);
    }
    
    console.log(`\n✅ Bun port binding test completed!`);
    
    // Cleanup
    server1.close();
    server2.close();
    server3.close();
    
    setTimeout(() => {
        process.exit(0);
    }, 2000);
}

// Run the test
testBunPortBinding().catch(err => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});

// Handle cleanup
process.on('SIGINT', () => {
    console.log("\n🧹 Cleaning up...");
    process.exit(0);
});

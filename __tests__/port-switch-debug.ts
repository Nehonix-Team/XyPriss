import { createServer } from "../integrations/express/ServerFactory";

console.log("🧪 Testing Port Switch Issue Debug");
console.log("==================================");

// Test 1: Problematic configuration (with forceClosePort in callback)
console.log("\n🔴 Test 1: With forceClosePort in onPortSwitch callback");

const problematicApp = createServer({
    server: {
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 5,
            strategy: "random",
            onPortSwitch(originalPort, newPort) {
                console.log(`🔄 Port switched from ${originalPort} to ${newPort}`);
                // This might cause issues
                problematicApp.forceClosePort(originalPort);
            },
        },
    },
    logging: {
        enabled: true,
        level: "debug",
    },
});

problematicApp.get("/problematic", (req, res) => {
    res.json({
        message: "Problematic server",
        port: problematicApp.getPort(),
    });
});

// Start blocking server first
const blockingServer = createServer({});
blockingServer.get("/blocking", (req, res) => {
    res.json({ message: "Blocking server on 8090" });
});

blockingServer.start(8090, () => {
    console.log("🚫 Blocking server started on port 8090");
    
    // Now try the problematic configuration
    setTimeout(() => {
        console.log("\n🔧 Starting problematic server on same port...");
        problematicApp.start(8090, () => {
            console.log(`✅ Problematic server started on port ${problematicApp.getPort()}`);
            
            // Test 2: Fixed configuration (without forceClosePort in callback)
            setTimeout(() => {
                console.log("\n🟢 Test 2: Without forceClosePort in onPortSwitch callback");
                
                const fixedApp = createServer({
                    server: {
                        autoPortSwitch: {
                            enabled: true,
                            maxAttempts: 5,
                            strategy: "random",
                            onPortSwitch(originalPort, newPort) {
                                console.log(`🔄 Port switched from ${originalPort} to ${newPort}`);
                                // Don't force close here - let the system handle it
                            },
                        },
                    },
                    logging: {
                        enabled: true,
                        level: "debug",
                    },
                });

                fixedApp.get("/fixed", (req, res) => {
                    res.json({
                        message: "Fixed server",
                        port: fixedApp.getPort(),
                    });
                });

                // Try to start on another occupied port
                const anotherBlocker = createServer({});
                anotherBlocker.start(8091, () => {
                    console.log("🚫 Another blocking server started on port 8091");
                    
                    setTimeout(() => {
                        console.log("\n🔧 Starting fixed server on same port...");
                        fixedApp.start(8091, () => {
                            console.log(`✅ Fixed server started on port ${fixedApp.getPort()}`);
                            
                            // Cleanup and exit
                            setTimeout(() => {
                                console.log("\n✅ All tests completed!");
                                process.exit(0);
                            }, 2000);
                        });
                    }, 1000);
                });
            }, 3000);
        });
    }, 2000);
});

// Handle cleanup
process.on('SIGINT', () => {
    console.log("\n🧹 Cleaning up...");
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error("❌ Uncaught exception:", err.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error("❌ Unhandled rejection:", reason);
    process.exit(1);
});

/**
 * Test script to demonstrate auto port switching functionality
 */

const { createServer } = require("../../dist/cjs/index.js");

console.log("🧪 Testing Auto Port Switching Feature");
console.log("=====================================");

// First, let's start a server on port 8085 to occupy it
const blockingServer = createServer({
  server: {
    port: 8085,
  },
  env: 'development'
});

blockingServer.get("/blocking", (req, res) => {
  res.json({ message: "This server is blocking port 8085" });
});

// Start the blocking server
blockingServer.start(8085, () => {
  console.log("🚫 Blocking server started on port 8085");
  
  // Now try to start another server on the same port with auto port switching
  setTimeout(() => {
    console.log("\n🔄 Now attempting to start another server on port 8085 with auto port switching...");
    
    const app = createServer({
      server: {
        autoPortSwitch: {
          enabled: true,
          maxAttempts: 5,
          strategy: "random",
        },
      },
      env: 'development'
    });

    app.get("/", (req, res) => {
      res.json({ 
        message: "Hello from auto-switched server!",
        port: app.getPort(),
        originalPort: 8085
      });
    });

    // This should trigger auto port switching
    app.start(8085, () => {
      console.log(`\n✅ Auto-switched server started successfully!`);
      console.log(`📍 Final port: ${app.getPort()}`);
      console.log(`🌐 Test URL: http://localhost:${app.getPort()}/`);
      
      // Test the server
      setTimeout(() => {
        console.log("\n🧪 Testing the auto-switched server...");
        
        const http = require('http');
        const options = {
          hostname: 'localhost',
          port: app.getPort(),
          path: '/',
          method: 'GET'
        };

        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            console.log("📡 Response:", JSON.parse(data));
            console.log("\n✅ Auto port switching test completed successfully!");
            
            // Cleanup
            setTimeout(() => {
              process.exit(0);
            }, 1000);
          });
        });

        req.on('error', (err) => {
          console.error("❌ Test request failed:", err.message);
          process.exit(1);
        });

        req.end();
      }, 2000);
    });
    
  }, 2000);
});

// Handle cleanup on exit
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

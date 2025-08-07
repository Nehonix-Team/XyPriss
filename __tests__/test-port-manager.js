// Test PortManager directly
import { PortManager } from "./src/server/utils/PortManager.ts";
import { createServer } from "./src/index.ts";

console.log("🧪 Testing PortManager directly...");

async function testPortManager() {
    // Create and start a server first
    const app = createServer({
        logging: { enabled: false },
    });

    app.get("/", (req, res) => {
        res.json({ message: "Test server" });
    });

    try {
        console.log("Starting server on port 9999...");
        await app.start(9999);
        console.log("✅ Server started on port 9999");

        // Now test PortManager
        console.log("Testing PortManager.isPortAvailable on port 9999...");
        const portManager = new PortManager(9999, { enabled: false });
        const result = await portManager.findAvailablePort("localhost");

        console.log("PortManager result:", result);

        if (result.success === false) {
            console.log(
                "✅ PortManager correctly detected port 9999 is in use"
            );
        } else {
            console.log(
                "❌ PortManager incorrectly reported port 9999 as available"
            );
        }

        // Test on a different port that should be available
        console.log("Testing PortManager.isPortAvailable on port 9998...");
        const portManager2 = new PortManager(9998, { enabled: false });
        const result2 = await portManager2.findAvailablePort("localhost");

        console.log("PortManager result for port 9998:", result2);

        if (result2.success === true) {
            console.log(
                "✅ PortManager correctly detected port 9998 is available"
            );
        } else {
            console.log(
                "❌ PortManager incorrectly reported port 9998 as unavailable"
            );
        }

        process.exit(0);
    } catch (error) {
        console.log("❌ Error:", error.message);
        process.exit(1);
    }
}

testPortManager();


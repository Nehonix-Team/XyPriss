import { XyprissApp } from "./src/server/core/XyprissApp";
import { Logger } from "./shared/logger/Logger";
import { XHSCBridge } from "./src/server/core/XHSCBridge";

async function test() {
    const logger = new Logger();
    const app = new XyprissApp(logger);

    console.log("🛠️  Testing XHSC (XyPriss Hybrid Server Core) Integration...");

    const bridge = new XHSCBridge(app, logger);

    // Register a real route to test synchronization
    app.get("/api/users", (req, res) => {
        console.log("🚀 JS Route Handler called via XHSC Bridge!");
        res.json({
            success: true,
            message: "Hello from Node.js (via Rust XHSC!)",
            received: {
                method: req.method,
                path: req.path,
                headers: req.headers["user-agent"],
            },
        });
    });

    // The port the Rust server will listen on
    const PORT = 4000;

    try {
        await bridge.start(PORT);
        console.log(`XHSC Bridge and Rust Engine are active on port ${PORT}`);
        console.log(`Invocation: curl http://localhost:${PORT}/api/users`);

        // Keep process alive
        process.stdin.resume();

        process.on("SIGINT", () => {
            console.log("\nStopping Bridge...");
            bridge.stop();
            process.exit(0);
        });
    } catch (e) {
        console.error("❌ Failed to start XHSC:", e);
    }
}

test();


import { XyprissApp } from "./src/server/core/XyprissApp";
import { Logger } from "./shared/logger/Logger";
import { XHSCBridge } from "./src/server/core/XHSCBridge";

async function test() {
    const logger = new Logger();
    const app = new XyprissApp(logger);

    console.log("🛠️  Testing XHSC (XyPriss Hybrid Server Core) Integration...");

    const bridge = new XHSCBridge(app, logger);

    app.get("/api/users/:id", (req, res) => {
        console.log("🚀 GET Param JS Route Handler called via XHSC Bridge!");
        res.json({
            success: true,
            method: "GET",
            params: req.params,
            received: {
                userAgent: req.headers["user-agent"],
            },
        });
    });

    app.post("/api/echo", (req, res) => {
        console.log("🚀 POST JS Route Handler called via XHSC Bridge!");
        res.json({
            success: true,
            method: "POST",
            body: req.body,
            headers: req.headers,
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


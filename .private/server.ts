import {
    createServer,
    NetworkStats,
    ProcessInfo,
    XyPrissSys,
} from "../src/index";

const app = createServer({
    server: {
        port: 8085,
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 10,
        },
    },
});

// For plugin access
(global as any).__sys__ = (app as any).httpServer?.app || app;
// Actually createServer returns an app, and we want to expose the system object.
// In XyPriss, the system object is often attached to the app.

// Try to load the simulation plugin
try {
    const { plg } = require("../simulations/pkg/src/index");
    (app as any).use(plg());
} catch (e) {
    console.warn("Could not load simulation plugin:", e);
}

const __sys__ = global.__sys__ as XyPrissSys;

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello " });
});

app.start();


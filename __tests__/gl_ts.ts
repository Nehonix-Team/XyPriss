import { __processor__ } from "nehonix-uri-processor";
import {
    createServer,
    Request,
    Response,
    NextFunction,
    XyPrissRouter,
    Router,
} from "..";
import { createApp } from "../server/core/XyprissApp";
import { MainTestRouterApp } from "./router";

console.log("Creating server...");
// Use createApp instead of createServer for router support
const app = createServer({
    server: {},
    logging: {
        enabled: true,
        level: "debug",
    },
    cache: {
        enabled: true,
        strategy: "memory",
        ttl: 300000,
    },
    // performance
    cluster: {
        enabled: true,
        config: {
            workers: 1,
            security: {
                isolateWorkers: true,
                resourceLimits: true,
                preventForkBombs: true,
                encryptIPC: true,
                sandboxMode: true,
            },
        },
    },
});

console.log("App created, registering route...");

// Test middleware that calls next() - should continue
app.use((_req: any, _res: any, next?: any) => {
    console.log("🔵 USER MIDDLEWARE 1: This middleware calls next()");
    next?.(); // Call next to continue
});

// Test middleware that CALLS next() - should CONTINUE the chain
app.use((_req: any, _res: any, next?: any) => {
    const data =
        "PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K";
    console.log(
        "🤠 decoded data: ",
        __processor__.autoDetectAndDecode(data).val()
    );
    console.log(
        "🔴 USER MIDDLEWARE 2: This middleware CALLS next() - CHAIN SHOULD CONTINUE!"
    );
    // Now calling next() to allow the chain to continue to the route handler
    next();
});

app.get("/", (_req, res) => {
    console.log("🤩Route handler called!");
    res.json({ message: "Hello from XyPriss!", _req });
});
// Test the new middleware API
console.log("🔧 Testing XyPriss Middleware API...");

// Register custom middleware
app.middleware()
    .register(
        (req: any, res: any, next: any) => {
            console.log(`📝 Custom middleware: ${req.method} ${req.url}`);
            next();
        },
        { name: "logger", priority: "normal" }
    )
    .rateLimit({ max: 50, windowMs: 15 * 60 * 1000 }); // Add rate limiting

// Show middleware stats
console.log("📊 Middleware Stats:", app.middleware().stats());
console.log("📋 Middleware List:", app.middleware().list());

app.get("/test", (_req, res) => {
    console.log("🤩Route handler called!");
    res.json({ message: "Hello from XyPriss!", _req });
});

app.post("/", (_req, res) => {
    const data = _req.body;
    console.log("POST Route handler called!");
    res.json({ message: "Hello from XyPriss!", data, _req });
});

const router = Router();

// Define routes BEFORE mounting the router
router.get("/test", (_req: any, res: any) => {
    console.log("API Route handler called!");
    res.json({ message: "Hello from XyPriss!", _req });
});

router.get("/all/**", (_req: any, res: any) => {
    console.log("API Route handler called!");
    res.json({ message: "Hello from XyPriss!", _req });
});

// Mount the router to the app AFTER defining routes
app.use("/api", router);
app.all("/all/**", (_req: any, res: any) => {
    console.log("API Route handler called!");
    res.json({ message: "Hello from XyPriss!", _req });
});

app.use(MainTestRouterApp);

console.log("Route registered, starting server...");
app.start();


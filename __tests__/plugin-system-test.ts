import { createServer, type XyPrissPlugin } from "../src";

// Comprehensive plugin test demonstrating ALL hooks
const testPlugin: XyPrissPlugin = {
    name: "comprehensive-test",
    version: "1.0.0",
    description: "Tests all plugin hooks",

    // Lifecycle hooks
    onRegister: (server, config) => {
        console.log(
            "✅ [1] onRegister: Plugin registered with config:",
            config
        );
    },

    onServerStart: (server) => {
        console.log("✅ [2] onServerStart: Server is starting");
    },

    onServerReady: (server) => {
        console.log("✅ [3] onServerReady: Server is fully ready!");
    },

    // Request/Response hooks
    onRequest: (req, res, next) => {
        console.log(`✅ [4] onRequest: ${req.method} ${req.url}`);
        next();
    },

    onResponse: (req, res) => {
        console.log(`✅ [5] onResponse: Response sent for ${req.url}`);
    },

    onError: (error, req, res, next) => {
        console.log(`✅ [6] onError: Caught error:`, error.message);
        res.status(500).json({
            error: "Plugin caught this error",
            message: error.message,
        });
    },

    // Route registration
    registerRoutes: (app) => {
        console.log("✅ [7] registerRoutes: Registering plugin routes");

        app.get("/test/success", (req, res) => {
            res.json({
                message: "All hooks working!",
                hooks: [
                    "onRegister",
                    "onServerStart",
                    "onServerReady",
                    "onRequest",
                    "onResponse",
                    "registerRoutes",
                ],
            });
        });

        app.get("/test/error", (req, res) => {
            // Intentional error to test onError hook
            throw new Error("Test error for onError hook");
        });
    },

    // Middleware
    middleware: (req: any, res: any, next: any) => {
        console.log(`✅ [8] middleware: Processing ${req.url}`);
        req.pluginData = { processed: true };
        next();
    },
    middlewarePriority: "first",
};

const app = createServer({
    server: {
        port: 3000,
    },
    plugins: {
        register: [() => testPlugin],
    },
});

app.start(undefined, () => {
    console.log("\n🎉 Server started! Test the following endpoints:");
    console.log("  - http://localhost:3000/test/success (tests success path)");
    console.log(
        "  - http://localhost:3000/test/error (tests error handling)\n"
    );
});


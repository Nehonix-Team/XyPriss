import { TestAppRouter } from "./router_test";
import { func, getRandomBytes } from "../mods/security/src";
import { createServer } from "../src";

const app = createServer({
    plugins: {
        routeOptimization: {
            enabled: true,
            analysisInterval: 100,
            customRules: [
                {
                    pattern: "/",
                    minHits: 10,
                    maxResponseTime: 300,
                    cacheStrategy: "conservative",
                },
                {
                    pattern: "/api/*",
                    minHits: 50,
                    maxResponseTime: 200,
                    cacheStrategy: "aggressive",
                    preloadEnabled: true,
                },
            ],
        },
        serverMaintenance: {
            enabled: true,
            checkInterval: 30000,
            memoryThreshold: 75,
            responseTimeThreshold: 1000,
            autoCleanup: true,
            autoRestart: false,
        },
    },
    logging: {
        enabled: true,
        level: "debug",
        types: {
            debug: true,
        },
    },
});

app.middleware({
    cors: {
        enabled: true,
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: [
            "Origin",
            "X-Requested-With",
            "Content-Type",
            "Accept",
            "Authorization",
        ],
        credentials: true,
    },
    enableCaching: true,
    security: {
        helmet: true,
        csrfProtection: false,
    },
    compression: {
        enabled: true,
        level: 6,
        threshold: 1024,
    },
    rateLimit: {
        max: 2, // for testing purpose
        enabled: true,

        windowMs: 15 * 60 * 1000, // 15 minutes
    },
});

export const helper = func(() => {
    return (
        "Hello World from Nehonix FortifyJS: " +
        getRandomBytes(32).toString("hex")
    );
});

// Middleware is automatically enabled when configured above
// No need to call enable() with a random ID

app.use("/api", TestAppRouter);
app.get("/", (_req, res) => {
    res.send(
        "Hello World from Nehonix FortifyJS: " +
            getRandomBytes(32).toString("hex")
    );
});

app.start();


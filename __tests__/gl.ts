import { TestAppRouter } from "./router_test";
import { func, getRandomBytes } from "../mods/security/src";
import { createServer } from "../src";

const app = createServer({
    server: {
        host: process.env["HOST"] || "localhost",
        autoPortSwitch: {
            enabled: true, // Automatically find available port if specified port is in use
            maxAttempts: 10,
            strategy: "random",
        },
    },
    requestManagement: {
        networkQuality: {
            enabled: true,
        },
    },
    plugins: {
        routeOptimization: {
            enabled: true,
        },
        serverMaintenance: {
            enabled: true,
            memoryThreshold: 90,
        },
    },
    security: {
        sanitization: true,
    },

    env: process.env["NODE_ENV"] || ("development" as any),
    cluster: {
        enabled: true,
        config: {
            workers: "auto",
            resources: {},
            loadBalancing: {
                strategy: "round-robin",
            },
            advanced: {
                deployment: {
                    rollingUpdates: true,
                },
            },
            security: {
                encryptIPC: true,
                isolateWorkers: true,
            },
        },
    },
    logging: {
        enabled: true,
        components: {
            userApp: true, // nous désactiverons en prod pour éviter que les gens puissent lire les logs du serveur
        },
        consoleInterception: {
            enabled: true,
            interceptMethods: ["log", "warn", "error"],
            filters: {
                userAppPatterns: ["src/", "backend"],
            },
            preserveOriginal: {
                enabled: true,
                mode: "original", // en production nous allons remmettre à "intercepted" pour éviter les logs systemes en prod
                allowDuplication: false,
            },
        },
        types: {
            debug: false,
            portSwitching: true,
            startup: true,
        },
    },
    network: {
        connection: {
            connectionPool: {},
            enabled: true,
            http2: {
                enabled: true,
            },
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
        max: 10, // for testing purpose
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


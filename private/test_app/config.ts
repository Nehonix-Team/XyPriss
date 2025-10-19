import { createServer } from "../../src";

export const XyPriss_Config: Parameters<typeof createServer>[0] = {
    server: {
        autoParseJson: false,
        trustProxy: false,
        host: "localhost",
        port: 6376,
        autoPortSwitch: {
            enabled: false, // Automatically find available port if specified port is in use
            maxAttempts: 10,
            strategy: "random",
        },
    },

    security: {
        enabled: true,
        // Production-ready defaults with some middleware disabled for testing
        rateLimit: {
            max: 3,
            message: "Hello just a test for rate limit",
        }, // Enable general rate limiting
        morgan: false, // Disable request logging for cleaner output

        cors: {
            origin: "*",
            allowedHeaders: ["Content-Type", "Authorization"],
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            credentials: true,
        },
    },

    multiServer: {
        enabled: true,
        servers: [
            {
                port: 8373,
                id: "cross_plateform_",
                server: {
                    autoParseJson: false,
                    host: "192.168.0.46",
                },
                routePrefix: "/",
            },
            {
                port: 6532,
                id: "mainserver",
                server: {
                    autoParseJson: false,
                    host: "localhost",
                },
                routePrefix: "/api",
                allowedRoutes: ["/api/*"],
            },
        ],
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
    },

    cluster: {
        enabled: false,
        config: {
            workers: 4,
            security: {
                encryptIPC: true,
                isolateWorkers: true,
            },
        },
    },
    fileUpload: {
        allowedExtensions: [".png", ".gif", ".jpg", ".jpeg", ".webp", ".pdf"],
        enabled: true,
    },
    logging: {
        enabled: true,
        types: {
            debug: true,
        },
        components: {
            security: true,
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
    monitoring: {
        enabled: true,
    },
};


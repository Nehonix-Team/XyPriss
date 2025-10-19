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
        bruteForce: false,
        cors: {
            origin: "*",
            allowedHeaders: ["Content-Type", "Authorization"],
            methods: ["GET"],
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
                allowedRoutes: ["/*"],
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


import {
    createServer,
    Plugin,
    Router,
    FileUploadAPI,
    XyPrisRequest,
    XyPrisResponse,
    XyPrissSys,
    XyPrissResponse,
    PluginContext,
} from "../src/index";
import { ORFOF } from "./otherRouterFromFile";

// Test Configuration
const app = createServer({
    requestManagement: {
        networkQuality: {
            enabled: true,
            rejectOnPoorConnection: true,
            maxLatency: 500, // Requests are rejected if avg latency > 500ms
            minBandwidth: 1024, // Bytes/s minimum requirement
        },
        resilience: {
            retryEnabled: true,
            maxRetries: 2,
            circuitBreaker: {
                enabled: true,
                failureThreshold: 5,
            },
        },
    },
    logging: {
        // ça marche pas comme prévu
        consoleInterception: {
            // Enable/disable the system
            enabled: true,

            // Which console methods to intercept
            interceptMethods: ["log", "error", "warn", "info", "debug"],

            // How to handle original console output
            preserveOriginal: {
                enabled: true,
                mode: "none", // 'original' | 'intercepted' | 'both' | 'none'
                showPrefix: false,
                onlyUserApp: true,
                colorize: true,
            },

            // Performance settings
            performanceMode: true,
            maxInterceptionsPerSecond: 1000,

            // Source tracking
            sourceMapping: true,
            stackTrace: false,

            // Filtering
            filters: {
                minLevel: "debug", // 'debug' | 'info' | 'warn' | 'error'
                maxLength: 1000,
                excludePatterns: ["node_modules", "internal"],
                includePatterns: [],
            },

            // Error handling
            fallback: {
                onError: "console", // 'silent' | 'console' | 'throw'
                gracefulDegradation: true,
                maxErrors: 10,
            },
        },
    },
    cluster: {
        enabled: false,
        resources: {},
    },
    server: {
        port: 6372,
        autoPortSwitch: { enabled: true },
    },
    pluginPermissions: [
        {
            name: "tets",
            // il n'y a aucune validations faites à ce niveau pour voir si
            // la permission existe ou pas.
            allowedHooks: ["PLG.LOGGING.CONSOLNTERCEPT"],
            deniedHooks: ["PLG.LOGGING.CONSOLNTERCEPT"],
        },
    ],
    plugins: {
        register: [
            {
                name: "filtered-logger",
                version: "1.0.0",
                description: "Filters console logs based on category and level",
                onConsoleIntercept(log) {
                    // ✅ Good: Use process.stdout directly
                    process.stdout.write(`🤫 Received: ${log.method}\n`);
                },
            },
        ],
    },
    // MultiServer config to test the config fixes
    multiServer: {
        enabled: false,
        servers: [
            {
                allowedRoutes: [
                    "/api/*", // Matches /api/users, /api/posts
                    "/api/v1/**", // Matches /api/v1/users/123/posts
                    "/exact", // Exact match only
                ],
                id: "test-mls2",
                port: 4378,
                requestManagement: {
                    timeout: {
                        defaultTimeout: 5000,
                    },
                },
                plugins: {
                    register: [
                        Plugin.create({
                            name: "test-plugin",
                            version: "1.0.0",
                            description: "Test plugin",
                            onRegister: (server) => {
                                console.log("Plugin registered");
                            },
                            onError(error, req, res, next) {
                                console.log("Plugin error");
                            },
                        }),
                    ],
                },
                cluster: {
                    enabled: false,
                },
            },
        ],
    },
    //NETWORK_CONFIG_GUIDE.md
    network: {
        rateLimit: {
            enabled: true, // Enable/disable rate limiting
            strategy: "fixed-window",

            global: {
                requests: 1000, // Max requests per window
                window: "1m", // Time window (e.g., "1m", "1h", "1d")
            },
        },

        proxy: {
            enabled: true,

            upstreams: [
                {
                    host: "backend1.example.com",
                    port: 8080,
                    weight: 2,
                    maxConnections: 100,
                    healthCheckPath: "/health",
                },
                {
                    host: "backend2.example.com",
                    port: 8080,
                    weight: 1,
                    maxConnections: 100,
                    healthCheckPath: "/health",
                },
            ],

            loadBalancing: "weighted-round-robin",

            healthCheck: {
                enabled: true,
                interval: 30000, // Check every 30 seconds
                timeout: 5000, // 5 second timeout
                path: "/health",
                unhealthyThreshold: 3,
                healthyThreshold: 2,
            },

            timeout: 30000,
            logging: true,

            onError: (error, req, res) => {
                console.error("Proxy error:", error);
                res.status(502).json({ error: "Bad Gateway" });
            },
        },
        compression: {
            enabled: true, // Enable/disable compression
            algorithms: ["deflate"], // Supported algorithms
            level: 9, // Compression level 1-9 (higher = better compression, slower)
            threshold: 1024, // Min response size to compress (bytes)
            contentTypes: ["text/*", "application/json"], // Content types to compress
            memLevel: 9, // Memory level for compression (1-9)
            windowBits: 15, // Window size for compression
        },
        connection: {
            enabled: true, // Enable/disable the connection plugin

            http2: {
                enabled: true, // Enable HTTP/2 support
                maxConcurrentStreams: 100, // Max concurrent streams per connection (default: 100)
                initialWindowSize: 65536, // Initial window size for flow control (default: 65536)
                serverPush: true, // Enable HTTP/2 server push (default: true)
            },

            keepAlive: {
                enabled: true, // Enable keep-alive connections (default: true)
                timeout: 30000, // Keep-alive timeout in ms (default: 30000)
                maxRequests: 100, // Max requests per connection (default: 100)
            },

            connectionPool: {
                maxConnections: 1000, // Maximum number of connections (default: 1000)
                timeout: 5000, // Connection timeout in ms (default: 5000)
                idleTimeout: 60000, // Idle timeout in ms (default: 60000)
            },
        },
    },
});

const __sys__ = global.__sys__ as XyPrissSys;

// Test Router Middleware Path Fix
const router = Router();
router.get("/test", (req, res: XyPrissResponse) => res.send("Main Router OK"));
router.use("/orfof", ORFOF);

app.use(router);

app.get("/error", (req, res) => {
    res.xJson({});
});

console.log("Salut le monde");

app.start();



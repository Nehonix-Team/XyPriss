import { createServer, XyPrissSys, __sys__ } from "../src";
import { testSConfigs2 } from "./configs";
import router from "./router";
import { logger } from "./testPlugin_Logger";

// Créez d'abord la configuration

// Gelez toute la configuration avant de la passer
const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "server1",
                port: 7627,
                host: "localhost",
                server: {
                    xems: {
                        persistence: {
                            enabled: true,
                            path: "secureStorage.xems",
                            secret: "c538b49160b30869eb9bd528a3faebeb",
                        },
                    },
                    trustProxy: "127.0.0.1",
                },
                logging: {
                    format: {
                        // palette: {
                        //     brightBlue: "\x1b[94m",
                        //     customPink: "\x1b[38;5;20m",

                        // },
                        componentColors: {
                            // server: "\x1b[38;5;201m", // Match customPink manually or use the escape
                        },
                    },
                },
                security: {
                    rateLimit: {
                        max: 5,
                        windowMs: 60000,
                        message: {
                            code: 429,
                            message:
                                "Too many requests from this IP, please try again later (this is a default message, you can customize it in the config).",
                        },
                        standardHeaders: true,
                        legacyHeaders: true,
                        excludePaths: ["/test-exclude", /^\/test-regex/],
                    },
                },
                plugins: {
                    register: [logger],
                },
                network: {
                    compression: {
                        algorithms: ["br", "gzip", "deflate", "zstd"],
                    },
                },
            },
        ],
    },
});

app.get("/test-native-logic", (req, res) => {
    res.json({
        ip: req.ip,
        remoteAddress: req.socket.remoteAddress,
        rateLimit: "active",
        trustProxy: "configured",
    });
});

app.get("/test-exclude", (req, res) => {
    res.json({ message: "Should not be rate limited" });
});

app.get("/test-regex-abc", (req, res) => {
    res.json({ message: "Regex matches!" });
});

app.use("/api", router);

app.get("/main/base/route", (req, res) => {
    res.status(200).json({ message: "Main route" });
});

// Start testing sequence
app.start(async () => {
    console.log(
        "🚀 Testing native rate limiter and trust proxy (XHSC Engine)...",
    );

    for (let i = 1; i <= 7; i++) {
        try {
            const response = await fetch(
                "http://localhost:7627/test-native-logic",
                {
                    headers: { "X-Forwarded-For": "192.168.1.1" },
                },
            );
            const data: any = await response.json();
            const rl = {
                limit: response.headers.get("ratelimit-limit"),
                remaining: response.headers.get("ratelimit-remaining"),
                reset: response.headers.get("ratelimit-reset"),
                legacyLimit: response.headers.get("x-ratelimit-limit"),
            };
            const errorInfo =
                data.error || data.message || JSON.stringify(data);
            console.log(
                `[Test ${i}] Status: ${response.status}, Data: ${data.ip || errorInfo} (RL: ${rl.remaining}/${rl.limit}, LegacyLimit: ${rl.legacyLimit})`,
            );
        } catch (e: any) {
            console.error(`[Test ${i}] Failed:`, e.message);
        }
    }

    console.log("\n🚀 Testing ExcludePaths (String)...");
    try {
        const response = await fetch("http://localhost:7627/test-exclude");
        const data = await response.json();
        console.log(
            `[Exclude Test] Status: ${response.status}, Msg: ${data.message}`,
        );
    } catch (e: any) {
        console.error(`[Exclude Test] Failed:`, e.message);
    }

    console.log("\n🚀 Testing ExcludePaths (Regex)...");
    try {
        const response = await fetch("http://localhost:7627/test-regex-abc");
        const data = await response.json();
        console.log(
            `[Regex Exclude Test] Status: ${response.status}, Msg: ${data.message}`,
        );
    } catch (e: any) {
        console.error(`[Regex Exclude Test] Failed:`, e.message);
    }
});


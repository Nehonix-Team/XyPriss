import {
    createServer,
    NetworkStats,
    ProcessInfo,
    XyPrissSys,
} from "../src/index";

const app = createServer({
    security: {
        rateLimit: {
            max: 2,
        },
    },

    server: {
        port: 6372,
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 10,
        },
    },
});

const __sys__ = global.__sys__ as XyPrissSys;


app.get("/health", (req, res) => {
    res.xJson({
        status: "ok",
        memoryUsage: __sys__.hdw.usage_percent,
        process: process.pid,
        uptime: __sys__.hdw.uptime,
    });
});

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello " });
});

app.start();


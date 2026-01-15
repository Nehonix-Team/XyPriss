import {
    createServer,
    NetworkStats,
    ProcessInfo,
    XyPrissSys,
} from "../src/index";

const app = createServer({
    security: {
        rateLimit: {
            max: 20,
        },
    },
    requestManagement: {
        concurrency: {
            maxConcurrentRequests: 2,
            onQueueOverflow(req, res) {
                console.log("Overflow");
            },
        },
        timeout: {
            enabled: true,
            defaultTimeout: 1000,
            includeStackTrace: true,
            errorMessage: "Request timed out (custom)",
        },
    },

    cluster: {
        enabled: false,
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

app.get("/", (req, res) => {
    // the goal is to test the timeout middleware
    setTimeout(() => {
        console.log("Request received on /");
        res.xJson({ message: "Hello world from XP" });
    }, 40000);
});

app.start();


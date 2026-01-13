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
cluster
    workerPool: {
        enabled: true,
        config: {
            cpu: {
                min: 4,
                max: 8,
            },
            io: {
                min: 2,
                max: 2,
            },
            maxConcurrentTasks: 10,
        },
    },
    server: {
        port: 3829,
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 10,
        },
    },
});

const __sys__ = global.__sys__ as XyPrissSys;

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello " });
});

app.start();


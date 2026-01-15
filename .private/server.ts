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
        lifecycle: {},
        networkQuality: {},
        resilience: {
            circuitBreaker: 
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
    console.log("Request received on /");
    res.xJson({ message: "Hello world from XP" });
});

app.post("/", (req, res) => {
    console.log("Request POST method with data: ", req.body);
    res.xJson({ message: "Hello world from XP" });
});

app.start();


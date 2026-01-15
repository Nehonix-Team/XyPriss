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

console.log(__sys__.$temp());

__sys__.$monitor(60);

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello " });
});

app.start();


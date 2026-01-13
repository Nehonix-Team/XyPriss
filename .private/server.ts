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
        serviceName: "oaiz zele",
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 10,
        },
    },

    multiServer: {
        enabled: false,
        servers: [
            {
                port: 6373,
                id: "test",
                routePrefix: "/test",
                server: {
                    autoParseJson: true,
                },
            },
        ],
    },
});

const __sys__ = global.__sys__ as XyPrissSys;

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello " });
});

app.start();


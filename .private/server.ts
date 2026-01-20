import { createServer, Plugin, Router, XyPrissSys } from "../src/index";
import { ORFOF } from "./otherRouterFromFile";

// Test Configuration
const app = createServer({
    server: {
        port: 6372,
        autoPortSwitch: { enabled: true },
    },

    plugins: {},
    // MultiServer config to test the config fixes
    multiServer: {
        enabled: true,
        servers: [
            {
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
});

const __sys__ = global.__sys__ as XyPrissSys;

// Test Router Middleware Path Fix
const router = Router();
router.get("/test", (req, res) => res.send("Main Router OK"));
router.use("/orfof", ORFOF);

app.use(router);

app.get("/error", (req, res) => {
    b
});

app.start().then(() => {
    console.log("--- MULTISERVER TEST READY ---");
});


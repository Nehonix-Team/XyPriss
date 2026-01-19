import { createServer, Router, XyPrissSys } from "../src/index";
import { ORFOF } from "./otherRouterFromFile";

// Test Configuration
const app = createServer({
    server: {
        port: 6372,
        autoPortSwitch: { enabled: true },
    },
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

router.use("/orfof", ORFOF);

app.use("/", router);

app.start();


import { createServer } from "../src/index";

const app = createServer({
    server: {
        port: 8086,
    },
    security: {
        rateLimit: {
            max: 2, // Very low limit for testing
            windowMs: 60 * 1000,
            excludePaths: [], // No exclusions
        },
    },
    logging: {
        level: "debug",
    },
});

app.get("/test", (req, res) => {
    res.json({ message: "OK" });
});

app.start();


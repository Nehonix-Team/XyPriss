import { createServer } from "../src";

const app = createServer({
    server: {
        port: 3002,
        trustProxy: ['loopback', 'uniquelocal']
    },
    logging: {
        enabled: true,
        level: 'debug'
    }
});

// Test endpoint to verify query parameter parsing
app.get("/test-query", (req: any, res: any) => {
    res.json({
        message: "Query parameter parsing test",
        query: req.query,
        path: req.path,
        originalUrl: req.originalUrl,
        method: req.method,
        queryKeys: Object.keys(req.query || {}),
        queryCount: Object.keys(req.query || {}).length
    });
});

console.log("Starting query parameter test server on port 3002...");
app.start();

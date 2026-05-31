import { createServer } from "xypriss";

const app = createServer({
    server: {
        port: 8093,
    },
    static: {},
    security: {
        enabled: false,
    },
});

app.get("/api/data", (req, res) => {
    res.send({
        status: "ok",
        message: "Hello from XyPriss",
        timestamp: Date.now(),
    });
});

app.start();


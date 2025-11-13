import { createServer } from "../src";
import { testRouter } from "./test-router";

export const app = createServer({
    server: {
        port: 3001,
        // trustProxy: true, // Enable trust proxy for Nginx reverse proxy
    },
    security: {
        cors: {
            origin: ["localhost:*", "127.0.0.1:*", "::1:*", "*.test.com"],
        },
    },
});

app.use("/api", testRouter);

console.log("Starting upload test server on port 3001...");
app.start();



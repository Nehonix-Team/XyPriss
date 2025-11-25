import { createServer } from "../src";
import { testRouter } from "./test-router";

export const app = createServer({
    server: {
        port: 3001,
        // trustProxy: true, // Enable trust proxy for Nginx reverse proxy
    },
    security: {

        rateLimit: {
            max: 300,
            windowMs: 60 * 1000, // 1 minute
            message: {
                error: "Rate limit exceeded",
                message: "Salut cc, ce-ci est un rate-limite.",
                retryAfter: 60
            },
        },
    },
    network: {
        proxy: {
            
        }
    }
});

app.use("/api", testRouter);

console.log("Starting upload test server on port 3001...");
app.start();


import { createServer } from "../src";
import { testRouter } from "./test-router";

export const app = createServer({
    server: {
        port: 3001,
        host: "192.168.0.46",
        // trustProxy: true, // Enable trust proxy for Nginx reverse proxy
    },
    security: {
        rateLimit: {
            max: 300,
            windowMs: 60 * 1000, // 1 minute
            message: {
                error: "Rate limit exceeded",
                message: "Salut cc, ce-ci est un rate-limite.",
                retryAfter: 60,
            },
        },

        // Test deviceAccess configuration (unified device control)
        deviceAccess: {
           
            browserOnly: {
                enable: false,

            },
            terminalOnly: {
                enable: false,
            },
            mobileOnly: {
                enable: true,
                debug: true,
                allowedPlatforms: ["ios", "android", "react-native", "expo"],
                blockBrowserIndicators: false,
                // requireMobileHeaders: false,
                errorMessage:
                    "Mobile app access required - browser requests blocked",
            },
        },
    },
});

app.use("/api", testRouter);

console.log("Starting upload test server on port 3001...");
app.start();


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
        requestSignature: {
            disableRateLimiting: true,
            secret: "fcfa6c5d6d1dce910f543a9b3f17be0d67718b6f335f4fa0d55b32960a89f33a",
            // Configure rate limiting options
            maxFailedAttempts: 3, // Increase threshold
            blockDuration: 0 * 10 * 1000, // 10s block duration
            // disableRateLimiting: true, // Uncomment to disable rate limiting entirely
            rateLimitScaleFactor: 2.0, // Double the thresholds
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
                enable: false,
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


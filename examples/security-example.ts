/**
 * XyPriss Security Configuration Example
 * Demonstrates how to use the security configuration option
 */

import { createServer } from "../src/server/ServerFactory";
import axios from "axios";

// Example 1: Basic security configuration
const app = createServer({
    server: {
        port: 3001,
        host: "localhost",
        autoPortSwitch: {
            enabled: true,
        },
    },
    cluster: {
        enabled: true,
    },
    security: {
        enabled: true,
        level: "enhanced",
        csrf: true,
        helmet: true,
        xss: true,
        bruteForce: true,
        sqlInjection: true,
    },
    logging: {
        enabled: true,
        level: "verbose",
        types: { debug: true },
        componentLevels: {
            cluster: {
                enabled: true,
                types: {
                    startup: true,
                    warnings: true,
                    errors: true,
                    performance: true,
                    debug: true,
                    hotReload: true,
                    portSwitching: true,
                },
                // Suppress specific message patterns you don't want to see
                suppressPatterns: [
                    /Memory Alert: High system memory usage/,
                    /Memory Alert: Critical system memory usage/,
                    /UFSIMC-WARNING: Using generated key/,
                    /\[.*\] stderr: \[SECURITY\] UFSIMC-WARNING/,
                    /stderr: \[SECURITY\] UFSIMC-WARNING/,
                ],
            },
            security: {
                enabled: true,
                suppressPatterns: [
                    /UFSIMC-WARNING: Using generated key/,
                    /For production, set ENV variables/,
                ],
            },
            memory: {
                enabled: true,
                suppressPatterns: [
                    /High system memory usage/,
                    /Critical system memory usage/,
                ],
            },
        },
    },
});

// Security is configured in the createServer options above (lines 23-30)
// No additional middleware needed for XyPriss server

// Add some routes to demonstrate security features
app.get("/", (req, res) => {
    res.json({
        message: "Hello from XyPriss with basic security!",
        security: "enabled",
        level: "enhanced",
        query: req.query, // This will show if XSS is sanitized
    });
});

app.post("/test", (req, res) => {
    res.json({
        message: "POST request processed",
        body: req.body, // This will show if injection attempts are sanitized
        security: "active",
    });
});

app.post("/api/data", (req, res) => {
    // This route will be protected by CSRF, XSS filtering, etc.
    res.json({
        message: "Data received securely",
        data: req.body,
        timestamp: new Date().toISOString(),
    });
});

// Start servers (uncomment to run)
app.start();
// maxSecurityServer.start();
// customSecurityServer.start();

// setTimeout(async () => {
//     await app.waitForReady();

//     const lim = 100;
//     for (let x = 0; x < lim; x++) {
//         try {
//             const res = await axios.get("http://localhost:3001");
//             console.log("response: ", res.data);
//         } catch (error) {
//             console.error("[TEST ERR]: ", error);
//         }
//     }
// }, 20000);


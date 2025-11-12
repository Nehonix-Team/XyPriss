import { createServer } from "../src";
import { testRouter } from "./test-router";

// Production-like trust proxy configuration
export const app = createServer({
    server: {
        port: 3001,
        // More specific trust proxy configuration for production
        trustProxy: [
            'loopback',           // Trust localhost/127.0.0.1
            'linklocal',          // Trust link-local addresses
            'uniquelocal',        // Trust unique local addresses
            '10.0.0.0/8',        // Trust private network 10.x.x.x
            '172.16.0.0/12',     // Trust private network 172.16-31.x.x
            '192.168.0.0/16',    // Trust private network 192.168.x.x
            // Add your specific proxy server IPs here
            // '203.0.113.0/24',  // Example: Trust specific subnet
        ],
    },
    security: {
        cors: {
            origin: ["localhost:*", "127.0.0.1:*", "::1:*", "*.test.com"],
        },
    },
    logging: {
        enabled: true,
        level: 'debug', // Enable debug logging to see trust proxy decisions
    }
});

app.use("/api", testRouter);

// Add middleware to log trust proxy decisions
app.use((req: any, res: any, next: any) => {
    console.log(`[TRUST-PROXY] IP: ${req.ip}, IPs: [${req.ips.join(', ')}], Protocol: ${req.protocol}, Secure: ${req.secure}`);
    console.log(`[TRUST-PROXY] X-Forwarded-For: ${req.headers['x-forwarded-for'] || 'none'}`);
    console.log(`[TRUST-PROXY] X-Forwarded-Proto: ${req.headers['x-forwarded-proto'] || 'none'}`);
    next();
});

console.log("Starting production-like test server on port 3001...");
console.log("Trust proxy configuration:", app.get('trust proxy fn'));
app.start();

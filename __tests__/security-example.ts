/**
 * XyPriss Security Configuration Example
 * Demonstrates how to use the security configuration option
 */

import { createServer } from "../src/server/ServerFactory";

// Example 1: Basic security configuration
const basicSecurityServer = createServer({
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
    },
    logging: {
        enabled: true,
        types: {
            debug: true,
            portSwitching: true,
        },
        components: {},
    },
});

// Example 2: Maximum security configuration
const maxSecurityServer = createServer({
    server: {
        port: 3002,
        host: "localhost",
    },
    security: {
        enabled: true,
        level: "maximum",
        csrf: true,
        helmet: true,
        xss: true,
        sqlInjection: true,
        bruteForce: true,
        encryption: {
            algorithm: "AES-256-GCM",
            keySize: 32,
        },
        authentication: {
            jwt: {
                secret: "your-super-secret-jwt-key",
                expiresIn: "24h",
                algorithm: "HS256",
            },
            session: {
                secret: "your-super-secret-session-key",
                name: "secure.sid",
                cookie: {
                    maxAge: 24 * 60 * 60 * 1000, // 24 hours
                    secure: true,
                    httpOnly: true,
                    sameSite: "strict",
                },
            },
        },
    },
    logging: {
        enabled: true,
        level: "debug",
    },
});

// Example 3: Custom security configuration
const customSecurityServer = createServer({
    server: {
        port: 3003,
        host: "localhost",
    },
    security: {
        enabled: true,
        level: "basic",
        csrf: false, // Disable CSRF for API-only server
        helmet: true,
        xss: true,
        sqlInjection: true,
        bruteForce: true,
    },
    logging: {
        enabled: true,
        level: "info",
    },
});

// Add some routes to demonstrate security features
basicSecurityServer.get("/", (req, res) => {
    res.json({
        message: "Hello from XyPriss with basic security!",
        security: "enabled",
        level: "enhanced",
    });
});

basicSecurityServer.post("/api/data", (req, res) => {
    // This route will be protected by CSRF, XSS filtering, etc.
    res.json({
        message: "Data received securely",
        data: req.body,
        timestamp: new Date().toISOString(),
    });
});

maxSecurityServer.get("/", (req, res) => {
    res.json({
        message: "Hello from XyPriss with maximum security!",
        security: "maximum",
        features: [
            "CSRF",
            "Helmet",
            "XSS",
            "SQL Injection",
            "Brute Force",
            "Encryption",
        ],
    });
});

customSecurityServer.get("/api/status", (req, res) => {
    res.json({
        message: "API server with custom security",
        security: "basic",
        csrf: false,
        timestamp: new Date().toISOString(),
    });
});

// Start servers (uncomment to run)
basicSecurityServer.start();
maxSecurityServer.start();
customSecurityServer.start();

export { basicSecurityServer, maxSecurityServer, customSecurityServer };


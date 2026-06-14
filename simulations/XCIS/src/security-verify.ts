import { createServer, Send, XStatic } from "xypriss";

const app = createServer({
    security: {
        honeypotTarpit: false,
        xss: {
            enabled: true,
            blockOnDetection: true,
            message: "XSS Blocked",
            statusCode: 403,
        },
        slowDown: {
            enabled: true,
            windowMs: 60000,
            delayAfter: 1,
            delayMs: () => 1000,
        },
        xxe: {
            enabled: true,
            blockOnDetection: true,
            message: "XXE Blocked",
            statusCode: 403,
        },
        hpp: {
            enabled: true,
            checkBody: true,
            checkQuery: true,
        },
        helmet: {
            enabled: true,
            xssFilter: true,
            noSniff: true,
            hsts: { maxAge: 31536000, includeSubDomains: true },
        },
        cors: {
            enabled: true,
            origin: "http://allowed.com",
        },
        csrf: {
            enabled: true,
            cookieName: "csrf-token",
            ignoredMethods: ["GET", "OPTIONS"],
            secret: "this-is-a-very-secret-key-12345",
            cookieOptions: { secure: false },
        },
        rateLimit: {
            enabled: true,
            max: 2, // Allow 2 to test slowdown vs ratelimit
            windowMs: 60000,
            message: "RateLimit Blocked",
        },
        commandInjection: {
            enabled: true,
            blockOnDetection: true,
            message: "CmdInject Blocked",
            statusCode: 403,
        },
        sqlInjection: {
            enabled: true,
            blockOnDetection: true,
            message: "SQLi Blocked",
            statusCode: 403,
        },
        pathTraversal: {
            enabled: true,
            blockOnDetection: true,
            message: "PathTraversal Blocked",
            statusCode: 403,
        },
        routeConfig: {
            xss: {
                excludeRoutes: ["/ping"],
            },
            commandInjection: {
                includeRoutes: ["/ping"], // only apply cmd inject to /ping
            }
        }
    },
});

app.get("/ping", (req, res) => {
    res.send({ status: "ok", query: req.query });
});

app.post("/submit", (req, res) => {
    res.send({ status: "submitted", body: req.body });
});

app.get("/csrf-token", (req, res) => {
    const token = req.headers["x-csrf-token"] || (req as any).csrfToken?.() || "no-token";
    res.send({ token });
});

app.start();

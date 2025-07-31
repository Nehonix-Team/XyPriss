import { createServer, func, Hash, fObject, writeFileCache } from "..";

const app = createServer({
    performance: {
        optimizationEnabled: true,
    },
    server: {
        autoPortSwitch: {
            enabled: true,
            maxAttempts: 5,
            strategy: "increment",
            onPortSwitch: (originalPort, newPort) => {
                app.forceClosePort(originalPort);
                console.log(
                    `✔ Port switched from ${originalPort} to ${newPort}`
                );
            },
        },
    },

    logging: {
        level: "info",
    },
});

// app.forceClosePort(5173);

// Test Bug 1: Middleware should execute on every request
console.log("Testing 1: Middleware execution");
const middleware = app.middleware({
    rateLimit: false,
});

// FIXED: Proper middleware that calls next() instead of ending response
middleware.register((req, res, next) => {
    console.log(
        `🔄 Middleware executed: ${req.method} ${
            req.path
        } at ${new Date().toISOString()}`
    );
    next(); // CRITICAL: Call next() to continue the chain
});

// Test Bug 2: Route caching issues
console.log("Testing 2: Route response caching");
app.get("/api/user-config", (req, res) => {
    const timestamp = new Date().toISOString();
    const message = `hello world! Current time: ${timestamp} meklo`;
    console.log(`📤 Sending response: ${message}`);
    res.send(message);
});

// Additional test routes
app.get("/test/middleware", (req, res) => {
    res.json({
        message: "Middleware test route",
        timestamp: Date.now(),
        path: req.path,
    });
});

app.get("/test/no-cache", (req, res) => {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.json({
        message: "No cache route",
        timestamp: Date.now(),
        random: Math.random(),
    });
});

console.log("Starting server...");

app.start(3930, async () => {
    const actualPort = app.getPort();
    console.log("\n✔ Server started! Test the following:");
    console.log(
        `🔗 http://localhost:${actualPort}/api/user-config (should show timestamp and middleware log)`
    );
    console.log(
        `🔗 http://localhost:${actualPort}/test/middleware (should show middleware log)`
    );
    console.log(
        `🔗 http://localhost:${actualPort}/test/no-cache (should not be cached)`
    );

    // ✔ ADVANCED: Set up multiple redirect modes for testing
    console.log("\n🔄 Setting up advanced redirects...");

    try {
        // 1. Message mode redirect
        const messageRedirect = await app.redirectFromPort(6373, actualPort, {
            mode: "message",
            enableLogging: true,
            customHeaders: {
                "X-Redirect-Type": "Message Mode",
                "X-Original-Port": "6373",
            },
        });

        if (messageRedirect) {
            console.log(`✔ Message redirect: 6373 → ${actualPort}`);
            console.log(
                "🔗 REDIRECT (Message): http://localhost:6373/api/user-config"
            );
        }

        // 2. Transparent mode redirect
        const transparentRedirect = await app.redirectFromPort(
            5173,
            actualPort,
            {
                mode: "message",
                enableLogging: true,
                enableStats: true,
                enableCors: true,
                customHeaders: {
                    "X-Redirect-Type": "Transparent Mode",
                    "X-Original-Port": "5173",
                },
            }
        );

        if (transparentRedirect) {
            console.log(`✔ Transparent redirect: 5173 → ${actualPort}`);
            console.log(
                "🔗 REDIRECT (Transparent): http://localhost:5173/api/user-config"
            );
        }

        // 3. HTTP redirect mode
        const httpRedirect = await app.redirectFromPort(7373, actualPort, {
            mode: "redirect",
            redirectStatusCode: 302,
            enableLogging: true,
            customHeaders: {
                "X-Redirect-Type": "HTTP Redirect",
                "X-Original-Port": "7373",
            },
        });

        if (httpRedirect) {
            console.log(`✔ HTTP redirect: 7373 → ${actualPort}`);
            console.log(
                "🔗 REDIRECT (HTTP 302): http://localhost:7373/api/user-config"
            );
        }

        console.log(
            "\n Active redirects: " + app.getAllRedirectInstances().length
        );
    } catch (redirectError: any) {
        console.log(`⚠️  Redirect setup error: ${redirectError.message}`);
    }

    console.log("\n📝 Expected behavior:");
    console.log("1. Middleware should log on EVERY request");
    console.log("2. Route responses should update immediately");
    console.log("3. Timestamps should be different on each request");
    console.log("4. Message redirect (6373) shows custom message");
    console.log("5. Transparent redirect (5173) works like direct access");
    console.log("6. HTTP redirect (7373) sends browser redirect");
});

import { createServer } from "../src";

const app = createServer({
    notFound: {},
    security: {
        enabled: true,
        xss: true,
        sqlInjection: true,
        pathTraversal: true,
        commandInjection: true,
        rateLimit: {
            windowMs: 60000,
            max: 100, // Increased for testing
            message: "Rate limit exceeded",
        },
    },
    logging: {
        // level: "debug",
        // components: {
        //     security: true,
        //     server: true,
        //     routing: true,
        //     middleware: true,
        //     userApp: true,
        //     plugins: true,
        // },
        // types: { debug: true },
    },
    plugins: {
        register: [
            {
                name: "test-plg",
                version: "1.0.0",
                description: "Test plugin for new hooks",
                onRegister(server, config) {
                    console.log("Plugin registered!");
                },
                onSecurityAttack(attackData, req, res) {
                    console.log("🚨 Hook: onSecurityAttack", attackData.type);
                },
                onResponseTime(responseTime, req, res) {
                    console.log(
                        `⏱️ Hook: onResponseTime - ${responseTime.toFixed(2)}ms`
                    );
                },
                onRouteError(error, req, res) {
                    console.log("❌ Hook: onRouteError", error.message);
                },
                onRateLimit(limitData, req, res) {
                    console.log("🚫 Hook: onRateLimit");
                },
            },
        ],
    },
});

app.get("/", (req, res) => {
    res.json({
        message: "Hello from XyPrissJS!",
        hooks: "Testing new developer hooks",
    });
});

// Route to test onResponseTime hook
app.get("/slow", async (req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 1300));
    res.json({ message: "This was a slow request" });
});

// Route to test onRouteError hook
app.get("/error", (req, res) => {
    throw new Error("Test error for onRouteError hook");
});

// Route to test security (XSS)
app.get("/security", (req, res) => {
    res.json({ message: "Security test route", query: req.query });
});

app.start();


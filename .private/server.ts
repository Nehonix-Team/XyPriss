import { createServer } from "../src";
import { PluginHookIds } from "../src/plugins/const/PluginHookIds";

const app = createServer(
    __const__.$cfg({
        server: {
            port: 8085,
            trustProxy: true,
        },
        notFound: {},
        security: {
            enabled: true,
            xss: true,
            sqlInjection: true,
            pathTraversal: true,
            commandInjection: true,
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
        pluginPermissions: [
            {
                name: "test-plg",
                allowedHooks: [
                    PluginHookIds.ON_REGISTER,
                    PluginHookIds.ON_SERVER_START,
                    PluginHookIds.ON_SECURITY_ATTACK,
                    PluginHookIds.ON_RESPONSE_TIME,
                    PluginHookIds.ON_ROUTE_ERROR,
                    PluginHookIds.ON_RATE_LIMIT,
                    PluginHookIds.ON_SERVER_READY,
                ],
            },
        ],
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
                        console.log(
                            "🚨 Hook: onSecurityAttack",
                            attackData.type
                        );
                    },
                    onResponseTime(responseTime, req, res) {
                        console.log(
                            `⏱️ Hook: onResponseTime - ${responseTime.toFixed(
                                2
                            )}ms`
                        );
                    },
                    onRouteError(error, req, res) {
                        console.log("❌ Hook: onRouteError", error.message);
                    },
                    onRateLimit(limitData, req, res) {
                        console.log("🚫 Hook: onRateLimit");
                    },
                    onServerReady(server) {
                        console.log("✅ Hook: onServerReady");
                    },
                },
            ],
        },
    })
);

// Route to test onResponseTime hook
app.get("/", (req, res) => {
    res.json({ message: "Hello World" });
});

// Route to test slow response
app.get("/slow", async (req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    res.json({ message: "This was a slow request" });
});

// Route to test onRouteError hook
app.get("/error", (req, res) => {
    throw new Error("Test error for onRouteError hook");
});

// Route to test onSecurityAttack hook (XSS)
app.get("/security", (req, res) => {
    res.send(`Query: ${req.query.q}`);
});

app.start();



import { createServer } from "../src";

const server = createServer({
    server: {
        port: 8085,
    },
    security: {
        enabled: true,
        sqlInjection: true,
        xss: { blockOnDetection: true },
    },
    performance: {
        slowRequestThreshold: 500,
    },
    plugins: {
        register: [
            {
                name: "test_hooks",
                version: "1.0.0",
                onServerStart(server) {
                    // console.log("Plugin started");
                },
                onServerStop(server) {
                    console.log(":🤧 Server arrêté");
                },
                onResponse(req, res) {
                    // console.log("onResponse called");
                },
                onSecurityViolation(violation, req, res) {
                    console.log(
                        "🛡️ [SECURITY VIOLATION]",
                        violation.type,
                        JSON.stringify(violation.details)
                    );
                },
                onRouteError(error, route, req, res) {
                    console.log("⚡ [ROUTE ERROR]", route.path, error.message);
                },
                onSlowRequest(duration, req, res, route) {
                    console.log(
                        "⏱️ [SLOW REQUEST]",
                        route.path,
                        `${duration}ms`
                    );
                },
            },
        ],
    },
});

server.get("/", (req, res) => {
    res.send("Hello World");
});

server.get("/error", (req, res) => {
    throw new Error("Test error hook");
});

server.get("/slow", async (req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    res.send("Slow response");
});

server.start(undefined, () => {
    console.log(":🥲 Server démarré");
    console.log("Server running on localhost:8085");
});


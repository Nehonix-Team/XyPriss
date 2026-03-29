import { createServer } from "../src/index";

const app = createServer({
    server: { port: 8086 },
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "api-v1",
                port: 8087,
                routePrefix: "/api/v1",
                routePrefixStrategy: "auto-inject",
            },
            {
                id: "api-v2",
                port: 8088,
                routePrefix: "/api/v2",
                routePrefixStrategy: "strict-match",
            },
            {
                id: "api-v3",
                port: 8089,
                routePrefix: "/api/v3",
                routePrefixStrategy: "both",
            },
        ],
    },
});

// A route that uses standard path (unprefixed)
app.post("/test-json", (req, res) => {
    res.json({ received: req.body });
});

// A route that explicitly starts with /api/v2
app.post("/api/v2/explicit", (req, res) => {
    res.json({ explicit: "yes" });
});

app.start(async () => {
    setTimeout(async () => {
        try {
            console.log("\n--- Testing JSON Resilience ---");
            // Send bad JSON (unquoted keys, single quotes)
            const badJson = `{ businessName: 'Val', age: 30, }`;
            const r1 = await fetch("http://localhost:8087/api/v1/test-json", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: badJson,
            });
            console.log("resilient parse v1 ->", await r1.json());

            console.log("\n--- Testing Route Strategy: auto-inject (v1) ---");
            const rV1 = await fetch("http://localhost:8087/api/v1/test-json", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: "{}",
            });
            console.log("v1 auto-inject status:", rV1.status); // Should be 200

            console.log("\n--- Testing Route Strategy: strict-match (v2) ---");
            const rV2_no_match = await fetch(
                "http://localhost:8088/api/v2/test-json",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                },
            );
            console.log(
                "v2 strictly-match auto-injected route status:",
                rV2_no_match.status,
            ); // Should be 404

            const rV2_match = await fetch(
                "http://localhost:8088/api/v2/explicit",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                },
            );
            console.log(
                "v2 strict-match explicit route status:",
                rV2_match.status,
            ); // Should be 200

            console.log("\n--- Testing Route Strategy: both (v3) ---");
            const rV3_prefixed = await fetch(
                "http://localhost:8089/api/v3/test-json",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                },
            );
            console.log("v3 prefixed route status:", rV3_prefixed.status); // Should be 200

            const rV3_unprefixed = await fetch(
                "http://localhost:8089/test-json",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: "{}",
                },
            );
            console.log("v3 un-prefixed route status:", rV3_unprefixed.status); // Should be 200
        } catch (e) {
            console.error(e);
        } finally {
            process.exit(0);
        }
    }, 2000);
});


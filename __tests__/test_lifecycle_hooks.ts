import { createServer, Plugin } from "../src";

console.log("=".repeat(60));
console.log("🧪 TEST: Plugin API - ALL Lifecycle Hooks");
console.log("=".repeat(60));

let executionOrder: string[] = [];

const lifecyclePlugin = Plugin.create({
    name: "lifecycle-test",
    version: "1.0.0",

    onServerStart(server) {
        executionOrder.push("onServerStart");
        console.log("✅ onServerStart called");
    },

    onServerReady(server) {
        executionOrder.push("onServerReady");
        console.log("✅ onServerReady called");
    },

    onRequest(req, res, next) {
        executionOrder.push("onRequest");
        console.log("✅ onRequest called for:", req.url);
        next();
    },

    onResponse(req, res) {
        executionOrder.push("onResponse");
        console.log("✅ onResponse called for:", req.url);
    },

    onError(error, req, res, next) {
        executionOrder.push("onError");
        console.log("✅ onError called:", error.message);
        res.status(500).json({ error: "Handled by plugin" });
    },

    onServerStop(server) {
        executionOrder.push("onServerStop");
        console.log("✅ onServerStop called");
    },

    registerRoutes(app) {
        executionOrder.push("registerRoutes");
        console.log("✅ registerRoutes called");
    },
});

console.log("\n📝 Registering plugin with Plugin.exec()...");
Plugin.exec(lifecyclePlugin);

console.log("📝 Creating server...\n");
const app = createServer({});

app.get("/test", (req, res) => {
    res.json({ message: "OK" });
});

app.get("/error", (req, res) => {
    throw new Error("Test error");
});

app.start(8080, async () => {
    console.log("\n🚀 Server started!\n");

    // Test normal request
    console.log("📝 Test 1: Normal request");
    const res1 = await fetch("http://localhost:8080/test");
    console.log("Response:", await res1.json());

    // Test error
    console.log("\n📝 Test 2: Error handling");
    const res2 = await fetch("http://localhost:8080/error");
    console.log("Response status:", res2.status);
    console.log("Response:", await res2.json());

    // Validation
    setTimeout(() => {
        console.log("\n" + "=".repeat(60));
        console.log("📊 RESULTS");
        console.log("=".repeat(60));
        console.log("Execution order:", executionOrder);

        const expected = [
            "onServerStart",
            "registerRoutes",
            "onServerReady",
            "onRequest", // /test
            "onResponse", // /test
            "onRequest", // /error
            "onError", // /error
        ];

        console.log("\nExpected:", expected);
        console.log("Got:     ", executionOrder);

        // Analyse des hooks manquants
        const missing = expected.filter((h) => !executionOrder.includes(h));
        const extra = executionOrder.filter((h) => !expected.includes(h));

        if (missing.length > 0) {
            console.log("\n❌ Missing hooks:", missing);
        }
        if (extra.length > 0) {
            console.log("\n⚠️  Extra hooks:", extra);
        }

        const isValid =
            JSON.stringify(executionOrder) === JSON.stringify(expected);
        console.log(
            "\n" + (isValid ? "✅ ALL TESTS PASSED" : "❌ TEST FAILED")
        );
        console.log("=".repeat(60));

        process.exit(isValid ? 0 : 1);
    }, 1000);
});


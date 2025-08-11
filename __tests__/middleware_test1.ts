/**
 * Simple middleware test to verify the middleware chain fix
 */

import { XyprissApp } from "../src/server/core/XyprissApp";
import { Logger } from "../shared/logger/Logger";

console.log("Creating simple test server...");

// Create a simple logger
const logger = new Logger({
    enabled: true,
    level: "debug",
    consoleInterception: { enabled: false },
});

// Create app
const app = new XyprissApp(logger);

console.log("App created, registering middleware...");

// Test middleware that calls next() - should continue
app.use((_req: any, _res: any, next?: any) => {
    console.log("🔵 USER MIDDLEWARE 1: This middleware calls next()");
    next?.(); // Call next to continue
});

// Test middleware that DOES NOT call next() - should STOP the chain
app.use((_req: any, _res: any, next?: any) => {
    console.log(
        "🔴 USER MIDDLEWARE 2: This middleware does NOT call next() - CHAIN SHOULD STOP HERE!"
    );
    // Intentionally NOT calling next() - this should stop the middleware chain
    // The route handler should NOT be executed
});

console.log("Middleware registered, registering route...");

app.get("/", (_req, res) => {
    console.log(
        "❌ Route handler called! This should NOT happen if middleware chain stopped correctly!"
    );
    res.json({
        message:
            "This response should NOT be sent if middleware works correctly!",
    });
});

console.log("Route registered, starting server...");

app.listen(8888, () => {
    console.log("🚀 Simple test server running on localhost:8888");
    console.log("📝 Test: Make a request to http://localhost:8888/");
    console.log(
        "📝 Expected: Request should hang/timeout because middleware doesn't call next()"
    );
    console.log(
        "📝 If you see the route handler message, the middleware fix is NOT working!"
    );
});


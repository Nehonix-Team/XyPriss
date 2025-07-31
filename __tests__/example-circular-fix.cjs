/**
 * Example demonstrating the circular reference fix in XyPrissSecurity
 */

const { createServer } = require("../../dist/cjs/index.js");

// Create server with safe JSON handling
const app = createServer({
    server: {
        port: 3000,
    },
    env: "development", // This enables circular reference logging
});

// Middleware that adds circular references to demonstrate the fix
app.use((req, res, next) => {
    console.log("🎯 MIDDLEWARE HIT: BEFORE ROUTE");

    // Create a circular reference in the request object
    req.circularRef = req;
    req.customData = {
        timestamp: Date.now(),
        self: req,
        nested: {
            parent: req,
            data: "test",
        },
    };

    next();
});

// Route that returns an object with circular references
app.get("/", (req, res) => {
    console.log("🎯 ROUTE HIT: GET /");

    // Create an object with circular references
    const responseData = {
        message: "Hello World!",
        timestamp: Date.now(),
        request: {
            method: req.method,
            url: req.url,
            headers: req.headers,
            // This would normally cause a circular reference error
            fullRequest: req,
        },
        circular: {},
    };

    // Add circular reference
    responseData.circular.self = responseData;
    responseData.circular.request = req;

    // This should now work without throwing "JSON.stringify cannot serialize cyclic structures"
    res.json(responseData);
});

// Route that demonstrates complex circular structures
app.get("/complex", (req, res) => {
    console.log("🎯 ROUTE HIT: GET /complex");

    const complexObj = {
        id: "test-123",
        data: {
            nested: {
                deep: {
                    value: "test",
                },
            },
        },
        refs: [],
        request: req,
        response: res,
    };

    // Add multiple circular references
    complexObj.self = complexObj;
    complexObj.data.parent = complexObj;
    complexObj.refs.push(complexObj);
    complexObj.refs.push(complexObj.data);
    complexObj.refs.push(req);

    res.json({
        message: "Complex circular structure handled successfully!",
        data: complexObj,
        meta: {
            timestamp: Date.now(),
            circular: complexObj,
        },
    });
});

// Route to test error handling
app.get("/error-test", (req, res) => {
    console.log("🎯 ROUTE HIT: GET /error-test");

    // Create an object that's difficult to serialize
    const problematicObj = {
        buffer: Buffer.from("test"),
        date: new Date(),
        regex: /test/g,
        error: new Error("Test error"),
        function: () => "test",
        undefined: undefined,
        null: null,
        circular: {},
    };

    problematicObj.circular.self = problematicObj;

    res.json({
        message: "All problematic types handled!",
        data: problematicObj,
    });
});

// Start the server
app.start(undefined, () => {
    console.log("🚀 Server started on port:", app.getPort());
    console.log("📝 Test the circular reference fix:");
    console.log("   GET http://localhost:" + app.getPort() + "/");
    console.log("   GET http://localhost:" + app.getPort() + "/complex");
    console.log("   GET http://localhost:" + app.getPort() + "/error-test");
    console.log("");
    console.log(
        "✅ The server should handle all circular references automatically!"
    );
    console.log(
        "🔄 Watch for circular reference detection logs in development mode."
    );
});


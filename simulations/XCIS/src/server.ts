import { createServer, Plugin, Send, XStatic } from "xypriss";
import { router } from "./router";
import { XyphraPlugin } from "xyphra";
import { xms } from "./xms";
//
const app = createServer({
    multiServer: {
        enabled: true,
        servers: [xms],
    },
    security: {     
        xss: {
            blockOnDetection: true,
            message: "Salut c'est xss",
            statusCode: 500,
        },
        slowDown: {},
        xxe: {
            blockOnDetection: true,
        },
        hpp: {},
        helmet: {},
        cors: {},
        csrf: {
            cookieName: "__Host-csrf-token",
        },
        rateLimit: {
            max: 1,
            message: "salut ratelmilt",
        },

        commandInjection: {},
        sqlInjection: {},
        routeConfig: {},
        pathTraversal: {},
    },
});

app.use("/", router);

// console.log("manifest: ", __sys__.vars.get("manifest"));
// console.log("process env for PORT (server.ts): ", process.env.PORT);//should be blocked if not in whitelist for

// Instantiate the manager with application and system context
const xs = new XStatic(app, __sys__);

// Define a static route
xs.define("/static", "public");

app.get("/ping", (req, res) => {
    const send = new Send(res);
    console.log("path meta: ", {
        pathName: req.path,
        queries: req.query,
    });
    send.ok("pong");
});

// --- XML/JSON Conversion Tests ---

/**
 * Test 1: XML to JSON with Proxy Access
 * Send: <user id="123"><name>John</name></user>
 * Access: req.body.user.id (via Proxy)
 */
app.post("/xml-to-json", (req, res) => {
    console.log("Received Body:", JSON.stringify(req.body));

    // Accessing attributes via Proxy (without @)
    const userId = req.body.user?.id;
    const userName = req.body.user?.name;

    res.send({
        message: "Parsed successfully",
        detected: {
            userId,
            userName,
        },
        fullBody: req.body,
    });
});

/**
 * Test 2: Auto-Reply Transcoding
 * Send: <request><query>Hello</query></request>
 * Expect: XML response (autoReply: true mirrors origin format)
 * — We expose res headers so the test script can assert Content-Type: application/xml
 */
app.post("/xml-echo", (req, res) => {
    res.send({
        status: "success",
        echo: req.body,
        serverTime: new Date().toISOString(),
        receivedContentType: req.headers["content-type"], // explicit for test assertion
        originContentType: req.headers["x-xhsc-origin-content-type"],
    });
});

// Test route for IPC
app.get("/test-string", (req, res) => {
    res.send("Hello World IPC!");
});

app.get("/test-sendfile", async (req, res) => {
    await res.sendFile("package.json", { root: __sys__.__root__ });
});

app.get("/test-download", async (req, res) => {
    await res.sendFile("package.json", {
        root: __sys__.__root__,
        disposition: "attachment",
    });
});

app.get("/fast-static", async (req, res) => {
    await Promise.resolve();
    const worker = (app as any)._xhscWorker;
    if (worker) {
        worker.delegateStatic((req as any).id, "public/texte.txt");
        res.status(0).end();
    } else {
        res.status(500).send("No worker");
    }
});

app.get("/test-custom-headers", async (req, res) => {
    await res.sendFile("package.json", {
        root: __sys__.__root__,
        headers: {
            "X-Test": "Hello-XHSC",
        },
    });
});

// --- Response Control Dynamic Tests ---

// 1. Enable JSON 403 Response
app.get("/rc/json-403", (req, res) => {
    app.setResponseControl({
        enabled: true,
        statusCode: 403,
        content: {
            error: "Security Restriction",
            detail: "Access denied by ResponseControl",
        },
        contentType: "application/json",
    });
    res.send(
        "ResponseControl set to JSON 403. Try accessing any unknown route.",
    );
});

// 2. Enable Plain Text 410 Response
app.get("/rc/text-410", (req, res) => {
    app.setResponseControl({
        enabled: true,
        statusCode: 410,
        content: "This resource is gone forever.",
        contentType: "text/plain",
    });
    res.send(
        "ResponseControl set to Text 410. Try accessing any unknown route.",
    );
});

// 3. Enable Custom Handler
app.get("/rc/handler", (req, res) => {
    app.setResponseControl({
        enabled: true,
        handler: (req, res) => {
            res.status(200).send(
                `Captured 404 for: ${req.path}. We returned 200 just to be weird.`,
            );
        },
    });
    res.send(
        "ResponseControl set to Custom Handler (200 OK). Try accessing any unknown route.",
    );
});

// Disable Response Control (Back to default NotFound template)
app.get("/rc/disable", (req, res) => {
    app.setResponseControl({ enabled: false });
    res.send(
        "ResponseControl disabled. Back to default NotFound visual template.",
    );
});

// --- Security & CSRF Tests ---
app.get("/csrf-token", (req, res) => {
    // csrfToken() is injected by the doubleCsrf middleware
    console.log("req.csrfToken: ", req.csrfToken);
    const token = req.csrfToken ? req.csrfToken() : "no-token";
    res.send({ token });
});

app.post("/csrf-test", (req, res) => {
    res.send({ message: "CSRF check passed! The token was valid." });
});

app.start();



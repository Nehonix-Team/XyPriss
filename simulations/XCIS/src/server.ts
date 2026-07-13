import { createServer, Plugin, Send, XStatic, XyGuard, XServer } from "xypriss";
import { router } from "./router";
import { XyphraPlugin } from "xyphra";
import { xms } from "./xms";
import { XStringify } from "xypriss-security";
import { globGuards } from "./guards/auth.guard";

//
const app = createServer({
    server: {
        port: 8085,
        // xems: {
        //     persistence: {
        //         enabled: true,
        //         path: "./.private/vault.xems",
        //         secret: "abc2d4de394af9767d0b47ed679b",
        //     },
        // },
    },
    multiServer: {
        enabled: true,
        servers: [xms],
    },

    security: {
        enabled: true,
        rmXBranding: true,
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
      
        csrf: {
            trustedOrigins: [
                /127\.0\.0\.1:5500/, 
                // "localhost:5500"
            ],
        },
        rateLimit: {
            // max: 5,
            message: "salut ratelmilt",
        },

        commandInjection: {},
        sqlInjection: {},
        routeConfig: {},
        pathTraversal: {},
    },
});

// const server = XServer.create // pareil que "createServer"

app.use("/", router);
// XyGuard.define("testDeGuard", (req) => {
//     console.log("testDeGuard executed for path:", req.path);
//     return false;
// });

globGuards();

// const log = __sys__.utils.log
// log.group("Bootstrap", () => {
//     log.info("Loading environment variables");
//     log.info("Connecting to PostgreSQL");
//     log.success("All systems ready");
// });
// console.log("manifest: ", __sys__.vars.get("manifest"));
// console.log("process env for PORT (server.ts): ", process.env.PORT);//should be blocked if not in whitelist for

// Instantiate the manager with application and system context
const xs = new XStatic(app, __sys__);

// Define a static route
xs.define("/static", "public", { allowOutsideRoot: true, unsafe: true });

app.post("/hello", (rq, rs) => {
    rs.xJson({ hi: rq.body });
});
app.get("/ping", (req, res) => {
    const send = new Send(res);
    console.log("path meta: ", {
        pathName: req.path,
        queries: req.query,
    });
    send.ok("pong");
});

app.get("/test-mask-advanced", (req, res) => {
    res.send({
        status: "error",
        normalField: "Hello World",

        // stack trace classique
        testDbError:
            "database error: FATAL error occurred\nStack trace:\nline 1\nline 2\nfailed at line 45",

        // objet imbriqué -> testera le dot-path
        database: {
            host: "db.internal.example.com",
            credentials: {
                username: "admin",
                password: "S3cr3tP@ss!2024",
            },
        },

        // valeurs à détecter par pattern, peu importe le nom du champ
        contact: {
            supportEmail: "support@example.com",
            billingEmail: "billing@example.com",
        },
        userToken:
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0In0.abc123signature",
        clientIp: "192.168.1.42",
        card: {
            number: "4532 0151 1283 0366",
            holder: "John Doe",
        },

        // tableau d'objets -> testera la récursion sur []interface{}
        apiKeys: [
            { name: "prod", value: "sk_live_51Hf9k2LZQm3n4Ab" },
            { name: "staging", value: "sk_test_51Hf9k2LZQm3n4Cd" },
        ],
    });
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


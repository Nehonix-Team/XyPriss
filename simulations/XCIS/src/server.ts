/**
 * XyPriss Core Integration & Security Simulation Server (XCIS)
 *
 * Internal test harness for Nehonix engineering (CI, libXESS validation, and benchmarks).
 * Excluded from official releases. See `../README.md` for full architecture and telemetry details.
 *
 * @internal
 */
import {
    createServer,
    Plugin,
    Send,
    XStatic,
    XyGuard,
    XServer,
    Upload,
    getMimes,
    XyPrissRouter,
    __sys__,
} from "xypriss";
import { router } from "./router";
import { xms } from "./xms";
import { XStringify } from "xypriss-security";
import { globGuards } from "./guards/auth.guard";
import { getHostEnv } from "./getHostEnv";

//
const app = createServer({
    server: {
        port: 7628,
        autoKillConflict: true,
    },
    cluster: {
        enabled: false,
        workers: 4,
    },

    security: {},

    multiServer: {
        enabled: true,
        quietStartup: false,
        servers: [
            xms,
            {
                id: "xypriss.inter",
                port: 5628,
                server: {
                    autoKillConflict: true,
                },
                fileUpload: {
                    enabled: true,
                    destination: __sys__.path.resolve("public", "uploads"),
                    tempFileDir: __sys__.path.tmpUserDir + "/xcis_temp/",
                    useTempFiles: true,
                    maxFileSize: 15 * 1024 * 1024,
                    allowedExtensions: [
                        ".png",
                        ".jpg",
                        ".jpeg",
                        ".webp",
                        ".svg",
                        ".gif",
                        ".pdf",
                    ],
                    limits: { files: 5 },
                },
            },
        ],
    },
});

// ========================== pentesting: tentative de bypass
//  __sys__.__env__ pour avoir les valeurs du .env====================
// 1: avoir le contenu du .env
// 2: remplacer les clés par un préfix du whitelist "xypriss_"

console.log("session hash: ", __sys__.path.tmpUserDir);

console.log(
    "trying to get 'ALIAS' from the .env file without sys: ",
    getHostEnv("ALIAS"),
);
console.log(
    "😏 trying to get 'ALIAS' from the .env file using sys: ",
    __sys__.__env__.get("ALIAS"),
);
console.log(
    "trying to get 'AUTHOR' from the .env file without sys: ",
    getHostEnv("AUTHOR"),
);
console.log(
    "trying to get 'REDIS' from the .env file without sys: ",
    getHostEnv("REDIS"),
);
try {
    console.log(
        "raw fs.readFileSync of simulations/XCIS/.env (ALIAS):",
        require("fs")
            .readFileSync("simulations/XCIS/.env", "utf8")
            .split("\n")
            .filter((l: string) => l.includes("ALIAS"))[0],
    );
} catch (e: any) {
    console.log("raw read error:", e.message);
}

const data = {
    user: { name: "Alice", age: 30, password: "secret" },
    meta: { created: "2024-01-01", version: 2 },
};

__sys__.fs.tmp.write("data", {
    ttl: "10s",
});

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
    send.ok("pong");
});

app.post(
    "/test-ratelimit-custom",
    {
        rateLimit: {
            max: 2,
            window: "1m",
            keyBy(req: any, res: any) {
                // Manipulate req & res manually to extract custom key (e.g. from email in body)
                return req.body?.email || "anonymous";
            },
            message: "Trop de requêtes pour cet email",
        },
    } as any,
    (req, res) => {
        res.send({ status: "ok", email: req.body?.email });
    },
);

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

app.post("/upload", Upload.single("file"), (req, res) => {
    const rawFile = (req as any).file;
    console.log("ℹ️ rawFile:", JSON.stringify(rawFile, null, 2));
    res.json({
        success: true,
        message: "File uploaded successfully!",
        file: rawFile,
    });
});

app.post("/upload-multiple", Upload.array("files", 5), (req, res) => {
    const rawFiles = (req as any).files;
    res.json({
        success: true,
        message: "Multiple files uploaded successfully!",
        files: rawFiles,
        count: rawFiles?.length || 0,
    });
});

app.get("/upload-config", (req, res) => {
    const effectiveUploadConfig =
        (app as any).configs?.fileUpload ||
        (app as any).options?.fileUpload ||
        {};
    const resolvedAllowedMimes = getMimes(
        effectiveUploadConfig.allowedExtensions,
    );
    res.json({
        config: effectiveUploadConfig,
        resolvedAllowedMimes,
    });
});

app.get("/test-storage-mode", (req, res) => {
    const storageMode = (app as any).configs?.fileUpload?.storage || "disk";
    res.json({
        storage: storageMode,
        supportedModes: ["disk", "memory"],
        isSupported: ["disk", "memory"].includes(storageMode),
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

// --- XEMS cookieOptions test (issue #28) ---
app.post("/xems/login", async (req, res) => {
    const userData = { userId: 1, username: "xcis-test", role: "admin" };
    await (res as any).xLink(userData);
    res.json({ ok: true, session: userData });
});

app.get("/xems/me", (req, res) => {
    const session = (req as any).session;
    if (!session) {
        return res.status(401).json({ error: "No session" });
    }
    res.json({ session });
});

app.get("/xems/config", (_req, res) => {
    const xemsConfig =
        (app as any).config?.xems ?? (app as any).configs?.server?.xems ?? null;
    res.json({ xems: xemsConfig });
});

(app as any).start().then(() => {
    const xemsConfig =
        (app as any).config?.xems ?? (app as any).configs?.server?.xems ?? null;
    console.log("[XEMS] Resolved config:", JSON.stringify(xemsConfig, null, 2));
    console.log("[XEMS] Test commands:");
    console.log("  curl -i -X POST http://localhost:8085/xems/login");
    console.log("  curl -b cookie.txt http://localhost:8085/xems/me");
    console.log("  curl http://localhost:8085/xems/config");
});


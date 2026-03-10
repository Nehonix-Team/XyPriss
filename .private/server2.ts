import { createServer, XyPrissSys, __sys__ } from "../src";
import { testSConfigs2 } from "./configs";
import router from "./router";
import { logger } from "./testPlugin_Logger";

// Créez d'abord la configuration
 
// Gelez toute la configuration avant de la passer
const app = createServer({
    security: { 
        // Content-only bypass (XSS, SQLi, etc.) - Access control remains active
        _ignore: [
            // "/api/rich-text",
        ],
        // Total bypass (Security stack is completely disabled for these routes)
        _ignoreAll: [
            // "/webhook/payment",
            // /^\/internal\/.*$/
        ],
        routeConfig: {
            commandInjection: {},
        },
    },
    server: {
        xems: {
            cookieOptions: {},
            persistence: {
                enabled: true,
                path: ".vault.xems",
                secret: "8f2d6c1b9a5e4f0d3c7b2a1e6d9f8c0b",
                resources: {
                    cacheSize: 64,
                },
            },
        },
    },
});

// ── Test: res.html() ─────────────────────────────────────────────────────
app.get("/test/html", (req, res) => {
    res.html(`
        <!DOCTYPE html>
        <html>
        <head><title>XyPriss HTML Test</title></head>
        <body style="font-family: sans-serif; padding: 2rem; background: #1a1a2e; color: #eee;">
            <h1 style="color: #e94560;">🔥 res.html() works!</h1>
            <p>This page was served using <code>res.html()</code></p>
            <p>Request path: <strong>${req.path}</strong></p>
        </body>
        </html>
    `);
});

// ── Test: app.redirect() ─────────────────────────────────────────────────
app.redirect("/old-page", "/test/html");
app.redirect("/temp-redirect", "/test/html", 302);

// ── Test: req.redirect() ─────────────────────────────────────────────────
app.get("/test/req-redirect", (req, res) => {
    // Redirect using req.redirect instead of res.redirect
    req.redirect("/test/html");
});

app.get("/test/req-redirect-301", (req, res) => {
    req.redirect(301, "/test/html");
});

// ── Test: req.forward() ──────────────────────────────────────────────────
app.get("/test/forward", async (req, res) => {
    try {
        const data = await req.forward("/test/json");
        res.json({
            status: "Forwarded successfully",
            receivedData: data,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/test/forward-post", async (req, res) => {
    // Si on fait un POST sur ici, on forward sur /test/post-echo
    try {
        const data = await req.forward("/test/post-echo");
        res.json({
            status: "Forwarded POST successfully",
            echo: data,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/test/post-echo", (req, res) => {
    res.json({
        bodyReceived: req.body,
        method: req.method,
    });
});

// ── Test: res.json() (sanity check) ──────────────────────────────────────
app.get("/test/json", (req, res) => {
    res.json({
        message: "JSON response works",
        features: ["res.html()", "app.redirect()", "req.redirect()"],
        timestamp: new Date().toISOString(),
    });
});

// ── Test: __sys__.$write with ensureFile ──────────────────────────────────
app.get("/test/write", (req, res) => {
    try {
        const testPath = ".private/test-output/deep/nested/test.txt";
        __sys__.$write(testPath, `Written at ${new Date().toISOString()}\n`);
        res.json({
            success: true,
            path: testPath,
            message: "File written with auto directory creation",
        });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.start();


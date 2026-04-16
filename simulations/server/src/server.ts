import { createServer, getMimes, XyGuard } from "xypriss";
import { SwaggerPlugin } from "xypriss-swagger";
import { router } from "./router";
import { multiServer } from "./xms";
import { XStringify } from "xypriss-security";

const mimes = getMimes();
mimes.push("application/octet-stream");

import { UriNormalizer } from "../../../src/middleware/built-in/security/UriNormalizer";

const server = createServer({
    multiServer: multiServer,
    server: {
        port: 3728,
        trustProxy: ["loopback", "192.168.1.0/24"],
    },

    fileUpload: {
        enabled: true,
        maxFileSize: 1024 * 1024, // 1MB for testing
        maxFiles: 5,
        allowedExtensions: [
            ".jpg",
            ".png",
            ".webp",
            ".pdf",
            ".zip",
            ".docx",
            ".md",
        ],
        allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    },
    env: "test",
    security: {
        enabled: true,
    },
    logging: {
        level: "info",
        types: {
            debug: false,
        },
    },
    performance: {
        preAllocate: true,
    },
    plugins: {
        register: [
            SwaggerPlugin({
                port: 9282,
            }),
        ],
    },
});

// ─────────────────────────────────────────────
// XyGuard Resolvers Definition
// ─────────────────────────────────────────────

// Authentication resolver
XyGuard.define("authenticated", (req) => {
    return !!req.session?.user_id;
});

// Role-based access control resolver
XyGuard.define("roles", (req, requiredRoles) => {
    const userRole = req.session?.role;
    return requiredRoles.includes(userRole);
});

// Permission-based access control resolver
XyGuard.define("permissions", (req, requiredPermissions) => {
    const userPermissions = req.session?.permissions || [];
    return requiredPermissions.every((p: string) =>
        userPermissions.includes(p),
    );
});

console.log("[SERVER:SIMULATION] root path: ", __sys__.__root__);
console.log("[SERVER:SIMULATION] os temp path: ", __sys__.path.tmpUserDir);

// ─────────────────────────────────────────────
// Routing Modularization
// ─────────────────────────────────────────────

// Use the consolidated modular router
server.use(router);

// ─────────────────────────────────────────────
// Anti-ReDoS and Path Traversal Test Routes
// ─────────────────────────────────────────────
server.get("/api/regex-test", (req, res) => {
    // A classic ReDoS vulnerable regex
    const vulnerableRegex = /^(a+)+$/;
    const payload = req.query?.payload || "a".repeat(30) + "b";

    const startTime = Date.now();
    const isMatch = UriNormalizer.safeRegexCheck(vulnerableRegex, payload, 50);
    const duration = Date.now() - startTime;

    res.json({
        match: isMatch,
        durationMs: duration,
        payloadLength: payload.length,
    });
});

server.get("/api/templates/test", (req, res) => {
    res.json({
        msg: "Reached template route",
        path: req.path,
        originalUrl: req.originalUrl,
    });
});

// Start the server and wait for readiness
await server.start();

console.log(
    "[SERVER:SIMULATION] 🚀 All systems ready. Testing Hyper-Powerful FS Toolbox...",
);

try {
    const p = "open_close_api_testing.txt";
    __sys__.fs.writeIfNotExistsSync(p, "Hello world");
    // console.log("🤪p: ", p);

    await __sys__.fs.open(p, "r+", async (file) => {
        console.log("Opened handle:", file.nativeId);

        // Read first 10 bytes
        const header = await file.read(10);
        console.log("Read header:", header.toString("hex"));

        // Jump to the end and append data
        await file.seek(0, 2);
        await file.write(" [EOF SIGNATURE]");

        // Check final size with human readable format
        const stats = await file.stat();
        console.log("Final size:", __sys__.utils.num.formatBytes(stats.size));
        console.log("Final permissions:", stats);
        console.log(
            "modified at: ",
            __sys__.utils.date.format(stats.modified, "fr-FR"),
        );
        const data = await __sys__.utils.async.retry(
            async () => {
                const res = await fetch("http://localhost:3728/api/");
                if (res.status !== 200) throw new Error(`Status ${res.status}`);
                return res.status;
            },
            { maxAttempts: 5, delay: 100 },
        );
        // console.log("data status: ", data);
    });
    console.log(
        "[SERVER:SIMULATION] ✅ FS Toolbox test completed successfully.",
    );

    // Run Security Tests
    console.log("[SERVER:SIMULATION] 🛡️ Running Security Tests...");

    // 1. Path Traversal bypass check
    const traversalRes = await fetch(
        "http://localhost:3728/api/templates/..%2f..%2fapi/templates/test",
    );
    const traversalText = await traversalRes.text();
    console.log(
        "[SERVER:SIMULATION] Path Traversal Normalization Result:",
        traversalText.length,
    );

    // 2. ReDoS Protection check
    const payload = "a".repeat(150) + "X"; // This would normally freeze Node.js on /^(a+)+$/
    console.log(
        `[SERVER:SIMULATION] ReDoS Check starting with payload length: ${payload.length}...`,
    );
    const redosRes = await fetch(
        `http://localhost:3728/api/regex-test?payload=${payload}`,
    );
    const redosText = await redosRes.text();
    console.log("[SERVER:SIMULATION] ReDoS Check Result:", redosText);

    // 3. Honeypot Tarpit check
    console.log(`[SERVER:SIMULATION] Testing Honeypot Tarpit on /.env...`);
    try {
        const tarpitRes = await fetch("http://localhost:3728/.env");
        if (tarpitRes.status === 403) {
            console.log(
                "[SERVER:SIMULATION] ✅ Honeypot Tarpit Check Result: Blocked via HTTP 403 (Connection drop fallback)",
            );
        } else {
            console.log(
                "[SERVER:SIMULATION] ❌ Honeypot Tarpit Check FAILED (Expected connection error or 403, got",
                tarpitRes.status,
                ")",
            );
        }
    } catch (e: any) {
        console.log(
            `[SERVER:SIMULATION] ✅ Honeypot Tarpit Check Result: Connection forcefully dropped! (${e.message})`,
        );
    }
} catch (err: any) {
    console.error(
        "[SERVER:SIMULATION] ❌ FS Toolbox test failed:",
        err.message,
    );
}


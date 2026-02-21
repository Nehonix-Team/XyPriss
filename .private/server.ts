import NehoID from "nehoid";
import { createServer } from "../src/index";
import { xems } from "../src/plugins/modules/xems/XemsPlugin";
import crypto from "node:crypto";

const USERS_SANDBOX = "users-db";
const SESSION_SANDBOX = "auth-automated";

const app = createServer({
    server: {
        port: 6578,
        xems: {
            sandbox: SESSION_SANDBOX,
            ttl: "30m",
            autoRotation: true,
            persistence: {
                enabled: true,
                secret: "8f2d6c1b9a5e4f0d3c7b2a1e6d9f8c0b",
                resources: {
                    cacheSize: 64,
                },
            },
        },
    },
    security: {
        cors: {
            origin: ["http://localhost:*"],
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            allowedHeaders: ["Content-Type", "x-xypriss-token"],
        },
    },
});

console.log("cors: ", __cfg__.get("security")?.cors);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashPassword(password: string): string {
    return crypto
        .createHash("sha256")
        .update(password + "xems-salt-2026")
        .digest("hex");
}

function generateId(): string {
    return crypto.randomBytes(8).toString("hex");
}

/** Derive a stable XEMS key from an email (so we can look up users by email) */
function emailKey(email: string): string {
    return (
        "user:" +
        crypto.createHash("sha256").update(email).digest("hex").slice(0, 32)
    );
}

// ─── Auth Routes ──────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Stores user record in XEMS "users-db" sandbox (keyed by email hash).
 * Creates a session in the "auth-automated" sandbox.
 */
app.post("/auth/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res
                .status(400)
                .json({ error: "name, email and password are required" });
        }

        // Check if user already exists (stable key lookup — no token needed)
        const existing = await xems.get(USERS_SANDBOX, emailKey(email));
        console.log("existing: ", existing);
        if (existing) {
            return res.status(409).json({ error: "Email already registered" });
        }

        const user = {
            id: generateId(),
            name,
            email,
            role: "user",
            passwordHash: hashPassword(password),
            createdAt: new Date().toISOString(),
        };

        // Persist user record with a stable key (email hash) — no TTL (permanent record)
        await xems.set(USERS_SANDBOX, emailKey(email), JSON.stringify(user));

        // Create auth session (token-based, with TTL, auto-rotated)
        const { id, name: userName, role, createdAt } = user;
        const sessionData = { id, name: userName, email, role, createdAt };
        const sessionToken = await res.xLink(sessionData, SESSION_SANDBOX);

        return res.json({
            success: true,
            message: "Account created successfully",
            user: sessionData,
            token: sessionToken,
        });
    } catch (e: any) {
        console.error("[/auth/register]", e);
        return res.status(500).json({ error: e.message });
    }
});

/**
 * POST /auth/login
 * Looks up user by email in XEMS, validates password, creates a new session.
 */
app.post("/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res
                .status(400)
                .json({ error: "email and password are required" });
        }

        // Look up user record from XEMS by stable email key
        const raw = await xems.get(USERS_SANDBOX, emailKey(email));
        if (!raw) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const user = JSON.parse(raw);

        // Verify password
        if (user.passwordHash !== hashPassword(password)) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        // Create new auth session (token-based, with TTL)
        const { id, name, role, createdAt } = user;
        const sessionData = { id, name, email, role, createdAt };
        const sessionToken = await res.xLink(sessionData, SESSION_SANDBOX);

        return res.json({
            success: true,
            message: "Logged in successfully",
            user: sessionData,
            token: sessionToken,
        });
    } catch (e: any) {
        console.error("[/auth/login]", e);
        return res.status(500).json({ error: e.message });
    }
});

/**
 * POST /auth/logout
 * Clears the session cookie/header.
 */
app.post("/auth/logout", async (_req, res) => {
    res.clearCookie("xems_token");
    res.removeHeader("x-xypriss-token");
    return res.json({ success: true, message: "Logged out" });
});

/**
 * GET /auth/profile
 * Returns the current user from the XEMS session (auto-populated by the plugin).
 */
app.get("/auth/profile", async (req, res) => {
    const session = req["session"] as any;

    console.log("session (main): ", session);

    if (!session?.id) {
        return res.status(401).json({ error: "Not allowed" });
    }

    return res.json({
        user: {
            id: session.id,
            name: session.name,
            email: session.email,
            role: session.role,
            createdAt: session.createdAt,
        },
        tokenRotated: !!(res as any)._xemsNewToken,
    });
});

app.start();


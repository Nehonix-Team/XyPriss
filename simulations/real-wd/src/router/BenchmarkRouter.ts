import { Router, xems } from "xypriss";

export const benchmarkRouter = Router();

// Endpoint to setup 1000 sessions
benchmarkRouter.get("/setup", async (req, res) => {
    const tokens: string[] = [];
    const count = 1000;

    // We use req.app.xems to ensure we are using the correct instance in multi-server
    const runner = xems.forApp(req.app);

    for (let i = 0; i < count; i++) {
        const data = {
            id: `user_${i}`,
            index: i,
            timestamp: Date.now(),
            nested: {
                flag: true,
                tags: ["bench", "test", i.toString()],
            },
        };
        // Use a specific benchmark sandbox
        const token = await runner.createSession("benchmark", data, {
            ttl: "1h",
        });
        tokens.push(token);
    }

    res.setHeader("Content-Type", "text/plain").send(tokens.join("\n"));
});

// Endpoint to read a session
benchmarkRouter.get("/read", async (req, res) => {
    const token = req.query.token as string;
    if (!token) {
        console.error(
            `[BENCHMARK] 400 - Token missing in query: ${JSON.stringify(req.query)}`,
        );
        return res.status(400).send("Token required");
    }

    const runner = xems.forApp(req.app);
    const session = await runner.resolveSession(token, {
        sandbox: "benchmark",
        rotate: true,
        ttl: "1h",
    });

    if (session) {
        res.json({
            status: "ok",
            data: session.data,
            newToken: session.newToken,
        });
    } else {
        console.error(
            `[BENCHMARK] 401 - Session not found for token: ${token.substring(0, 10)}...`,
        );
        res.status(401).send("Invalid or expired token");
    }
});

// Endpoint to stress write
benchmarkRouter.get("/write", async (req, res) => {
    const runner = xems.forApp(req.app);
    const key = `stress_${Math.random()}`;
    await runner
        .from("stress")
        .set(key, JSON.stringify({ data: "x".repeat(1024) })); // 1KB
    const val = await runner.from("stress").get(key);
    res.json({ key, success: !!val });
});


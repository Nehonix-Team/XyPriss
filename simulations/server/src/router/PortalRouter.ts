import { Router, xems } from "xypriss";

export const portalRouter = Router();

// Step 1: Preliminary login (Email/Password)
portalRouter.post("/login", async (req, res) => {
    const { email, password } = req.body;

    // Simulation: check credentials
    if (email === "user@xypriss.com" && password === "password123") {
        const runner = xems.forApp(req.app);

        // Create an ephemeral sandbox "otp-pending"
        const token = await runner.createSession(
            "otp-pending",
            {
                tempUserId: "user_42",
                email: email,
                action: "MFA_REQUIRED",
            },
            {
                ttl: "2m", // Short TTL for security
            },
        );

        return res.json({
            status: "mfa_pending",
            tempToken: token,
            message: "OTP sent to email (simulated)",
        });
    }

    res.status(401).json({ error: "Invalid credentials" });
});

// Step 2: MFA Validation
portalRouter.post("/mfa/verify", async (req, res) => {
    const { otp, tempToken } = req.body;
    const runner = xems.forApp(req.app);

    // Resolve the temporary session
    const tempSession = await runner.resolveSession(tempToken, {
        sandbox: "otp-pending",
    });

    if (!tempSession || otp !== "123456") {
        return res
            .status(401)
            .json({ error: "Invalid OTP or session expired" });
    }

    // Destroy the temp session
    await runner.from("otp-pending").del(tempToken);

    // Create the main production session using xLink (builtin high-level API)
    // xLink automatically sets the secure httpOnly cookie and handles rotation
    await res.xLink({
        userId: tempSession.data.tempUserId,
        email: tempSession.data.email,
        role: "user",
        permissions: ["read:dashboard", "read:profile"],
    });

    res.json({ status: "success", message: "Authenticated" });
});

// Stress Test: Multiple concurrent data fetches
portalRouter.get("/dashboard/widgets/:widgetId", async (req, res) => {
    const { widgetId } = req.params;

    if (!req.session) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // Add a small random delay to simulate network latency and increase chance of rotation races
    await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 200 + 50),
    );

    res.json({
        widget: widgetId,
        data: `Data for ${widgetId} at ${new Date().toISOString()}`,
        sessionInfo: {
            userId: req.session.userId,
            // We can check if rotaion happened by looking at tokens if we had access,
            // but XEMS handles this transparently.
        },
    });
});

portalRouter.post("/logout", async (req, res) => {
    await res.xUnlink();
    res.json({ status: "logged_out" });
});


import { Router, xems, type Request, type Response } from "../../src";

const router = Router();

router.get("/", (req: Request, res: Response) => {
    res.json({ message: "Auth server is running" });
});

router.post("/login", async (req: Request, res: Response) => {
    const data = req.body as { email: string; password: string; id: string };

    if (!data.email || !data.password || !data.id) {
        return res.json({ message: "Missing data" });
    }

    // Use req.app.xems to ensure we use the runner
    // configured with the server's persistence settings.
    const xms = req.app.xems;
    const db = xms?.from("users");

    // Persist user data (email) indexed by ID
    await db?.set(
        data.id,
        JSON.stringify({
            email: data.email,
            loginAt: new Date().toISOString(),
        }),
        "24h",
    );

    // Create a secure session using XEMS xLink helper
    // This will set the cookie and header automatically
    if (res.xLink) {
        const token = await res.xLink({
            id: data.id,
            email: data.email,
            role: "user",
        });

        return res.json({
            success: true,
            message: "Login successful",
            user: {
                id: data.id,
                email: data.email,
            },
            token,
        });
    }

    res.json({
        success: true,
        message: "Login successful",
        user: {
            id: data.id,
            email: data.email,
        },
    });
});
router.get("/me", (req: Request, res: Response) => {
    // req.session is automatically populated by the XEMS plugin
    // if a valid token is provided in cookies or headers.
    const session = req.session;

    if (!session) {
        return res.status(401).json({
            success: false,
            message: "Not authenticated",
        });
    }

    res.json({
        success: true,
        session,
    });
});

router.get("/debug/xems/:sandbox/:key", async (req: Request, res: Response) => {
    const { sandbox, key } = req.params;
    const xms = req.app.xems;
    const value = await xms?.from(sandbox).get(key);

    res.json({
        sandbox,
        key,
        value: value ? JSON.parse(value) : null,
        exists: !!value,
    });
});

router.get("/users", (req: Request, res: Response) => {
    res.json({ message: "Users endpoint" });
});

export { router as authRouter };


import { Router } from "xypriss";

export const adminRouter = Router();

adminRouter.get("/stats", (req, res) => {
    // This endpoint should only be accessible if the session is valid on the Admin port
    // and ideally we check for an 'admin' role.
    if (!req.session) {
        return res.status(401).json({ error: "Unauthorized Admin Access" });
    }

    if (req.session.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Admins only" });
    }

    res.json({
        systemStatus: "Operational",
        totalUsers: 1250,
        activeSessions: 42,
        xems_engine: "HEALTHY (Sidecar Active)",
    });
});

adminRouter.get("/isolation-test", (req, res) => {
    res.json({
        message: "You have reached the Admin port (3729)",
        sessionPresent: !!req.session,
        sessionData: req.session || null,
    });
});


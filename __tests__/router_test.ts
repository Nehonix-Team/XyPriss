import { Router } from "express";

const router = Router();

// Test route for rate limiting
router.get("/test", (_req, res) => {
    res.json({
        message: "Test endpoint",
        timestamp: Date.now(),
        success: true,
    });
});

// Test route for CORS
router.get("/cors-test", (_req, res) => {
    res.json({
        message: "CORS test endpoint",
        timestamp: Date.now(),
    });
});

// Test route for security headers
router.get("/security-test", (_req, res) => {
    res.json({
        message: "Security headers test",
        headers: res.getHeaders(),
        timestamp: Date.now(),
    });
});

export { router as TestAppRouter };


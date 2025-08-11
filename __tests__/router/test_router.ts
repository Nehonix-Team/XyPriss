import { Router } from "../..";

const router = Router();

// Test route for rate limiting
router.get("/test", (_req, res) => {
    res.json({
        message: "Test endpoint",
        timestamp: Date.now(),
        success: true,
    });
});

//http://localhost:[port]/api/v2/all/[no matter the path and levels] 
router.get("/all/**", (_req, res) => {
    res.json({
        message: "Test endpoint 1for two level wildcard",
        timestamp: Date.now(),
        success: true,
    });
});

//http://localhost:[port]/api/v2/all/[no matter the path] but only one level
router.get("/all2/*", (_req, res) => {
    res.json({
        message: "Test endpoint2 for one level wildcard",
        timestamp: Date.now(),
        success: true,
    });
});

//dynamic routes
//http://localhost:[port]/api/v2/dynamic/[any id]
router.get("/dynamic/:id", (_req, res) => {
    res.json({
        message: "Dynamic endpoint",
        timestamp: Date.now(),
        success: true,
        id: _req.params.id,
        params: _req.params
    });
});

// combination of dynamic and wildcard
//http://localhost:[port]/api/v2/dynamic/[any id]/[no matter the path]
router.get("/dynamic/wllc/:id/**", (_req, res) => {
    res.json({
        message: "Dynamic endpoint with wildcard",
        timestamp: Date.now(),
        success: true,
        id: _req.params.id,
        params: _req.params
    });
});

export { router as TestAppRouter };


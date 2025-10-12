import { Router } from "../../src";


const router = Router()


router.get("/health", (_req, res) => {
    res.json({
        message: "Health check",
        timestamp: Date.now(),
        success: true,
    });
});

export {router as MultiServRouter}



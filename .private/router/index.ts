/**
 * Routes Configuration
 *
 * This module defines all API routes for the XyPriss application.
 * Routes are organized by feature and include proper error handling.
 *
 * @fileoverview Route configuration and setup
 * @version 1.0.0
 * @author XyPriss Team
 * @since 2025-01-01
 */

import { Request, Response, Router } from "../../src";
import { testAuthMiddleware } from "../middlewares/testMiddleware";
import { authRouter } from "./auth.route";
import { v1Router } from "./v1.route";

const router = Router();

// Health check endpoint
router.get("/health", (reqw: Request, res: Response) => {
    res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: __sys__.__version__,
        environment: __sys__.__env__,
    });
});

router.use(testAuthMiddleware);

router.use("/auth", authRouter);
router.use("/v1", v1Router);

export default router;

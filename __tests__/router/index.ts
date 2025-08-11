/**
 * XyPriss Router System
 * Express-like router for modular route organization
 */

import { Router } from "../..";
import { TestAppRouter } from "./test_router";

const router = Router();

router.use("/api/v2", TestAppRouter);

export {router as MainTestRouterApp}
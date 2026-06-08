import { Router } from "xypriss";
 import { mainRouter } from "../routes/main.route";

/**
 * Main Application Router
 */
const router = Router();

 /** Mounting the primary router */
 router.use("/api", mainRouter);

export default router;

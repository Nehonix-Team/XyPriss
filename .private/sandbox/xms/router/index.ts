import { Router } from "../../../../src";
import { xserver1Route } from "./xserver1.route";
import { xserver2Route } from "./xserver2.route";

export const router = Router();

// /api/x1
router.use("/x1", xserver1Route);
// /api/x2
router.use("/x2", xserver2Route);

export default router

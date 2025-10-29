// import { Router } from "xypriss";
import { Router } from "../../../../src/";
import { authRoutes } from "../routes/auth.routes";
import { secRouter } from "../routes/security-test.routes";
import { userRoutes } from "../routes/user.routes";

const router = Router();

router.get("/", (_req, res) => {
    res.send("Hello World! from Router");
});
router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/security/test", secRouter)
export default router;

 
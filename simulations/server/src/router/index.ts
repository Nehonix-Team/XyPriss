import { Router } from "xypriss";
import { trustProxyRouter } from "./TrustProxyRouter";
import { guardTestRouter } from "./GuardTestRouter";
import { bugReproductionRouter } from "./BugReproductionRouter";
import { redirectRouter } from "./RedirectRouter";

export const router = Router();

router.get("/", (req, res) => {
    res.send("Welcome to XyPriss Simulation Server");
});

router.use("/auth", guardTestRouter);
router.use("/network", trustProxyRouter);
router.use("/file", bugReproductionRouter);
router.use("/redirect", redirectRouter);


import { Router } from "xypriss";
import { trustProxyRouter } from "./TrustProxyRouter";
import { guardTestRouter } from "./GuardTestRouter";
import { bugReproductionRouter } from "./BugReproductionRouter";
import { redirectRouter } from "./RedirectRouter";
import { benchmarkRouter } from "./BenchmarkRouter";
import { portalRouter } from "./PortalRouter";
import { adminRouter } from "./AdminRouter";

export const router = Router();

router.get("/", (req, res) => {
    res.send("Welcome to XyPriss Simulation Server");
});

router.use("/auth", guardTestRouter);
router.use("/network", trustProxyRouter);
router.use("/file", bugReproductionRouter);
router.use("/redirect", redirectRouter);
router.use("/benchmark", benchmarkRouter);
router.use("/api", portalRouter);
router.use("/admin-api", adminRouter);


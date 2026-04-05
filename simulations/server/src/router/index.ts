import { Router } from "xypriss";
import { trustProxyRouter } from "./TrustProxyRouter";
import { guardTestRouter } from "./GuardTestRouter";

export const router = Router();

router.get("/", (req, res) => {
    res.send("Welcome to XyPriss Simulation Server");
});

router.use("/auth", guardTestRouter);
router.use("/network", trustProxyRouter);

import { Router } from "../src";
import { ms1_rpx } from "./ms1";

const router = Router();

// path: /server/ms1/hello

router.get("/hello", (req, res) => {
    res.send("Hello World!");
});

export { router as ms1_router2 };


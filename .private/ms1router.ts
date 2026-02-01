import { Router } from "../src";
import { ms1_rpx } from "./ms1";
import { ms1_router2 } from "./ms1_router2";

const router = Router();

// path: /server/ms1/hello
router.use("/", ms1_router2);
export { router as ms1_router };


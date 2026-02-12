import { Router } from "../../../../src";

export const router = Router();

// {{host}}/api/x2/
router.get("/", (req, res) => {
    res.send("Hello World from 'xserver2.route.ts'");
});

export { router as xserver2Route };


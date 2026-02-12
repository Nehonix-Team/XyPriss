import { Router } from "../../../../src";

export const router = Router();

// {{host}}/api/x1/
router.get("/", (req, res) => {
    res.send("Hello World from 'xserver1.route.ts'");
});



export {router as xserver1Route}
// import { Router } from "express";
import { Router } from "../../../../src";
import AuthMiddleware from "../midlewares/auth.middleware";
import ValidationMiddleware from "../midlewares/validation.middleware";
import authSchema from "../schema/auth.schema";

const router: any = Router();

router.get("/", (_req, res) => {
    res.send("Hello World from auth router!");
});

router.post("/", (_req: any, res) => {
    res.send(_req.body);
});


export { router as secRouter };


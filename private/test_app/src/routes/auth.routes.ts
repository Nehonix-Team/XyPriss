// import { Router } from "express";
import { Router } from "../../../../src";
import AuthMiddleware from "../midlewares/auth.middleware";
import ValidationMiddleware from "../midlewares/validation.middleware";
import authSchema from "../schema/auth.schema";

const router: any = Router();

router.get("/", (_req, res) => {
    res.send("Hello World from auth router!");
});

router.post(
    "/login",
    ValidationMiddleware.validateBody(authSchema.login),
    (res, req) => {
        res.send("Connected: test");
    }
);
router.post(
    "/register",
    ValidationMiddleware.validateBody(authSchema.register),
    (res, req) => {
        res.send("Registred: test");
    }
);
router.post("/logout", AuthMiddleware.authenticateUser, (res, req) => {
    res.send("Disconnected: test");
});

export { router as authRoutes };


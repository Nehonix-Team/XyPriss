import { Router } from "../../../../src";
import AuthMiddleware from "../midlewares/auth.middleware";

const router = Router();

router.get("/info", AuthMiddleware.authenticateUser, (res, req) => {
    res.status(200).json({
        message: "Hello World!",
        user: {
            id: 1,
            name: "John Doe",
        },
    });
});

export { router as userRoutes };


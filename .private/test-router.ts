import { Router } from "../src";

const testRouter = Router();

// Now we can safely use app.uploadSingle since it's available immediately
testRouter.get("/user", (req: any, res: any) => {
    res.send({
        messsage: "ok",
    });
});

export { testRouter };


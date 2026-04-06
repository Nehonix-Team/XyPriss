import { Router } from "xypriss";

export const redirectRouter = Router();

redirectRouter.get("/target", (req, res) => {
    res.send(
        `Redirected successfully to: ${req.url} (baseUrl: ${req.baseUrl})`,
    );
});

/**
 * Relative redirect: should go to /prefix/target if mounted at /prefix
 * In this simulation, it will be mounted at /file/redirect/old -> /file/redirect/target
 */
redirectRouter.redirect("/old", "/target");

/**
 * Nested relative redirect:
 * routerA.use("/sub", routerB)
 * routerB.redirect("/test", "/done")
 * Mounted at /file/redirect/sub/test -> /file/redirect/sub/done
 */
const subRouter = Router();
subRouter.get("/done", (req, res) => {
    res.send(`Nested redirect success: ${req.url} (baseUrl: ${req.baseUrl})`);
});
subRouter.redirect("/test", "/done");

redirectRouter.use("/sub", subRouter);


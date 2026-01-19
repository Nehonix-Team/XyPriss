import { Router } from "../src/index";

const ORFOF = Router();

ORFOF.get("/", (req, res) => {
    res.send("Other Router From File");
});

export { ORFOF as otherRouterFromOtherFile };
export { ORFOF };


import { Router, type Request, type Response } from "../../src";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.json({ message: "V1 server is running" });
});

export { router as v1Router };

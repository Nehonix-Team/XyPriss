import { Router } from "xypriss";
import { streamRouter } from "./stream.route";

export const router = Router();

router.group(
    {
        prefix: "/stream",
    },
    (stream) => {
        stream.use("/", streamRouter);
        stream.use("/router2", {
            guards: {
            authenticated: true
        }}, streamRouter);
        stream.get(
            "/world",
            {
                guards: {
                    ipWhitelist: true,
                },
            },
            (req, res) => {
                res.send("Hello from world endp");
            },
        );
    },
);

console.log("process env for PORT (router): ", process.env.PORT);


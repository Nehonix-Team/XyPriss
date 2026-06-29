import { Router } from "xypriss";

export const router = Router();
router.get(
    "/admin/settings",
    {
        guards: {
            authenticated: true,
            roles: ["admin"],
            monGuardCustom: true,
        },
    },
    (req, res) => {
        res.success("Welcome, Admin");
    },
);

console.log("process env for PORT (router): ", process.env.PORT);

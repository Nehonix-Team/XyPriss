import { Router } from "../../../../src";

export const router = Router();

// {{host}}/api/x2/user/*
router.use("/user", (req, res, n) => {
    console.log("Authentificating....");

    const user = {
        name: "John Doe",
        role: "admin",
    };

    req.user = user;

    if (user.role !== "admin") {
        return res.status(403).send("You're not authorized");
    }

    console.log("User Authentificated");
    n();
});

// {{host}}/api/x2/user/login
router.get("/user/login", (req, res) => {
    res.send("You're logged as John Doe from xserver2");
});

// {{host}}/api/x2/user/profile
router.get("/user/profile", (req, res) => {
    res.send("Your profile from xserver2");
});

router.get("/hello", (r, s) => s.send("Hello from xserver2"));

export { router as xserver2Route };


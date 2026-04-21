import { Router } from "xypriss";

export const guardTestRouter = Router();

// Public route using standard syntax
guardTestRouter.get("/public", (req, res) => {
    res.success("This is a public route");
});

// Login helper to test guards
guardTestRouter.get("/login", async (req, res) => {
    const role = (req.query.role as string) || "user";
    const permissions = req.query.permissions
        ? (req.query.permissions as string).split(",")
        : [];

    // Initialize real XEMS session
    const data = { id: "123", user_id: "123", role, permissions };
    await res.xLink(data);

    res.success(`Logged in as ${role}`, { permissions });
});

/**
 * Routing V2: Group with shared guards
 */
guardTestRouter.group(
    {
        guards: { authenticated: true },
    },
    (group) => {
        group.get("/protected", (req, res) => {
            res.success("You have accessed a protected route via V2 group", {
                user_id: req.session?.user_id,
            });
        });

        group.get(
            "/admin",
            {
                guards: { roles: ["admin"] },
            },
            (req, res) => {
                res.success("Welcome, Admin (V2 Rich Options)");
            },
        );

        group.get(
            "/editor",
            {
                guards: { permissions: ["edit_posts"] },
            },
            (req, res) => {
                res.success(
                    "You have permission to edit posts (V2 Rich Options)",
                );
            },
        );

        group.get(
            "/any-role",
            {
                guards: { roles: ["admin", "editor", "moderator"] },
            },
            (req, res) => {
                res.success(`Access granted for role: ${req.session?.role}`);
            },
        );
    },
);


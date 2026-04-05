import { Router } from "../src/server/routing/Router";
import { normalizePath } from "../src/server/routing/modules/path";

async function test() {
    console.log("🧪 Starting Routing Regression Tests...\n");
    const router = Router();

    // 1. Test Regex Constraints
    console.log("1. Testing Regex Constraints...");
    try {
        router.get("/users/:id(\\d+)", (req, res) => {
            res.json({ userId: req.params.id });
        });
        console.log("✅ Regex constraint route registered successfully.");
    } catch (e) {
        console.error("❌ Failed to register regex constraint route:", e);
    }

    // 2. Test Typed Parameters
    console.log("\n2. Testing Typed Parameters...");
    router.get("/items/:id<number>", (req, res) => {
        res.json({ id: req.params.id });
    });
    const itemRoute = router
        .getRoutes()
        .find((r) => r.path === "/items/:id<number>");
    if (itemRoute && itemRoute.pattern.test("/items/123")) {
        console.log("✅ Typed parameter <number> matches correctly.");
    } else {
        console.error("❌ Typed parameter <number> failed to match.");
    }

    // 3. Test Multiple Parameters in Segment
    console.log("\n3. Testing Multiple Parameters in Segment...");
    router.get("/archive/:year-:month-:day", (req, res) => {});
    const archiveRoute = router
        .getRoutes()
        .find((r) => r.path === "/archive/:year-:month-:day");
    if (archiveRoute && archiveRoute.paramNames.length === 3) {
        console.log(
            "✅ Multiple parameters in one segment recognized correctly:",
            archiveRoute.paramNames,
        );
    } else {
        console.error("❌ Multiple parameters in one segment failed.");
    }

    // 4. Test Redirect Interpolation (Internal logic check)
    console.log("\n4. Testing Redirect Interpolation...");
    // We can't easily execute the handler here without a full mock req/res,
    // but we can check if the handler is defined.
    router.redirect("/old/:id", "/new/:id");
    const redirectRoute = router.getRoutes().find((r) => r.path === "/old/:id");
    if (redirectRoute && typeof redirectRoute.handler === "function") {
        console.log("✅ Redirect route registered.");

        // Mock execution
        const mockReq = { params: { id: "123" } };
        let redirectUrl = "";
        const mockRes = {
            redirect: (status: number, url: string) => {
                redirectUrl = url;
            },
        };

        (redirectRoute.handler as any)(mockReq, mockRes);
        if (redirectUrl === "/new/123") {
            console.log(
                "✅ Redirect interpolation works: /old/123 -> /new/123",
            );
        } else {
            console.error(
                "❌ Redirect interpolation failed. Got:",
                redirectUrl,
            );
        }
    }

    console.log("\n✨ All basic routing integrity tests completed.");
}

test();


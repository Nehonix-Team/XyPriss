import { xems } from "./src/plugins/modules/xems/XemsPlugin";

async function testRotation() {
    try {
        console.log("--- Testing XEMS Rotation & Grace Period ---");
        await new Promise((r) => setTimeout(r, 800));

        // 1. Create a session
        const token = await xems.createSession("test", "secret-data", {
            ttl: "1m",
        });
        console.log("Initial Token:", token);

        // 2. Simulate concurrent requests
        console.log("Triggering 2 simultaneous requests with old token...");

        // Both requests use the OLD token
        // One will rotate it, the other should still work during grace period
        const [res1, res2] = await Promise.all([
            xems.resolveSession(token, {
                sandbox: "test",
                rotate: true,
                gracePeriod: 2000,
            }),
            xems.resolveSession(token, {
                sandbox: "test",
                rotate: true,
                gracePeriod: 2000,
            }),
        ]);

        console.log(
            "Result 1:",
            res1
                ? res1.newToken
                    ? "Rotated to " + res1.newToken
                    : "Found"
                : "Failed",
        );
        console.log(
            "Result 2:",
            res2
                ? res2.newToken
                    ? "Rotated to " + res2.newToken
                    : "Found"
                : "Failed",
        );

        if (res1 && res2) {
            console.log("✅ Success: Both concurrent requests were accepted!");
        } else {
            console.log("❌ Failure: One or more concurrent requests failed.");
        }

        // 3. Test that old token eventually dies after grace period
        console.log("Waiting 3s for grace period to expire...");
        await new Promise((r) => setTimeout(r, 3000));

        const res3 = await xems.resolveSession(token, { sandbox: "test" });
        if (!res3) {
            console.log(
                "✅ Success: Old token is now invalid (expired grace period).",
            );
        } else {
            console.log(
                "❌ Failure: Old token is still valid after grace period!",
            );
        }
    } catch (error) {
        console.error("Test error:", error);
    } finally {
        process.exit(0);
    }
}

testRotation();


import { xems } from "./src/plugins/modules/xems/XemsPlugin";

async function testXems() {
    try {
        console.log("Testing XEMS...");

        // Wait a bit for the process to spawn
        await new Promise((r) => setTimeout(r, 500));

        const setRes = await xems.set(
            "test-sandbox",
            "my-key",
            "Hello from XEMS!",
        );
        console.log("Set result:", setRes);

        const getRes = await xems.get("test-sandbox", "my-key");
        console.log("Get result:", getRes);

        if (getRes === "Hello from XEMS!") {
            console.log("✅ XEMS test passed!");
        } else {
            console.log(
                "❌ XEMS test failed: expected 'Hello from XEMS!', got",
                getRes,
            );
        }
    } catch (error) {
        console.error("Test error:", error);
    } finally {
        process.exit(0);
    }
}

testXems();


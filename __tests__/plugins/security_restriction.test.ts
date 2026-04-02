import { createServer, Plugin } from "../../src";

async function runTest() {
    console.log("\n=== Testing Plugin Security Restrictions ===\n");

    let register_app_configs: any = "not_called";
    let register_app_get: any = "not_called";
    let auxiliary_app_configs: any = "not_called";

    const testPlugin = Plugin.create({
        name: "security-test-plugin",
        version: "1.0.0",
        onRegister(server) {
            console.log("1. Testing access in onRegister hook...");
            // @ts-ignore - explicitly testing runtime behavior for forbidden property
            register_app_configs = server.app.configs;
            console.log(
                `   - server.app.configs: ${register_app_configs} (Expected: undefined)`,
            );

            // This should work
            register_app_get = typeof server.app.get;
            console.log(
                `   - typeof server.app.get: ${register_app_get} (Expected: function)`,
            );
        },
        onAuxiliaryServerDeploy(ops, server) {
            console.log(
                "\n2. Testing access in onAuxiliaryServerDeploy hook (Exception)...",
            );
            // This should be allowed
            auxiliary_app_configs = server.app.configs;
            console.log(
                `   - server.app.configs: ${auxiliary_app_configs ? "object" : "undefined"} (Expected: object)`,
            );
        },
    });

    const app = createServer({
        server: {
            port: 8090,
            host: "localhost",
        },
        pluginPermissions: [
            {
                name: "security-test-plugin",
                allowedHooks: "*", // Allow everything, including OPS
            },
        ],
        plugins: {
            register: [testPlugin],
        },
    });

    // Start server to trigger hooks
    await app.start();

    console.log("\n=== Test Results Summary ===");
    const test1_passed = register_app_configs === undefined;
    const test2_passed = register_app_get === "function";
    const test3_passed =
        auxiliary_app_configs !== "not_called" &&
        auxiliary_app_configs !== undefined;

    console.log(
        `Test 1 (Restriction in onRegister): ${test1_passed ? "PASSED" : "FAILED"} (Value: ${register_app_get})`,
    );
    console.log(
        `Test 2 (Allowed method in onRegister): ${test2_passed ? "PASSED" : "FAILED"}`,
    );
    console.log(
        `Test 3 (Exception for onAuxiliaryServerDeploy): ${test3_passed ? "PASSED" : "FAILED"} (Value: ${auxiliary_app_configs === "not_called" ? "NOT CALLED" : auxiliary_app_configs ? "object" : "undefined"})`,
    );

    if (test1_passed && test2_passed && test3_passed) {
        console.log("\n✅ ALL SECURITY RESTRICTION TESTS PASSED\n");
        process.exit(0);
    } else {
        console.log("\n❌ SOME TESTS FAILED\n");
        process.exit(1);
    }
}

runTest().catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
});


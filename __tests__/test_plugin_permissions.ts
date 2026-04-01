import { createServer, Plugin } from "../src";

async function main() {
    const privilegedPlugin = Plugin.create({
        name: "privileged-plugin",
        version: "1.0.0",
        onAuxiliaryServerDeploy(ops) {
            console.log("[PLUGIN_TEST] Auxiliary server deploying...");
        },
    });

    console.log("\n--- TEST 1: Denied by default (Privileged hook) ---");
    const server1 = createServer({
        server: { port: 3000 },
        plugins: { register: [privilegedPlugin] },
    });
    // Wait for internal plugin initialization
    await (server1 as any).pluginInitPromise;
    if (server1.stop) await server1.stop();

    console.log("\n--- TEST 2: Explicitly Allowed ---");
    const server2 = createServer({
        server: { port: 3001 },
        pluginPermissions: [
            {
                name: "privileged-plugin",
                allowedHooks: ["PLG.OPS.AUXILIARY_SERVER"],
            },
        ],
        plugins: { register: [privilegedPlugin] },
    });
    await (server2 as any).pluginInitPromise;
    if (server2.stop) await server2.stop();

    console.log("\n--- TEST 3: Explicitly Denied (override) ---");
    const server3 = createServer({
        server: { port: 3002 },
        pluginPermissions: [
            {
                name: "privileged-plugin",
                allowedHooks: ["PLG.OPS.AUXILIARY_SERVER"],
                deniedHooks: ["PLG.OPS.AUXILIARY_SERVER"],
            },
        ],
        plugins: { register: [privilegedPlugin] },
    });
    await (server3 as any).pluginInitPromise;
    if (server3.stop) await server3.stop();

    console.log("\n--- TEST 4: Policy 'deny' (Whitelist mode) ---");
    const server4 = createServer({
        server: { port: 3003 },
        pluginPermissions: [
            {
                name: "privileged-plugin",
                policy: "deny",
                allowedHooks: ["PLG.OPS.AUXILIARY_SERVER"],
            },
        ],
        plugins: { register: [privilegedPlugin] },
    });
    await (server4 as any).pluginInitPromise;
    if (server4.stop) await server4.stop();

    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});


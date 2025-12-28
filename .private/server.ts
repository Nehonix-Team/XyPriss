import { createServer } from "../src/index";
import { PluginHookIds } from "../src/plugins/const/PluginHookIds";

const app = createServer({
    server: {
        port: 8085,
    },
    plugins: {
        register: [
            {
                name: "test-plg",
                version: "1.0.0",
                onRegister(server, config) {
                    console.log("Plugin registered!");
                },
                onServerReady(server) {
                    console.log("Plugin server ready!");
                    console.log("Plugin server ready!");
                },
                onRequest(req, res, next) {
                    console.log("🤠 Request received on test-plg!");
                    console.log("🤠 Request headers: ", req.headers);
                    console.log("🤠 Request query: ", req.query);
                    console.log("🤠 Request cookies: ", req.cookies);
                    console.log("🤠 Request body: ", req.body);
                    console.log("🤠 Request params: ", req.params);
                    res.send("hi");
                },
                onResponse(req, res) {
                    console.log("🤩 Response sent on test-plg!");
                    console.log("🤩 Response headers: ", req.headers);
                    console.log("🤩 Response body: ", req.body);
                },
            },
            {
                name: "test-of-plg-v2",
                version: "1.0.1",
                description: "Test of plugin for plg v2",
                onRegister(server, config) {
                    console.log("V2 Plugin registered!");
                },
            },
            {
                name: "manager-plg",
                version: "1.0.0",
                async managePlugins(manager) {
                    console.log("--- Plugin Management Started ---");
                    const stats = manager.getStats();
                    console.log(
                        "Registered Plugins: " +
                            stats
                                .map(
                                    (p) =>
                                        `${p.name}@${p.version} (Enabled: ${
                                            p.enabled
                                        }) -- permissions: ${
                                            Array.isArray(
                                                p.permissions.allowedHooks
                                            )
                                                ? p.permissions.allowedHooks.join(
                                                      ","
                                                  )
                                                : p.permissions.allowedHooks
                                        }`
                                )
                                .join(", ")
                    );

                    // Example: Deny a hook that runs AFTER managePlugins
                    // This will cause an error when the hook is called
                    // manager.setPermission(
                    //     "test-plg",
                    //     PluginHookIds.ON_SERVER_READY,
                    //     false
                    // );

                    console.log("--- Stats after denying ON_SERVER_READY ---");
                    const newStats = manager.getStats();
                    const testPlgStats = newStats.find(
                        (p) => p.name === "test-plg"
                    );
                    console.log(
                        `test-plg permissions: ${testPlgStats?.permissions.allowedHooks}`
                    );
                },
            },
        ],
    },
    pluginPermissions: [
        {
            name: "manager-plg",
            allowedHooks: [
                "PLG.MANAGEMENT.MANAGE_PLUGINS",
                "PLG.LIFECYCLE.SERVER_READY",
            ],
            deniedHooks: ["PLG.LIFECYCLE.SERVER_READY"],
            policy: "deny",
        },
        {
            name: "test-plg",
            allowedHooks: [
                PluginHookIds.ON_REGISTER,
                PluginHookIds.ON_REQUEST,
                PluginHookIds.ON_RESPONSE,
                "PLG.MANAGEMENT.MANAGE_PLUGINS",
                PluginHookIds.ON_SERVER_READY,
            ],
            policy: "deny",
        },
    ],
});

app.get("/", (req, res) => {
    res.json({ message: "Hello World" });
});

app.start();


import { createServer, Plugin } from "../src";
import { PluginHookIds } from "../src/plugins/const/PluginHookIds";

const app = createServer({
    plugins: {
        register: [
            {
                name: "test-plg",
                version: "1.0.0",
                description: "Test plugin for new hooks",
                onRegister(server, config) {
                    console.log("Plugin registered!");
                },
                onRequest(req, res, next) {
                    console.log("Request received on test-plg!");
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
                description: "Special plugin to manage other plugins",
                managePlugins(manager) {
                    console.log("--- Plugin Management Started ---");
                    const stats = manager.getStats();
                    console.log(
                        "Registered Plugins:",
                        stats
                            .map(
                                (p) =>
                                    `${p.name}@${p.version} (Enabled: ${p.enabled}) -- permissions: ${p.permissions.allowedHooks}`
                            )
                            .join(", ")
                    );

                    // Example: Toggle a plugin
                    manager.setPermission(
                        "test-plg",
                        PluginHookIds.ON_REGISTER,
                        false
                    );
                    // console.log("Toggled test-plg off");
                },
            },
        ],
    },
    pluginPermissions: [
        {
            name: "manager-plg",
            allowedHooks: ["PLG.MANAGEMENT.MANAGE_PLUGINS"],
            policy: "deny",
        },
    ],
});

// Route to test onResponseTime hook
app.get("/", (req, res) => {
    res.json({ message: "Hello World" });
});

// Route to test slow response
app.get("/slow", async (req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    res.json({ message: "This was a slow request" });
});

// Route to test onRouteError hook
app.get("/error", (req, res) => {
    throw new Error("Test error for onRouteError hook");
});

// Route to test onSecurityAttack hook (XSS)
app.get("/security", (req, res) => {
    res.send(`Query: ${req.query.q}`);
});

app.start();


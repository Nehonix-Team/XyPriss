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
                name: "test of plg v2",
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
                    manager.toggle("test-plg", false);
                    // console.log("Toggled test-plg off");
                },
            },
        ],
    },
    pluginPermissions: [
        {
            name: "manager-plg",
            allowedHooks: [
                "PLG.MANAGEMENT.MANAGE_PLUGINS",
                "PLG.LIFECYCLE.REGISTER",
            ],
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

/**
 * ici lorsque c'est désactivé et qu'il essaie d'utiliser faut afficher une log de warning pour dire que ce pluging est désactivé alors qu'il essaie d'utiliser ect....{ID} et donc ignoré, veuillez l'activer si vous voulez.....ou simillaire . De plus, la propriété @server.ts#L38 a un bug, ça renvoit les permissions du hook manager au lieu des hooks . Logs "bun .private/server.ts
Plugin registered!
V2 Plugin registered!
--- Plugin Management Started ---
Registered Plugins: test-plg@1.0.0 (Enabled: true) -- permissions: *, test of plg v2@1.0.1 (Enable
d: true) -- permissions: *, manager-plg@1.0.0 (Enabled: true) -- permissions: PLG.MANAGEMENT.MANAGE_PLUGINS,PLG.LIFECYCLE.REGISTER                                                                  [SECURITY] UFSIMC-WARNING: Using generated key. For production, set ENV variables: ENC_SECRET_KEY 
or (ENC_SECRET_SEED and ENC_SECRET_SALT)                                                          [SECURITY] UFSIMC-WARNING: Using generated key. For production, set ENV variables: ENC_SECRET_KEY 
or (ENC_SECRET_SEED and ENC_SECRET_SALT)                                                          [SYSTEM] Creating server...
[SYSTEM] Server plugins initialized
[SYSTEM] Network plugins initialized successfully with user configuration
[SYSTEM] Initialization complete, starting server...
[SECURITY] UFSIMC-WARNING: Using generated key. For production, set ENV variables: ENC_SECRET_KEY 
or (ENC_SECRET_SEED and ENC_SECRET_SALT)                                                          [PLUGINS] Registered plugin: xypriss::ext/test-plg@1.0.0
[PLUGINS] Registered plugin: xypriss::ext/test of plg v2@1.0.1
[PLUGINS] Registered plugin: xypriss::ext/manager-plg@1.0.0
[PLUGINS] Plugin 'test-plg' disabled by manager-plg
[PLUGINS] Plugin xypriss::nehonix.network.connection registered in 1.153ms
[SYSTEM] Server running on localhost:8085
^CSIMC closed
                                                                                                  "


 */
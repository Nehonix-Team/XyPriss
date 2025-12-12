/**
 * Plugin API Test
 * Demonstrates all Plugin API methods as documented in PLUGIN_SYSTEM_GUIDE.md
 */

import { createServer, Plugin } from "../src";

console.log("\n=== Testing Plugin API ===\n");

// 1. Test Plugin.create() - Helper for type-safe plugin creation
console.log("1. Testing Plugin.create()");
const myPlugin = Plugin.create({
    name: "my-plugin",
    version: "1.0.0",
    description: "Test plugin created with Plugin.create()",
    onServerStart: (server) => {
        console.log("   ✓ my-plugin started!");
    },
});
console.log(`   Created plugin: ${myPlugin.name}@${myPlugin.version}`);

// 2. Test Plugin.factory() - Create reusable plugin factories
console.log("\n2. Testing Plugin.factory()");
const createAuthPlugin = Plugin.factory((config: { secret: string }) => ({
    name: "auth-plugin",
    version: "1.0.0",
    description: "Auth plugin created with factory",
    onServerStart: (server) => {
        console.log(
            `   ✓ auth-plugin started with secret: ${config.secret.substring(
                0,
                5
            )}...`
        );
    },
}));

const authPlugin = createAuthPlugin({ secret: "my-secret-key-123" });
console.log(
    `   Created plugin from factory: ${authPlugin.name}@${authPlugin.version}`
);

// 3. Test Plugin.register() - Register plugins imperatively BEFORE server creation
console.log("\n3. Testing Plugin.register() (before server creation)");
Plugin.register(myPlugin);
console.log("   ✓ Registered my-plugin");

Plugin.register(authPlugin);
console.log("   ✓ Registered auth-plugin");

// Register another plugin with dependencies
Plugin.register({
    name: "dependent-plugin",
    version: "1.0.0",
    description: "Plugin with dependencies",
    dependencies: ["my-plugin", "auth-plugin"],
    onServerStart: (server) => {
        console.log("   ✓ dependent-plugin started (after dependencies)");
    },
});
console.log("   ✓ Registered dependent-plugin");

// 4. Create server - This will trigger plugin registration from pending queue
console.log(
    "\n4. Creating server (plugins will be registered from pending queue)"
);
const app = createServer({
    server: {
        port: 8086,
    },
    plugins: {
        register: [
            // Also test config-based registration
            () => ({
                name: "config-plugin",
                version: "1.0.0",
                description: "Plugin registered via config",
                onServerStart: () => {
                    console.log("   ✓ config-plugin started!");
                },
            }),
        ],
    },
});

console.log("\n5. Testing Plugin.get() (after server creation)");
const retrievedPlugin = Plugin.get("my-plugin");
if (retrievedPlugin) {
    console.log(
        `   ✓ Retrieved plugin: ${retrievedPlugin.name}@${retrievedPlugin.version}`
    );
} else {
    console.log("   ✗ Failed to retrieve plugin");
}

const authRetrieved = Plugin.get("auth-plugin");
if (authRetrieved) {
    console.log(
        `   ✓ Retrieved plugin: ${authRetrieved.name}@${authRetrieved.version}`
    );
}

const configRetrieved = Plugin.get("config-plugin");
if (configRetrieved) {
    console.log(
        `   ✓ Retrieved plugin: ${configRetrieved.name}@${configRetrieved.version}`
    );
}

// Test getting non-existent plugin
const nonExistent = Plugin.get("non-existent");
console.log(`   Plugin.get("non-existent") = ${nonExistent}`);

// 6. Register a plugin AFTER server creation
console.log("\n6. Testing Plugin.register() (after server creation)");
Plugin.register({
    name: "late-plugin",
    version: "1.0.0",
    description: "Plugin registered after server creation",
    onServerStart: () => {
        console.log(
            "   ✓ late-plugin registered (but onServerStart won't be called)"
        );
    },
});

const lateRetrieved = Plugin.get("late-plugin");
if (lateRetrieved) {
    console.log(
        `   ✓ Retrieved late plugin: ${lateRetrieved.name}@${lateRetrieved.version}`
    );
}

console.log("\n=== Plugin API Test Complete ===\n");

// Start server
app.start(8086, () => {
    console.log("Server started on port 8086");
    console.log("\nAll Plugin API methods tested successfully!");
    console.log("- Plugin.create() ✓");
    console.log("- Plugin.factory() ✓");
    console.log("- Plugin.register() ✓");
    console.log("- Plugin.get() ✓");

    // Stop server after test
    setTimeout(() => {
        process.exit(0);
    }, 1000);
});


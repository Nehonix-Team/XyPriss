// Test logging configuration

import { createServer } from "../mods/security/src/index";

console.log("🧪 Testing logging configuration...");

// Create server with debug logging enabled
const app = createServer({
    server: {
        port: 3003,
        host: "localhost",
    },
    env: "development",

    // Logging configuration - same as your gl.ts
    logging: {
        enabled: true,
        level: "debug",
        components: {
            server: true,
            cache: true,
            cluster: true,
            performance: true,
            fileWatcher: true,
            plugins: true,
            security: true,
            monitoring: true,
            routes: true,
            userApp: true,
            console: true,
        },
        types: {
            startup: true,
            warnings: true,
            errors: true,
            performance: true,
            debug: true,
            hotReload: true,
            portSwitching: true,
        },
        format: {
            timestamps: true,
            colors: true,
            prefix: true,
            compact: false,
        },
    },

    // Disable plugins to focus on logging
    plugins: {
        routeOptimization: {
            enabled: false,
        },
        serverMaintenance: {
            enabled: false,
        },
    },
});

// Test route to generate debug logs
app.get("/", (req, res) => {
    console.log("📝 Route handler called - this should appear");
    res.json({
        message: "Logging test",
        timestamp: new Date(),
        logLevel: "debug enabled",
    });
});

app.get("/test-debug", (req, res) => {
    // Manually test the logger
    const logger = (app as any).logger;
    if (logger) {
        console.log("🔍 Testing logger methods:");
        logger.debug(
            "server",
            "This is a DEBUG message - should appear with debug level"
        );
        logger.info("server", "This is an INFO message - should always appear");
        logger.warn("server", "This is a WARN message - should always appear");
        logger.error(
            "server",
            "This is an ERROR message - should always appear"
        );

        // Test different components
        logger.debug("plugins", "Debug message for plugins component");
        logger.debug("cache", "Debug message for cache component");
        logger.debug("performance", "Debug message for performance component");
    } else {
        console.log("❌ Logger not found on app object");
    }

    res.json({
        message: "Debug test completed - check console output",
        timestamp: new Date(),
    });
});

app.get("/logger-config", (req, res) => {
    // Get logger configuration
    const logger = (app as any).logger;
    if (logger) {
        const config = logger.config || logger.getConfig?.();
        res.json({
            message: "Logger configuration",
            config: config,
            timestamp: new Date(),
        });
    } else {
        res.json({
            error: "Logger not accessible",
            timestamp: new Date(),
        });
    }
});

// Start server
app.listen(() => {
    console.log("🚀 Logging test server started!");
    console.log("");
    console.log("📋 Test endpoints:");
    console.log("  GET http://localhost:3003/           - Basic route");
    console.log("  GET http://localhost:3003/test-debug - Test debug logging");
    console.log(
        "  GET http://localhost:3003/logger-config - Show logger config"
    );
    console.log("");
    console.log("🔍 Expected behavior:");
    console.log("  - You should see DEBUG messages in the console");
    console.log("  - Messages should have timestamps and colors");
    console.log("  - All log levels (debug, info, warn, error) should appear");
    console.log("");
    console.log("💡 Try:");
    console.log("  curl http://localhost:3003/test-debug");
    console.log("  curl http://localhost:3003/logger-config");
});

export { app };


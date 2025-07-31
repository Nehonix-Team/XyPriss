// Direct test of logging functionality

import { Logger } from "../integrations/express/server/utils/Logger";

console.log("🔍 Direct Logger Test");
console.log("===================");

// Test 1: Default configuration
console.log("\n1. Testing default configuration:");
const defaultLogger = new Logger();
console.log("Default config:", JSON.stringify(defaultLogger.getConfig(), null, 2));

defaultLogger.debug("server", "Default logger debug message");
defaultLogger.info("server", "Default logger info message");

// Test 2: Debug enabled configuration
console.log("\n2. Testing debug enabled configuration:");
const debugLogger = new Logger({
    enabled: true,
    level: "debug",
    components: {
        server: true,
        plugins: true,
    },
    types: {
        debug: true,
        startup: true,
        warnings: true,
        errors: true,
    }
});

console.log("Debug config:", JSON.stringify(debugLogger.getConfig(), null, 2));

console.log("\nTesting debug messages:");
debugLogger.debug("server", "This DEBUG message should appear");
debugLogger.info("server", "This INFO message should appear");
debugLogger.warn("server", "This WARN message should appear");
debugLogger.error("server", "This ERROR message should appear");

// Test 3: Your exact configuration
console.log("\n3. Testing your exact configuration:");
const yourLogger = new Logger({
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
});

console.log("Your config:", JSON.stringify(yourLogger.getConfig(), null, 2));

console.log("\nTesting with your configuration:");
yourLogger.debug("server", "🐛 DEBUG: This should appear with your config");
yourLogger.debug("plugins", "🔌 DEBUG: Plugin debug message");
yourLogger.info("server", "ℹ️  INFO: This should appear");
yourLogger.warn("server", "⚠️  WARN: This should appear");
yourLogger.error("server", "❌ ERROR: This should appear");

// Test 4: Level hierarchy test
console.log("\n4. Testing level hierarchy:");
const levels = ["error", "warn", "info", "debug", "verbose"];
levels.forEach(level => {
    console.log(`\nTesting with level: ${level}`);
    const testLogger = new Logger({
        enabled: true,
        level: level as any,
        components: { server: true },
        types: { debug: true }
    });
    
    console.log(`  Config level: ${testLogger.getConfig()?.level}`);
    testLogger.debug("server", `Debug message with level ${level}`);
    testLogger.info("server", `Info message with level ${level}`);
});

console.log("\n✅ Direct logging test completed");
console.log("If debug messages are not appearing, the issue is in the Logger class");
console.log("If they are appearing here but not in your server, the issue is in configuration merging");

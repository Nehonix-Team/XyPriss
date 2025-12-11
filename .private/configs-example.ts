/**
 * XyPriss Configs API - Usage Examples
 *
 * This file demonstrates various ways to use the Configs API
 * to safely access and manage XyPriss configurations in modular structures.
 */

import { createServer, Configs, getConfig, setConfig } from "../src";
import { FileUploadAPI } from "../src";

// ========================================
// Example 1: Basic Usage with createServer
// ========================================

const app = createServer({
    server: {
        port: 3000,
        host: "localhost",
        autoParseJson: true,
    },
    fileUpload: {
        enabled: true,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        storage: "memory",
    },
    security: {
        enabled: true,
        level: "enhanced",
    },
    cache: {
        enabled: true,
        strategy: "memory",
        ttl: 3600,
    },
});

// ========================================
// Example 2: Accessing Configurations
// ========================================

// Get specific configuration sections
const fileUploadConfig = Configs.get("fileUpload");
console.log("File Upload Config:", fileUploadConfig);

const securityConfig = Configs.get("security");
console.log("Security Config:", securityConfig);

const serverConfig = Configs.get("server");
console.log("Server Config:", serverConfig);

// Get all configurations
const allConfigs = Configs.getAll();
console.log("All Configs:", allConfigs);

// ========================================
// Example 3: Using Helper Functions
// ========================================

// Alternative way to get config
const cacheConfig = getConfig("cache");
console.log("Cache Config:", cacheConfig);

// ========================================
// Example 4: Checking Configuration Existence
// ========================================

if (Configs.has("fileUpload")) {
    console.log("File upload is configured");
}

if (Configs.isInitialized()) {
    console.log("Configs have been initialized");
}

// ========================================
// Example 5: Using Configs in Modular Code
// ========================================

// This is the main use case - accessing configs in modules
// without worrying about initialization timing
async function initializeFileUpload() {
    const upload = new FileUploadAPI();

    // Safe access - no "cannot access before initialization" error
    const config = Configs.get("fileUpload");

    if (config) {
        await upload.initialize(config);
        console.log("File upload initialized successfully");
    } else {
        console.log("File upload not configured");
    }

    return upload;
}

// ========================================
// Example 6: Updating Configurations
// ========================================

// Update a specific configuration section
Configs.update("fileUpload", {
    enabled: true,
    maxFileSize: 20 * 1024 * 1024, // Updated to 20MB
    storage: "disk",
});

console.log("Updated file upload config:", Configs.get("fileUpload"));

// ========================================
// Example 7: Merging Configurations
// ========================================

// Merge new configuration with existing
Configs.merge({
    fileUpload: {
        maxFileSize: 15 * 1024 * 1024, // 15MB
        // Other properties are preserved
    },
    performance: {
        optimizationEnabled: true,
        aggressiveCaching: true,
    },
});

console.log("Merged config:", Configs.getAll());

// ========================================
// Example 8: Using with Default Values
// ========================================

// Get config with a default value if not set
const monitoringConfig = Configs.getOrDefault("monitoring", {
    enabled: true,
    healthChecks: true,
    metrics: true,
});

console.log("Monitoring Config (with defaults):", monitoringConfig);

// ========================================
// Example 9: Modular Service Pattern
// ========================================

class FileService {
    private upload: FileUploadAPI;

    constructor() {
        this.upload = new FileUploadAPI();
    }

    async initialize() {
        // Safe access to config in class methods
        const config = Configs.get("fileUpload");

        if (!config?.enabled) {
            throw new Error("File upload is not enabled");
        }

        await this.upload.initialize(config);
        console.log("FileService initialized");
    }

    getUploadMiddleware(fieldName: string) {
        return this.upload.single(fieldName);
    }
}

// ========================================
// Example 10: Conditional Configuration
// ========================================

function setupMiddleware() {
    const securityConfig = Configs.get("security");
    const performanceConfig = Configs.get("performance");

    if (securityConfig?.enabled) {
        console.log("Setting up security middleware...");
        // app.middleware().security(securityConfig);
    }

    if (performanceConfig?.optimizationEnabled) {
        console.log("Enabling performance optimizations...");
    }
}

// ========================================
// Example 11: Environment-Specific Config
// ========================================

const env = process.env.NODE_ENV || "development";

if (env === "production") {
    // Update configs for production
    Configs.merge({
        security: {
            enabled: true,
            level: "maximum",
        },
        performance: {
            optimizationEnabled: true,
            aggressiveCaching: true,
        },
    });
} else {
    // Development configs
    Configs.merge({
        monitoring: {
            enabled: true,
            detailed: true,
        },
    });
}

// ========================================
// Example 12: Configuration Validation
// ========================================

function validateConfigs() {
    const required = ["server", "security"] as const;

    for (const key of required) {
        if (!Configs.has(key)) {
            throw new Error(`Missing required configuration: ${key}`);
        }
    }

    console.log("All required configurations are present");
}

// ========================================
// Example 13: Dynamic Configuration Updates
// ========================================

function updateMaxFileSize(newSize: number) {
    const currentConfig = Configs.get("fileUpload");

    if (currentConfig) {
        Configs.update("fileUpload", {
            ...currentConfig,
            maxFileSize: newSize,
        });

        console.log(`Max file size updated to ${newSize} bytes`);
    }
}

// ========================================
// Example 14: Configuration Export/Import
// ========================================

function exportConfiguration() {
    const config = Configs.getAll();
    return JSON.stringify(config, null, 2);
}

function importConfiguration(configJson: string) {
    const config = JSON.parse(configJson);
    Configs.set(config);
    console.log("Configuration imported successfully");
}

// ========================================
// Example 15: Using in Route Handlers
// ========================================

app.get("/config/status", (req, res) => {
    res.json({
        initialized: Configs.isInitialized(),
        fileUploadEnabled: Configs.get("fileUpload")?.enabled ?? false,
        securityLevel: Configs.get("security")?.level ?? "none",
        cacheStrategy: Configs.get("cache")?.strategy ?? "none",
    });
});

app.get("/config/all", (req, res) => {
    res.json(Configs.getAll());
});

// ========================================
// Start the server
// ========================================

app.start();

console.log("\n=== XyPriss Configs API Examples ===");
console.log("Server started with Configs API");
console.log("Visit http://localhost:3000/config/status to see config status");
console.log("Visit http://localhost:3000/config/all to see all configs");


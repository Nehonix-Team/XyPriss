/**
 * Type-Safe Configs API Example
 * Demonstrates full TypeScript type safety with the Configs API
 */

import { createServer, Configs } from "../src";
import { FileUploadAPI } from "../src";
import type { FileUploadConfig, ServerOptions } from "../src";

// ========================================
// Example 1: Type-Safe Server Creation
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
        allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
        allowedExtensions: [".jpg", ".jpeg", ".png", ".pdf"],
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
// Example 2: Type-Safe Configuration Access
// ========================================

// Get configuration with proper typing
const fileUploadConfig: FileUploadConfig | undefined =
    Configs.get("fileUpload");
console.log("File Upload Config:", fileUploadConfig);

// TypeScript knows the exact type
if (fileUploadConfig) {
    console.log("Max File Size:", fileUploadConfig.maxFileSize);
    console.log("Storage Type:", fileUploadConfig.storage);
    console.log("Allowed MIME Types:", fileUploadConfig.allowedMimeTypes);
}

// ========================================
// Example 3: Type-Safe File Upload Initialization
// ========================================

async function initializeFileUploadTypeSafe() {
    const upload = new FileUploadAPI();

    // Get typed configuration
    const config: FileUploadConfig | undefined = Configs.get("fileUpload");

    // TypeScript ensures we handle undefined case
    if (!config) {
        console.error("File upload configuration not found");
        return null;
    }

    if (!config.enabled) {
        console.log("File upload is disabled");
        return null;
    }

    // Initialize with type-safe config
    await upload.initialize(config);
    console.log("File upload initialized successfully");

    return upload;
}

// ========================================
// Example 4: Type-Safe Configuration Updates
// ========================================

function updateFileUploadConfig() {
    // Get current config with type safety
    const currentConfig = Configs.get("fileUpload");

    if (currentConfig) {
        // TypeScript knows all available properties
        const updatedConfig: FileUploadConfig = {
            ...currentConfig,
            maxFileSize: 20 * 1024 * 1024, // Update to 20MB
            allowedMimeTypes: [
                ...(currentConfig.allowedMimeTypes || []),
                "application/msword",
            ],
        };

        Configs.update("fileUpload", updatedConfig);
        console.log("Configuration updated successfully");
    }
}

// ========================================
// Example 5: Type-Safe Validation
// ========================================

function validateConfiguration(): boolean {
    // Define required configurations with type safety
    const requiredKeys: Array<keyof ServerOptions> = [
        "server",
        "fileUpload",
        "security",
    ];

    for (const key of requiredKeys) {
        if (!Configs.has(key)) {
            console.error(`Missing required configuration: ${key}`);
            return false;
        }
    }

    // Validate file upload specific settings
    const fileUploadConfig = Configs.get("fileUpload");
    if (fileUploadConfig) {
        if (fileUploadConfig.enabled && !fileUploadConfig.maxFileSize) {
            console.warn("File upload enabled but no maxFileSize specified");
        }

        if (
            fileUploadConfig.storage === "disk" &&
            !fileUploadConfig.destination
        ) {
            console.error("Disk storage requires destination path");
            return false;
        }
    }

    return true;
}

// ========================================
// Example 6: Type-Safe Service Class
// ========================================

class TypeSafeFileService {
    private upload: FileUploadAPI;
    private config: FileUploadConfig;

    constructor() {
        this.upload = new FileUploadAPI();

        // Get config with type safety
        const config = Configs.get("fileUpload");
        if (!config) {
            throw new Error("File upload configuration is required");
        }

        this.config = config;
    }

    async initialize(): Promise<void> {
        if (!this.config.enabled) {
            throw new Error("File upload is not enabled in configuration");
        }

        // Type-safe initialization
        await this.upload.initialize(this.config);
        console.log("TypeSafeFileService initialized");
    }

    getMaxFileSize(): number {
        return this.config.maxFileSize || 1024 * 1024; // Default 1MB
    }

    getAllowedMimeTypes(): string[] {
        return this.config.allowedMimeTypes || [];
    }

    isStorageTypeDisk(): boolean {
        return this.config.storage === "disk";
    }

    getUploadMiddleware(fieldName: string) {
        return this.upload.single(fieldName);
    }
}

// ========================================
// Example 7: Type-Safe Route Handlers
// ========================================

app.get("/config/file-upload", (req, res) => {
    const config: FileUploadConfig | undefined = Configs.get("fileUpload");

    if (!config) {
        return res.status(404).json({
            error: "File upload not configured",
        });
    }

    // TypeScript ensures we only access valid properties
    res.json({
        enabled: config.enabled,
        maxFileSize: config.maxFileSize,
        maxFileSizeMB: config.maxFileSize
            ? (config.maxFileSize / (1024 * 1024)).toFixed(2)
            : "Not set",
        storage: config.storage,
        allowedMimeTypes: config.allowedMimeTypes || [],
        allowedExtensions: config.allowedExtensions || [],
    });
});

app.get("/config/all-typed", (req, res) => {
    // Get all configs with proper typing
    const allConfigs: ServerOptions = Configs.getAll();

    res.json({
        server: allConfigs.server,
        fileUpload: allConfigs.fileUpload,
        security: allConfigs.security,
        cache: allConfigs.cache,
        performance: allConfigs.performance,
    });
});

// ========================================
// Example 8: Type-Safe Default Values
// ========================================

function getFileUploadConfigWithDefaults(): FileUploadConfig {
    return Configs.getOrDefault("fileUpload", {
        enabled: false,
        maxFileSize: 5 * 1024 * 1024, // 5MB default
        storage: "memory",
        allowedMimeTypes: ["image/jpeg", "image/png"],
        allowedExtensions: [".jpg", ".jpeg", ".png"],
    });
}

// ========================================
// Example 9: Type-Safe Conditional Logic
// ========================================

function setupFileUploadRoutes() {
    const config = Configs.get("fileUpload");

    // TypeScript ensures proper type checking
    if (config?.enabled) {
        const maxSize = config.maxFileSize || 1024 * 1024;
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);

        console.log(`Setting up file upload routes with ${maxSizeMB}MB limit`);

        // Setup routes based on storage type
        if (config.storage === "disk") {
            console.log(
                `Using disk storage at: ${config.destination || "./uploads"}`
            );
        } else if (config.storage === "memory") {
            console.log("Using memory storage");
        }
    } else {
        console.log("File upload is disabled");
    }
}

// ========================================
// Run Examples
// ========================================

(async () => {
    console.log("\n=== Type-Safe Configs API Examples ===\n");

    // Validate configuration
    if (!validateConfiguration()) {
        console.error("Configuration validation failed!");
        process.exit(1);
    }

    console.log("✅ Configuration validation passed\n");

    // Initialize file upload
    const upload = await initializeFileUploadTypeSafe();
    if (upload) {
        console.log("✅ File upload initialized\n");
    }

    // Update configuration
    updateFileUploadConfig();
    console.log("✅ Configuration updated\n");

    // Create type-safe service
    const fileService = new TypeSafeFileService();
    await fileService.initialize();
    console.log("✅ Type-safe service initialized\n");

    console.log(`Max file size: ${fileService.getMaxFileSize()} bytes`);
    console.log(
        `Allowed MIME types: ${fileService.getAllowedMimeTypes().join(", ")}`
    );
    console.log(
        `Storage type: ${fileService.isStorageTypeDisk() ? "disk" : "memory"}\n`
    );

    // Setup routes
    setupFileUploadRoutes();

    // Start server
    app.start();

    console.log("\n✅ Server started with type-safe configuration");
    console.log(
        "Visit http://localhost:3000/config/file-upload to see file upload config"
    );
    console.log(
        "Visit http://localhost:3000/config/all-typed to see all configs"
    );
})();


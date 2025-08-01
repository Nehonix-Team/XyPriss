/**
 * Type definitions for Console Interception System
 */

import { LogLevel } from "../../../../../shared/types/logger.type";

/**
 * Enhanced preserve option configuration
 * Provides fine-grained control over console output behavior
 */
export interface PreserveOption {
    enabled: boolean; // Enable/disable preservation
    mode: "original" | "intercepted" | "both" | "none"; // How to display logs
    showPrefix: boolean; // Show [USERAPP] prefix when using intercepted mode
    allowDuplication: boolean; // Allow both original and intercepted to show (for debugging)
    customPrefix?: string; // Custom prefix instead of [USERAPP]
    separateStreams: boolean; // Use separate streams for original vs intercepted
    onlyUserApp: boolean; // Only preserve user app logs, not system logs
    colorize: boolean; // Apply colors to preserved logs
}

export interface ConsoleEncryptionConfig {
    enabled?: boolean;
    algorithm?: "aes-128-gcm" | "aes-192-gcm" | "aes-256-gcm";
    keyDerivation?: "pbkdf2" | "scrypt" | "argon2";
    iterations?: number;
    saltLength?: number;
    ivLength?: number;
    tagLength?: number;
    encoding?: "base64" | "hex";
    key?: string; // Encryption key (set via environment or method)

    //  Display behavior configuration
    displayMode?: "readable" | "encrypted" | "both"; // How to display encrypted logs
    showEncryptionStatus?: boolean; // Show encryption indicators in output

    externalLogging?: {
        enabled?: boolean;
        endpoint?: string;
        headers?: Record<string, string>;
        batchSize?: number;
        flushInterval?: number;
    };
}

export interface ConsoleInterceptionConfig {
    enabled: boolean;
    interceptMethods: readonly (
        | "log"
        | "error"
        | "warn"
        | "info"
        | "debug"
        | "trace"
    )[];
    preserveOriginal: boolean | PreserveOption; // Backward compatibility + new object option
    filterUserCode: boolean;
    performanceMode: boolean;
    sourceMapping: boolean;
    stackTrace: boolean;
    maxInterceptionsPerSecond: number;
    encryption?: ConsoleEncryptionConfig;
    filters: {
        minLevel: "debug" | "info" | "warn" | "error";
        maxLength: number;
        includePatterns: readonly string[];
        excludePatterns: readonly string[];
        // Enhanced categorization
        userAppPatterns?: readonly string[]; // Patterns that identify user app logs
        systemPatterns?: readonly string[]; // Patterns that identify system logs
        categoryBehavior?: {
            userApp?: "intercept" | "passthrough" | "both"; // How to handle user app logs
            system?: "intercept" | "passthrough" | "both"; // How to handle system logs
            unknown?: "intercept" | "passthrough" | "both"; // How to handle unclassified logs
        };
    };
    fallback: {
        onError: "silent" | "console" | "throw";
        gracefulDegradation: boolean;
        maxErrors: number;
    };
}

export interface ConsoleInterceptionStats {
    totalInterceptions: number;
    interceptionsPerSecond: number;
    errorCount: number;
    lastInterceptionTime: number;
    methodCounts: Record<string, number>;
    averageOverhead: number;
    isActive: boolean;
}

export interface InterceptedConsoleCall {
    method: string;
    args: any[];
    timestamp: number;
    source?: string;
    stackTrace?: string;
    level: LogLevel;
}

/**
 * Complete default configuration for console interception
 * Includes all new features: encryption, categorization, and filtering
 */
export const DEFAULT_CONSOLE_CONFIG: ConsoleInterceptionConfig = {
    enabled: false,
    interceptMethods: ["log", "error", "warn", "info", "debug"],
    preserveOriginal: {
        enabled: true,
        mode: "original",
        showPrefix: false,
        allowDuplication: false,
        separateStreams: false,
        onlyUserApp: true,
        colorize: true,
    },
    filterUserCode: true,
    performanceMode: true,
    sourceMapping: false,
    stackTrace: false,
    maxInterceptionsPerSecond: 1000,

    //  Encryption Configuration
    encryption: {
        enabled: false, // Disabled by default, enable for production
        algorithm: "aes-256-gcm",
        keyDerivation: "pbkdf2",
        iterations: 100000,
        saltLength: 32,
        ivLength: 16,
        tagLength: 16,
        encoding: "base64",
        key: undefined, // Set via environment variable or method

        //  Display behavior
        displayMode: "encrypted", // Show encrypted logs by default
        showEncryptionStatus: false, // Don't show encryption indicators by default

        externalLogging: {
            enabled: false,
            endpoint: undefined,
            headers: {},
            batchSize: 100,
            flushInterval: 5000,
        },
    },

    // Advanced Filtering and Categorization
    filters: {
        minLevel: "debug",
        maxLength: 1000,
        includePatterns: [],
        excludePatterns: [
            "node_modules",
            "FastXyPrissServer",
            "express",
            "internal",
        ],

        // 🔧 User Application Patterns (emoji and common prefixes)
        userAppPatterns: [
            "⚡",
            "🛠️",
            "🔍", // Emoji patterns
            "DEBUG:",
            "INFO:",
            "WARN:",
            "ERROR:",
            "SUCCESS:",
            "FAIL:", // Common prefixes
            "Testing",
            "Starting",
            "Completed",
            "Failed",
            "Initializing", // Common words
        ],

        // 🖥️ System/FastXyPrissServer Patterns
        systemPatterns: [
            "UFSIMC-",
            "FastXyPrissServer",
            "[SERVER]",
            "[CACHE]",
            "[CLUSTER]", //XyPriss FastXyPrissServer (FFS)patterns
            "node_modules",
            "internal",
            "express",
            "middleware", // System patterns
        ],

        // Category Behavior Configuration
        categoryBehavior: {
            userApp: "intercept", // Route user app logs through logging system
            system: "intercept", // Route system logs through logging system
            unknown: "intercept", // Route unknown logs through logging system
        },
    },

    // Error Handling and Fallback
    fallback: {
        onError: "console",
        gracefulDegradation: true,
        maxErrors: 10,
    },
};

/**
 * Encryption presets for different security levels
 */
export const ENCRYPTION_PRESETS = {
    // Light encryption for development/testing
    light: {
        enabled: true,
        algorithm: "aes-128-gcm" as const,
        keyDerivation: "pbkdf2" as const,
        iterations: 10000,
        saltLength: 16,
        ivLength: 12,
        tagLength: 16,
        encoding: "base64" as const,
    },

    // Standard encryption for most production use cases
    standard: {
        enabled: true,
        algorithm: "aes-256-gcm" as const,
        keyDerivation: "pbkdf2" as const,
        iterations: 100000,
        saltLength: 32,
        ivLength: 16,
        tagLength: 16,
        encoding: "base64" as const,
    },

    // Heavy encryption for sensitive data
    heavy: {
        enabled: true,
        algorithm: "aes-256-gcm" as const,
        keyDerivation: "pbkdf2" as const,
        iterations: 500000,
        saltLength: 64,
        ivLength: 16,
        tagLength: 16,
        encoding: "hex" as const,
    },
} as const;

/**
 * Preserve option presets for different use cases
 */
export const PRESERVE_PRESETS = {
    // Development: Show original console output only (no duplication)
    development: {
        enabled: true,
        mode: "original" as const,
        showPrefix: false,
        allowDuplication: false,
        separateStreams: false,
        onlyUserApp: true,
        colorize: true,
    },

    // Production: Route through logging system with prefix
    production: {
        enabled: true,
        mode: "intercepted" as const,
        showPrefix: true,
        allowDuplication: false,
        customPrefix: "[APP]",
        separateStreams: true,
        onlyUserApp: true,
        colorize: false,
    },

    // Debug: Show both original and intercepted (for debugging)
    debug: {
        enabled: true,
        mode: "both" as const,
        showPrefix: true,
        allowDuplication: true,
        customPrefix: "[DEBUG]",
        separateStreams: true,
        onlyUserApp: false,
        colorize: true,
    },

    // Silent: No console output at all
    silent: {
        enabled: true,
        mode: "none" as const,
        showPrefix: false,
        allowDuplication: false,
        separateStreams: false,
        onlyUserApp: true,
        colorize: false,
    },

    // Clean: Only intercepted logs with custom formatting
    clean: {
        enabled: true,
        mode: "intercepted" as const,
        showPrefix: false,
        allowDuplication: false,
        separateStreams: true,
        onlyUserApp: true,
        colorize: true,
    },
} as const;


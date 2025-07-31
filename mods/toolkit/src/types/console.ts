/**
 * Console interception type definitions for XyPriss Toolkit
 * 
 * These types are used for console interception configuration
 * within the toolkit module.
 */

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

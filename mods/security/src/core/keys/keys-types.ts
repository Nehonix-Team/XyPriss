/**
 * Key Derivation Types and Interfaces
 * Comprehensive type definitions for the modular key derivation system
 */

import { createEnum } from "../../helpers/createEnu";

// Re-export existing types for backward compatibility
export type { KeyDerivationOptions } from "../../types";

/**
 * Supported key derivation algorithms
 */
// Just add new algorithms here
const algorithms = [
    "pbkdf2",
    "scrypt",
    "argon2",
    "argon2i",
    "argon2d",
    "argon2id",
] as const;

// Auto-generated enum from the array
export const KeyDerivationAlgorithm = createEnum(algorithms);

// Type export
export type KeyDerivationAlgorithm = (typeof algorithms)[number];

/**
 * Hash functions supported for key derivation
 */
export enum KeyDerivationHashFunction {
    SHA256 = "sha256",
    SHA512 = "sha512",
    SHA3_256 = "sha3-256",
    SHA3_512 = "sha3-512",
}

/**
 * Environment types for optimization
 */
export enum RuntimeEnvironment {
    NODE_JS = "nodejs",
    BROWSER = "browser",
    WEB_WORKER = "webworker",
    UNKNOWN = "unknown",
}

/**
 * Algorithm implementation backends
 */
export enum AlgorithmBackend {
    NODE_CRYPTO = "node_crypto",
    EXTERNAL_LIBRARY = "external_library",
    PURE_JS = "pure_js",
    WEB_CRYPTO = "web_crypto",
}

/**
 * Performance optimization levels
 */
export enum OptimizationLevel {
    NONE = "none",
    BASIC = "basic",
    AGGRESSIVE = "aggressive",
    MAXIMUM = "maximum",
}

/**
 * Extended key derivation options with performance settings
 */
export interface ExtendedKeyDerivationOptions {
    // Core options (backward compatible)
    algorithm?: KeyDerivationAlgorithm | string;
    iterations?: number;
    salt?: string | Uint8Array;
    keyLength?: number;
    hashFunction?: KeyDerivationHashFunction | string;

    // Performance options
    optimization?: OptimizationLevel;
    preferredBackend?: AlgorithmBackend;
    timeout?: number;
    enableCaching?: boolean;

    // Memory options
    memoryLimit?: number;
    secureWipe?: boolean;

    // Monitoring options
    enableMetrics?: boolean;
    enableLogging?: boolean;
}

/**
 * Algorithm-specific configuration
 */
export interface AlgorithmConfig {
    // PBKDF2 specific
    pbkdf2?: {
        minIterations: number;
        maxIterations: number;
        defaultIterations: number;
        preferredBackends: AlgorithmBackend[];
    };

    // Scrypt specific
    scrypt?: {
        minCost: number;
        maxCost: number;
        defaultCost: number;
        blockSize: number;
        parallelization: number;
        preferredBackends: AlgorithmBackend[];
    };

    // Argon2 specific
    argon2?: {
        minTimeCost: number;
        maxTimeCost: number;
        defaultTimeCost: number;
        memoryCost: number;
        parallelism: number;
        variant: "argon2i" | "argon2d" | "argon2id";
        preferredBackends: AlgorithmBackend[];
    };
}

/**
 * Performance metrics for key derivation operations
 */
export interface KeyDerivationMetrics {
    algorithm: KeyDerivationAlgorithm;
    backend: AlgorithmBackend;
    executionTime: number;
    memoryUsage: number;
    iterations: number;
    keyLength: number;
    success: boolean;
    errorMessage?: string;
    timestamp: number;
}

/**
 * Algorithm availability and performance information
 */
export interface AlgorithmInfo {
    algorithm: KeyDerivationAlgorithm;
    available: boolean;
    backends: {
        backend: AlgorithmBackend;
        available: boolean;
        performance: number; // Relative performance score
        reliability: number; // Reliability score
    }[];
    recommendedBackend?: AlgorithmBackend;
    lastTested: number;
}

/**
 * Key derivation result with metadata
 */
export interface KeyDerivationResult {
    key: string; // Hex-encoded derived key
    algorithm: KeyDerivationAlgorithm;
    backend: AlgorithmBackend;
    metrics: KeyDerivationMetrics;
    salt: Uint8Array;
    iterations: number;
}

/**
 * Fallback strategy configuration
 */
export interface FallbackStrategy {
    primaryAlgorithm: KeyDerivationAlgorithm;
    fallbackChain: KeyDerivationAlgorithm[];
    maxRetries: number;
    retryDelay: number;
    enableAdaptiveFallback: boolean;
}

/**
 * Logger configuration for key derivation
 */
export interface KeyDerivationLoggerConfig {
    enabled: boolean;
    level: "debug" | "info" | "warn" | "error";
    includeMetrics: boolean;
    includeStackTrace: boolean;
    maxLogEntries: number;
}

/**
 * Cache configuration for key derivation
 */
export interface KeyDerivationCacheConfig {
    enabled: boolean;
    maxEntries: number;
    ttl: number; // Time to live in milliseconds
    keyPrefix: string;
    includeAlgorithm: boolean;
    includeSalt: boolean;
}

/**
 * Main configuration for the key derivation system
 */
export interface KeyDerivationConfig {
    algorithms: AlgorithmConfig;
    fallback: FallbackStrategy;
    performance: {
        optimization: OptimizationLevel;
        enableMetrics: boolean;
        metricsRetention: number;
    };
    logging: KeyDerivationLoggerConfig;
    cache: KeyDerivationCacheConfig;
    security: {
        enableSecureWipe: boolean;
        constantTimeOperations: boolean;
        validateInputs: boolean;
    };
}

/**
 * Environment detection result
 */
export interface EnvironmentInfo {
    type: RuntimeEnvironment;
    hasNodeCrypto: boolean;
    hasWebCrypto: boolean;
    hasWorkerSupport: boolean;
    availableLibraries: string[];
    capabilities: {
        pbkdf2: boolean;
        scrypt: boolean;
        argon2: boolean;
    };
}

/**
 * Algorithm benchmark result
 */
export interface BenchmarkResult {
    algorithm: KeyDerivationAlgorithm;
    backend: AlgorithmBackend;
    operationsPerSecond: number;
    averageTime: number;
    memoryUsage: number;
    reliability: number;
    timestamp: number;
}


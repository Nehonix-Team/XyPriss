/**
 * Key Derivation Module - Main Entry Point
 * High-performance key derivation system
 */

// Core exports
export { OptimizedKeys } from "./keys-core";

// Algorithm implementations
export * from "./algorithms";

// Utilities
export {
    EnvironmentDetector,
    ValidationUtils,
    ConversionUtils,
    PerformanceUtils,
    ALGORITHM_DEFAULTS,
} from "./keys-utils";

// Logger
export { KeyDerivationLogger, keyLogger, LogLevel } from "./keys-logger";

// Types
export * from "./keys-types";

// Backward compatibility - Legacy Keys class wrapper
import { OptimizedKeys } from "./keys-core";
import { KeyDerivationOptions } from "./keys-types";
import { keyLogger } from "./keys-logger";

/**
 * Legacy Keys class for backward compatibility
 * Wraps the new OptimizedKeys implementation
 */
export class Keys {
    /**
     * Derive a key from a password or other input
     * @param input - The input to derive a key from
     * @param options - Key derivation options
     * @returns The derived key as a hex string
     */
    public static deriveKey(
        input: string | Uint8Array,
        options: KeyDerivationOptions = {}
    ): string {
        return OptimizedKeys.getInstance().deriveKey(input, options);
    }

    /**
     * Get performance metrics (new feature)
     */
    public static getMetrics() {
        return OptimizedKeys.getInstance().getMetrics();
    }

    /**
     * Get environment information (new feature)
     */
    public static getEnvironmentInfo() {
        return OptimizedKeys.getInstance().getEnvironmentInfo();
    }

    /**
     * Get recommended algorithm for current environment (new feature)
     */
    public static getRecommendedAlgorithm() {
        return OptimizedKeys.getInstance().getRecommendedAlgorithm();
    }
}

/**
 * Initialize the key derivation system with custom configuration
 */
export function initializeKeyDerivation(config?: {
    logging?: {
        enabled?: boolean;
        level?: "debug" | "info" | "warn" | "error";
    };
}) {
    if (config?.logging) {
        keyLogger.updateConfig(config.logging);
    }

    return OptimizedKeys.getInstance();
}

// Default export for convenience
export default Keys;


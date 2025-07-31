/**
 * XyPrissSecurity - Fortified Function Core Module
 * Exports for the core modular system
 */

// Export main optimized class (migrated to minimal modular architecture)
export { FortifiedFunctionCore } from "./fortified-function-core";

// Keep backward compatibility
export { FortifiedFunctionCore as OptimizedFortifiedFunction } from "./fortified-function-core";

// Export types
export * from "../types/fortified-types";

// Export configuration management
export {
    fortifiedConfig,
    FortifiedConfig,
    PERFORMANCE_PROFILES,
    DEFAULT_CONFIG,
} from "./fortified-config";
export type { PerformanceProfile } from "./fortified-config";

// Export logging system
export { fortifiedLogger, FortifiedLogger, LogLevel } from "./fortified-logger";
export type { LogEntry } from "./fortified-logger";


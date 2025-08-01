/**
 * Hash module - Re-export from modular hash structure
 * This file maintains backward compatibility while using the new modular architecture
 */

// Export everything from the modular hash structure
export * from "./hash";

// Ensure the main Hash class is available as a named export
export { Hash } from "./hash/hash-core";
export { HashStrength } from "./hash/hash-types";

// Export additional utilities that might be needed
export { HashUtils } from "./hash/hash-utils";
export { HashValidator } from "./hash/hash-validator";
export { HashSecurity } from "./hash/hash-security";
export { HashAdvanced } from "./hash/hash-advanced";
export { HashEntropy } from "./hash/hash-entropy";
export { HashAlgorithms } from "../algorithms/hash-algorithms";

// Export types for TypeScript users
export type {
    HashSecurityLevel,
    HashMonitoringResult,
    HashEntropyAnalysis,
    HashAgilityResult,
    HSMHashOptions,
    SideChannelOptions,
    HashConfiguration,
    StrengthConfiguration,
    HSMIntegrityResult,
    HashOperationData,
    AgilityHashOptions,
} from "./hash/hash-types";

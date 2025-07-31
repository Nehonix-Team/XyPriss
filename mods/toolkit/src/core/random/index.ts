/**
 * Random module - Main entry point for all random generation functionality
 * Modular architecture for maintainable and scalable random operations
 */

// Export everything from the modular random structure
export * from "./random-core";
export * from "./random-types";
export * from "./random-entropy";
export * from "./random-sources"; 
export * from "./random-generators";
export * from "./random-tokens";
export * from "./random-crypto";
export * from "./random-security";

// Ensure the main SecureRandom class is available as a named export
export { SecureRandom } from "./random-core";

// Export types for TypeScript users
export type {
    RNGState,
    EntropyQuality,
    SodiumInterface,
    ForgeInterface,
    SecureRandomInterface,
    RandomBytesInterface,
    NobleHashesInterface,
    TweetNaClInterface,
    RandomGenerationOptions,
    EntropySourceConfig,
    SecurityMonitoringResult,
    QuantumSafeOptions,
    TokenGenerationOptions,
    IVGenerationOptions,
    CryptoUtilityOptions,
} from "./random-types";


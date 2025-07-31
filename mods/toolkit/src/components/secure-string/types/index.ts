/**
 * Type definitions for SecureString modular architecture
 */

import type {
    HashAlgorithm,
    HashOutputFormat,
    HMACAlgorithm,
    HMACOptions,
    PBKDF2Options,
} from "../../../types/string";

/**
 * Configuration options for SecureString
 */
export interface SecureStringOptions {
    /** Protection level for the underlying buffer */
    protectionLevel?: "basic" | "enhanced" | "maximum";
    /** Enable encryption for the buffer */
    enableEncryption?: boolean;
    /** Enable fragmentation for the buffer */
    enableFragmentation?: boolean;
    /** Enable canaries for the buffer */
    enableCanaries?: boolean;
    /** Enable obfuscation for the buffer */
    enableObfuscation?: boolean;
    /** Auto-lock the buffer */
    autoLock?: boolean;
    /** Use quantum-safe protection */
    quantumSafe?: boolean;
    /** Text encoding to use */
    encoding?: string;
    /** Enable advanced memory tracking */
    enableMemoryTracking?: boolean;
}

/**
 * String manipulation operation types
 */
export type StringOperation =
    | "append"
    | "prepend"
    | "replace"
    | "substring"
    | "trim"
    | "toUpperCase"
    | "toLowerCase";

/**
 * String comparison result
 */
export interface ComparisonResult {
    isEqual: boolean;
    timeTaken?: number;
    constantTime: boolean;
}

/**
 * String search options
 */
export interface SearchOptions {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    startPosition?: number;
    endPosition?: number;
}

/**
 * String split options
 */
export interface SplitOptions {
    limit?: number;
    removeEmpty?: boolean;
    trim?: boolean;
}

/**
 * Hash operation options
 */
export interface HashOperationOptions {
    algorithm?: HashAlgorithm;
    format?: HashOutputFormat;
    iterations?: number;
    salt?: string | Uint8Array;
}

/**
 * HMAC operation options
 */
export interface HMACOperationOptions extends HMACOptions {
    format?: HashOutputFormat;
}

/**
 * Key derivation options
 */
export interface KeyDerivationOptions extends PBKDF2Options {
    format?: HashOutputFormat;
}

/**
 * String validation result
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    score?: number;
}

/**
 * String statistics
 */
export interface StringStatistics {
    length: number;
    byteLength: number;
    characterCount: Record<string, number>;
    hasUpperCase: boolean;
    hasLowerCase: boolean;
    hasNumbers: boolean;
    hasSpecialChars: boolean;
    entropy: number;
}

/**
 * String transformation options
 */
export interface TransformationOptions {
    preserveCase?: boolean;
    preserveSpacing?: boolean;
    encoding?: string;
    normalize?: boolean;
}

/**
 * Event types for SecureString operations
 */
export type SecureStringEvent =
    | "created"
    | "modified"
    | "accessed"
    | "hashed"
    | "compared"
    | "destroyed";

/**
 * Event listener callback for SecureString
 */
export type SecureStringEventListener = (
    event: SecureStringEvent,
    details?: any
) => void;

/**
 * Memory usage information
 */
export interface MemoryUsage {
    bufferSize: number;
    actualLength: number;
    overhead: number;
    isFragmented: boolean;
    isEncrypted: boolean;
}

/**
 * Export commonly used types from string types
 */
export type {
    HashAlgorithm,
    HashOutputFormat,
    HMACAlgorithm,
    HMACOptions,
    PBKDF2Options,
} from "../../../types/string";

/**
 * Default options for SecureString
 */
export const DEFAULT_SECURE_STRING_OPTIONS: Required<SecureStringOptions> = {
    protectionLevel: "basic",
    enableEncryption: false,
    enableFragmentation: false,
    enableCanaries: false,
    enableObfuscation: false,
    autoLock: false,
    quantumSafe: false,
    encoding: "utf-8",
    enableMemoryTracking: true,
} as const;

/**
 * Default search options
 */
export const DEFAULT_SEARCH_OPTIONS: Required<SearchOptions> = {
    caseSensitive: true,
    wholeWord: false,
    startPosition: 0,
    endPosition: -1,
} as const;

/**
 * Default split options
 */
export const DEFAULT_SPLIT_OPTIONS: Required<SplitOptions> = {
    limit: -1,
    removeEmpty: false,
    trim: false,
} as const;



/**
 * Advanced entropy analysis results
 */
export interface EntropyAnalysisResult {
    shannonEntropy: number;
    minEntropy: number;
    maxEntropy: number;
    diversityScore: number;
    patternComplexity: number;
    characterDistribution: Record<string, number>;
    bigramEntropy: number;
    trigramEntropy: number;
    predictability: number;
    randomnessScore: number;
    recommendations: string[];
}

/**
 * Pattern analysis results
 */
export interface PatternAnalysisResult {
    repeatingPatterns: Array<{
        pattern: string;
        count: number;
        positions: number[];
    }>;
    sequentialPatterns: Array<{
        pattern: string;
        type: "ascending" | "descending";
    }>;
    keyboardPatterns: Array<{ pattern: string; layout: string }>;
    dictionaryWords: Array<{
        word: string;
        position: number;
        confidence: number;
    }>;
    commonSubstitutions: Array<{ original: string; substituted: string }>;
    overallComplexity: number;
}

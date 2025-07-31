/**
 * Random types - Type definitions and interfaces for random operations
 */

import { EntropySource, SecurityLevel } from "../../types";

// Re-export types that are used by other modules
export { EntropySource, SecurityLevel };

// Create type alias for encoding
export type EncodingHashType = "hex" | "base64" | "base58" | "buffer";

// ============================================================================
// CORE ENUMS AND STATES
// ============================================================================

export enum RNGState {
    UNINITIALIZED = "uninitialized",
    INITIALIZING = "initializing",
    READY = "ready",
    ERROR = "error",
    RESEEDING = "reseeding",
}

export enum EntropyQuality {
    POOR = "poor",
    FAIR = "fair",
    GOOD = "good",
    EXCELLENT = "excellent",
    MILITARY = "military",
}

// ============================================================================
// LIBRARY INTERFACES
// ============================================================================

export interface SodiumInterface {
    ready: Promise<void> | boolean;
    randombytes_buf: (size: number) => Uint8Array;
    crypto_secretbox_NONCEBYTES: number;
    crypto_secretbox_KEYBYTES: number;
    crypto_aead_chacha20poly1305_ietf_encrypt: (
        message: Uint8Array,
        additionalData: Uint8Array | null,
        secretNonce: Uint8Array | null,
        publicNonce: Uint8Array,
        key: Uint8Array
    ) => Uint8Array;
    crypto_aead_chacha20poly1305_ietf_decrypt: (
        secretNonce: Uint8Array | null,
        ciphertext: Uint8Array,
        additionalData: Uint8Array | null,
        publicNonce: Uint8Array,
        key: Uint8Array
    ) => Uint8Array;
}

export interface ForgeInterface {
    random: {
        getBytesSync: (count: number) => string;
    };
}

export interface SecureRandomInterface {
    randomBytes?: (size: number) => Uint8Array;
    (size: number): Uint8Array; // Call signature for direct invocation
}

export interface RandomBytesInterface {
    (size: number): Buffer;
}

export interface TweetNaClInterface {
    randomBytes: (size: number) => Uint8Array;
}

export interface NobleHashesInterface {
    sha256: (data: Uint8Array) => Uint8Array;
    sha512: (data: Uint8Array) => Uint8Array;
    blake3?: (data: Uint8Array) => Uint8Array; // Optional blake3 support
}

// ============================================================================
// CONFIGURATION INTERFACES
// ============================================================================

export interface RandomGenerationOptions {
    useEntropyPool?: boolean;
    quantumSafe?: boolean;
    reseedThreshold?: number;
    securityLevel?: SecurityLevel;
    validateOutput?: boolean;
}

export interface EntropySourceConfig {
    name: string;
    enabled: boolean;
    priority: number;
    fallbackAvailable: boolean;
    lastUsed?: number;
    errorCount?: number;
}

export interface QuantumSafeOptions {
    enabled: boolean;
    algorithm?: "kyber" | "dilithium" | "falcon";
    keySize?: number;
    additionalEntropy?: boolean;
}

export interface TokenGenerationOptions {
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
    excludeSimilarCharacters?: boolean;
    entropyLevel?: SecurityLevel;
    outputFormat?: EncodingHashType;
    customCharset?: string;
    minEntropy?: number;
}

export interface IVGenerationOptions {
    algorithm?:
        | "aes-128-cbc"
        | "aes-192-cbc"
        | "aes-256-cbc"
        | "aes-128-gcm"
        | "aes-192-gcm"
        | "aes-256-gcm"
        | "aes-128-ctr"
        | "aes-192-ctr"
        | "aes-256-ctr"
        | "chacha20"
        | "chacha20-poly1305"
        | "des-ede3-cbc"
        | "blowfish-cbc";
    quantumSafe?: boolean;
    useEntropyPool?: boolean;
    validateSize?: boolean;
}

export interface CryptoUtilityOptions {
    keySize?: number;
    algorithm?: string;
    quantumSafe?: boolean;
    useHardwareEntropy?: boolean;
    validateStrength?: boolean;
}

// ============================================================================
// MONITORING AND SECURITY INTERFACES
// ============================================================================

export interface SecurityMonitoringResult {
    entropyQuality: EntropyQuality;
    securityLevel: SecurityLevel;
    threats: string[];
    recommendations: string[];
    timestamp: number;
    bytesGenerated: number;
    reseedCount: number;
    libraryStatus: Record<string, boolean>;
}

export interface EntropyAnalysisResult {
    shannonEntropy: number;
    minEntropy: number;
    compressionRatio: number;
    randomnessScore: number;
    qualityGrade: EntropyQuality;
    recommendations: string[];
    testResults: {
        monobitTest: { passed: boolean; score: number };
        runsTest: { passed: boolean; score: number };
        frequencyTest: { passed: boolean; score: number };
        serialTest: { passed: boolean; score: number };
    };
}

export interface LibraryStatus extends Record<string, boolean> {
    sodium: boolean;
    forge: boolean;
    secureRandom: boolean;
    randombytes: boolean;
    nobleHashes: boolean;
    tweetnacl: boolean;
    kyber: boolean;
    entropyString: boolean;
    cryptoJs: boolean;
    elliptic: boolean;
    nobleCurves: boolean;
}

// ============================================================================
// INTERNAL STATE INTERFACES
// ============================================================================

export interface RandomState {
    entropyPool: Buffer;
    lastReseed: number;
    state: RNGState;
    bytesGenerated: number;
    entropyQuality: EntropyQuality;
    securityLevel: SecurityLevel;
    quantumSafeMode: boolean;
    reseedCounter: number;
    hardwareEntropyAvailable: boolean;
    sidechannelProtection: boolean;
    entropyAugmentation: boolean;
    realTimeMonitoring: boolean;
    lastEntropyTest: number;
    entropyTestResults: Map<string, number>;
    securityAlerts: string[];
    additionalEntropySources: Map<string, () => Buffer>;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type EntropySourceFunction = () => Buffer;
export type SecurityValidator = (data: Uint8Array) => boolean;
export type EntropyCollector = (size: number) => Buffer;

// ============================================================================
// ALGORITHM SPECIFIC TYPES
// ============================================================================

export interface AlgorithmConfig {
    name: string;
    keySize: number;
    ivSize: number;
    blockSize: number;
    securityLevel: SecurityLevel;
    quantumResistant: boolean;
}

export interface CipherConfig extends AlgorithmConfig {
    mode: "cbc" | "gcm" | "ctr" | "ecb";
    authTagLength?: number;
    nonceSize?: number;
}

// ============================================================================
// EXPORT COLLECTIONS
// ============================================================================

export type RandomOptions = RandomGenerationOptions &
    QuantumSafeOptions &
    CryptoUtilityOptions;
export type AllRandomTypes = RandomState &
    SecurityMonitoringResult &
    EntropyAnalysisResult;


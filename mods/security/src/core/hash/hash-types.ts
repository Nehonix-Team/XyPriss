/**
 * Hash types and interfaces
 * Centralized type definitions for the hash module
 */

// Hash strength levels
export enum HashStrength {
    WEAK = "WEAK",
    FAIR = "FAIR",
    GOOD = "GOOD",
    STRONG = "STRONG",
    MILITARY = "MILITARY",
}

// Security levels for monitoring
export type HashSecurityLevel = "LOW" | "MEDIUM" | "HIGH" | "MILITARY";

// Hash monitoring result interface
export interface HashMonitoringResult {
    securityLevel: HashSecurityLevel;
    threats: string[];
    recommendations: string[];
    timestamp: number;
}

// Entropy analysis result interface
export interface HashEntropyAnalysis {
    shannonEntropy: number;
    minEntropy: number;
    compressionRatio: number;
    randomnessScore: number;
    qualityGrade: "POOR" | "FAIR" | "GOOD" | "EXCELLENT";
    recommendations: string[];
}

// Cryptographic agility result interface
export interface HashAgilityResult {
    hash: string | Buffer;
    algorithm: string;
    fallbacks: string[];
    metadata: {
        version: string;
        timestamp: number;
        strength: string;
    };
}

// HSM hash options interface
export interface HSMHashOptions {
    keySlot?: number;
    algorithm?: "sha256" | "sha512" | "sha3-256";
    outputFormat?: "hex" | "base64" | "buffer";
    validateIntegrity?: boolean;
}

// Side-channel resistance options interface
export interface SideChannelOptions {
    constantTime?: boolean;
    memoryProtection?: boolean;
    powerAnalysisResistant?: boolean;
    outputFormat?: "hex" | "base64" | "buffer";
}

// Hash configuration interface
export interface HashConfiguration {
    algorithm: string;
    iterations: number;
    saltLength: number;
    keyLength: number;
    memoryCost?: number;
    timeCost?: number;
    parallelism?: number;
}

// Strength configuration mapping
export interface StrengthConfiguration {
    minIterations: number;
    saltLength: number;
    algorithm?: string;
    memoryCost?: number;
    timeCost?: number;
    parallelism?: number;
    hashLength?: number;
    fallbackIterations?: number;
}

// HSM integrity verification result
export interface HSMIntegrityResult {
    valid: boolean;
    details: string;
}

// Hash operation data for monitoring
export interface HashOperationData {
    input: string | Uint8Array;
    algorithm: string;
    iterations: number;
}

// Agility hash options
export interface AgilityHashOptions {
    primaryAlgorithm?: "sha256" | "sha512" | "blake3" | "sha3-256";
    fallbackAlgorithms?: string[];
    futureProof?: boolean;
    outputFormat?: "hex" | "base64" | "buffer";
}


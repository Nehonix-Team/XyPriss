/**
 * 🔐 Password Management Types & Interfaces
 *
 * Type definitions for the modular password management system
 */

/**
 * Password encryption algorithms supported
 */
export enum PasswordAlgorithm {
    ARGON2ID = "argon2id", // Recommended for new applications
    ARGON2I = "argon2i", // Memory-hard, side-channel resistant
    ARGON2D = "argon2d", // Memory-hard, faster
    SCRYPT = "scrypt", // Alternative memory-hard function
    PBKDF2_SHA512 = "pbkdf2-sha512", // Traditional but secure
    BCRYPT_PLUS = "bcrypt-plus", // Enhanced bcrypt with additional layers
    MILITARY = "military", // Maximum security multi-layer approach
}

/**
 * Password security levels
 */
export enum PasswordSecurityLevel {
    STANDARD = "standard", // Good for most applications
    HIGH = "high", // Enhanced security
    MAXIMUM = "maximum", // Maximum security
    MILITARY = "military", // Military-grade security
    QUANTUM_RESISTANT = "quantum-resistant", // Post-quantum security
}

/**
 * Password hashing options
 */
export interface PasswordHashOptions {
    algorithm?: PasswordAlgorithm;
    securityLevel?: PasswordSecurityLevel;
    iterations?: number;
    memorySize?: number; // For memory-hard functions (KB)
    parallelism?: number; // For Argon2
    saltLength?: number;
    pepper?: string; // Additional secret
    encryptionKey?: string; // For encrypted storage
    quantumResistant?: boolean;
    timingSafe?: boolean;
    secureWipe?: boolean;
}

/**
 * Password verification result
 */
export interface PasswordVerificationResult {
    isValid: boolean;
    needsRehash?: boolean; // If password should be upgraded
    securityLevel: PasswordSecurityLevel;
    algorithm: PasswordAlgorithm;
    timeTaken: number; // Verification time in ms
    recommendations?: string[];
}

/**
 * Password hash metadata
 */
export interface PasswordHashMetadata {
    algorithm: PasswordAlgorithm;
    securityLevel: PasswordSecurityLevel;
    iterations: number;
    memorySize?: number;
    parallelism?: number;
    saltLength: number;
    hasEncryption: boolean;
    hasPepper: boolean;
    timestamp: number;
    version: string;
}

/**
 * Password strength analysis result
 */
export interface PasswordStrengthAnalysis {
    score: number; // 0-100 strength score
    feedback: string[]; // Improvement suggestions
    entropy: number; // Calculated entropy
    estimatedCrackTime: string; // Human-readable crack time
    vulnerabilities: string[]; // Security vulnerabilities found
    details: {
        length: number;
        hasUppercase: boolean;
        hasLowercase: boolean;
        hasNumbers: boolean;
        hasSymbols: boolean;
        hasRepeated: boolean;
        hasSequential: boolean;
        hasCommonPatterns: boolean;
    };
}

/**
 * Password generation options
 */
export interface PasswordGenerationOptions {
    length?: number;
    includeUppercase?: boolean;
    includeLowercase?: boolean;
    includeNumbers?: boolean;
    includeSymbols?: boolean;
    excludeSimilar?: boolean;
    minStrengthScore?: number;
    customCharset?: string;
    excludeChars?: string;
    requireAll?: boolean; // Require at least one from each enabled category
}

/**
 * Password generation result
 */
export interface PasswordGenerationResult {
    password: string;
    strength: PasswordStrengthAnalysis;
    metadata: {
        generatedAt: number;
        algorithm: string;
        entropy: number;
    };
}

/**
 * Migration result from other password systems
 */
export interface PasswordMigrationResult {
    newHash: string;
    migrated: boolean;
    originalAlgorithm?: string;
    newAlgorithm: PasswordAlgorithm;
    securityImprovement: number; // Percentage improvement
    recommendations?: string[];
}

/**
 * Password policy configuration
 */
export interface PasswordPolicy {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSymbols: boolean;
    minStrengthScore: number;
    forbiddenPatterns: RegExp[];
    forbiddenWords: string[];
    maxAge?: number; // Password expiration in days
    preventReuse?: number; // Number of previous passwords to check
}

/**
 * Password validation result
 */
export interface PasswordValidationResult {
    isValid: boolean;
    violations: string[];
    score: number;
    suggestions: string[];
}

/**
 * Password storage options
 */
export interface PasswordStorageOptions {
    encrypt?: boolean;
    encryptionKey?: string;
    compress?: boolean;
    includeMetadata?: boolean;
    format?: "compact" | "verbose";
}

/**
 * Argon2 specific options
 */
export interface Argon2Options {
    variant: "i" | "d" | "id";
    memory: number; // Memory usage in KB
    iterations: number; // Time cost
    parallelism: number; // Parallel threads
    hashLength: number; // Output hash length
    saltLength: number; // Salt length
}

/**
 * Scrypt specific options
 */
export interface ScryptOptions {
    N: number; // CPU/memory cost parameter
    r: number; // Block size parameter
    p: number; // Parallelization parameter
    dkLen: number; // Derived key length
    saltLength: number; // Salt length
}

/**
 * PBKDF2 specific options
 */
export interface PBKDF2Options {
    iterations: number;
    hashFunction: "sha256" | "sha512" | "sha3-256" | "sha3-512";
    keyLength: number;
    saltLength: number;
}

/**
 * Password manager configuration
 */
export interface PasswordManagerConfig {
    defaultAlgorithm: PasswordAlgorithm;
    defaultSecurityLevel: PasswordSecurityLevel;
    globalPepper?: string;
    encryptionKey?: string;
    policy?: PasswordPolicy;
    timingSafeVerification: boolean;
    secureMemoryWipe: boolean;
    enableMigration: boolean;
}

/**
 * Password audit result
 */
export interface PasswordAuditResult {
    totalPasswords: number;
    weakPasswords: number;
    outdatedHashes: number;
    needsRehash: number;
    securityScore: number;
    recommendations: string[];
    details: {
        algorithmDistribution: Record<PasswordAlgorithm, number>;
        securityLevelDistribution: Record<PasswordSecurityLevel, number>;
        averageStrength: number;
        oldestHash: number;
    };
}

/**
 * Re-export commonly used types from other modules
 */
export { SecurityLevel } from "../../types";
export type { EncodingHashType } from "../random/random-types";


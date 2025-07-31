import SecureString from "../components/secure-string";

/**
 * Options for HMAC operations
 */
export interface HMACOptions {
    key: string | SecureString | Uint8Array;
    algorithm: HMACAlgorithm;
}

/**
 * Options for PBKDF2 key derivation
 */
export interface PBKDF2Options {
    salt: string | Uint8Array;
    iterations: number;
    keyLength: number;
    hash: HashAlgorithm;
}

/**
 * Options for HKDF key derivation
 */
export interface HKDFOptions {
    salt?: string | Uint8Array;
    info?: string | Uint8Array;
    keyLength: number;
    hash: HashAlgorithm;
}

/**
 * Hash output formats
 */
export type HashOutputFormat = "hex" | "base64" | "base64url" | "uint8array";

/**
 * Supported cryptographic hash algorithms
 */
export type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

/**
 * Supported HMAC algorithms
 */
export type HMACAlgorithm =
    | "HMAC-SHA-1"
    | "HMAC-SHA-256"
    | "HMAC-SHA-384"
    | "HMAC-SHA-512";

/**
 * Supported key derivation algorithms
 */
export type KDFAlgorithm = "PBKDF2" | "HKDF";

/**
 * All supported cryptographic algorithms
 */
export type CryptoAlgorithm = HashAlgorithm | HMACAlgorithm | KDFAlgorithm;

/**
 * Algorithm metadata including output size and security level
 */
export interface AlgorithmInfo {
    readonly name: string;
    readonly outputSize: number; // in bytes
    readonly securityLevel: "weak" | "acceptable" | "strong" | "very-strong";
    readonly deprecated: boolean;
    readonly description: string;
}

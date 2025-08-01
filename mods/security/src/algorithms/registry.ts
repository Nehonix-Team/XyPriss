import { AlgorithmInfo, CryptoAlgorithm } from "../types/string";

/** 
 * Comprehensive algorithm registry with metadata
 */
export const ALGORITHM_REGISTRY: Record<CryptoAlgorithm, AlgorithmInfo> = {
    // Hash Algorithms
    "SHA-1": {
        name: "SHA-1",
        outputSize: 20,
        securityLevel: "weak",
        deprecated: true,
        description: "SHA-1 - Deprecated due to collision vulnerabilities",
    },
    "SHA-256": {
        name: "SHA-256",
        outputSize: 32,
        securityLevel: "strong",
        deprecated: false,
        description: "SHA-256 - Recommended general-purpose hash function",
    },
    "SHA-384": {
        name: "SHA-384",
        outputSize: 48,
        securityLevel: "very-strong",
        deprecated: false,
        description: "SHA-384 - High-security hash function",
    },
    "SHA-512": {
        name: "SHA-512",
        outputSize: 64,
        securityLevel: "very-strong",
        deprecated: false,
        description: "SHA-512 - Maximum security hash function",
    },

    // HMAC Algorithms
    "HMAC-SHA-1": {
        name: "HMAC-SHA-1",
        outputSize: 20,
        securityLevel: "acceptable",
        deprecated: true,
        description: "HMAC with SHA-1 - Legacy support only",
    },
    "HMAC-SHA-256": {
        name: "HMAC-SHA-256",
        outputSize: 32,
        securityLevel: "strong",
        deprecated: false,
        description: "HMAC with SHA-256 - Recommended for authentication",
    },
    "HMAC-SHA-384": {
        name: "HMAC-SHA-384",
        outputSize: 48,
        securityLevel: "very-strong",
        deprecated: false,
        description: "HMAC with SHA-384 - High-security authentication",
    },
    "HMAC-SHA-512": {
        name: "HMAC-SHA-512",
        outputSize: 64,
        securityLevel: "very-strong",
        deprecated: false,
        description: "HMAC with SHA-512 - Maximum security authentication",
    },

    // Key Derivation Functions
    PBKDF2: {
        name: "PBKDF2",
        outputSize: 0, // Variable
        securityLevel: "strong",
        deprecated: false,
        description: "PBKDF2 - Password-based key derivation function",
    },
    HKDF: {
        name: "HKDF",
        outputSize: 0, // Variable
        securityLevel: "very-strong",
        deprecated: false,
        description: "HKDF - HMAC-based key derivation function",
    },
};

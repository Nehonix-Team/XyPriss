/**
 * Constants used throughout the library
 */

/**
 * Character sets for token generation
 */
export const CHAR_SETS = {
    /**
     * Uppercase letters
     */
    UPPERCASE: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",

    /**
     * Lowercase letters
     */
    LOWERCASE: "abcdefghijklmnopqrstuvwxyz",

    /**
     * Numeric characters
     */
    NUMBERS: "0123456789",

    /**
     * Special symbols
     */
    SYMBOLS: "!@#$%^&*()_+-=[]{}|;:,.<>?",

    /**
     * Similar characters that can be confused
     */
    SIMILAR_CHARS: "il1Lo0O",

    /**
     * Base58 alphabet (Bitcoin style, no similar characters)
     */
    BASE58: "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",

    /**
     * Base32 alphabet (RFC 4648)
     */
    BASE32: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
};

/**
 * Default security parameters
 */
export const SECURITY_DEFAULTS = {
    /**
     * Default token length
     */
    TOKEN_LENGTH: 32,

    /**
     * Default number of iterations for PBKDF2
     */
    PBKDF2_ITERATIONS: 100000,

    /**
     * Default key length in bytes
     */
    KEY_LENGTH: 32,

    /**
     * Default session token expiration (24 hours in seconds)
     */
    SESSION_EXPIRATION: 86400,

    /**
     * Minimum recommended password length
     */
    MIN_PASSWORD_LENGTH: 12,

    /**
     * Default API key random part length
     */
    API_KEY_RANDOM_LENGTH: 24,
};

/**
 * Algorithm constants
 */
export const ALGORITHM_CONSTANTS = {
    /**
     * SHA-256 block size in bytes
     */
    SHA256_BLOCK_SIZE: 64,

    /**
     * SHA-256 digest size in bytes
     */
    SHA256_DIGEST_SIZE: 32,

    /**
     * SHA-512 block size in bytes
     */
    SHA512_BLOCK_SIZE: 128,

    /**
     * SHA-512 digest size in bytes
     */
    SHA512_DIGEST_SIZE: 64,

    /**
     * Initial hash values for SHA-256
     */
    SHA256_INIT: [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
        0x1f83d9ab, 0x5be0cd19,
    ],

    /**
     * Round constants for SHA-256
     */
    SHA256_K: [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
        0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
        0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
        0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
        0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
    ],
};

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
    INVALID_LENGTH: "Invalid length specified",
    INVALID_ALGORITHM: "Invalid algorithm specified",
    INVALID_ITERATIONS: "Invalid number of iterations specified",
    INVALID_SALT: "Invalid salt specified",
    INVALID_FORMAT: "Invalid output format specified",
    INVALID_ENTROPY: "Invalid entropy level specified",
    CRYPTO_UNAVAILABLE:
        "Cryptographically secure random number generation is not available",
    INVALID_TOKEN_TYPE: "Invalid token type specified",
    INVALID_API_KEY: "Invalid API key format",
    INVALID_SESSION_TOKEN: "Invalid session token format",
    WEAK_PASSWORD: "Password does not meet minimum security requirements",
};

// Enhanced security constants
export const SECURITY_CONSTANTS = {
    MIN_ENTROPY_BITS: 128,
    RECOMMENDED_ENTROPY_BITS: 256,
    MAX_ENTROPY_BITS: 512,
    ENTROPY_POOL_SIZE: 4096,
    RESEED_THRESHOLD: 1000000, // Reseed after 1M bytes
    MIN_SECURE_LENGTH: 16,
    TIMING_ATTACK_DELAY: 100, // milliseconds
    QUANTUM_RESISTANCE_BITS: 384,
} as const;

// Hash security constants
export const HASH_SECURITY_CONSTANTS = {
    MIN_ITERATIONS: 10000,
    RECOMMENDED_ITERATIONS: 50000,
    HIGH_SECURITY_ITERATIONS: 100000,
    MIN_SALT_LENGTH: 16,
    RECOMMENDED_SALT_LENGTH: 32,
    MAX_SALT_LENGTH: 64,
    TIMING_ATTACK_DELAY: 100, // milliseconds
};

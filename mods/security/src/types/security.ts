/**
 * Entropy source for random generation
 */
export enum EntropySource {
    /**
     * Cryptographically secure random number generator
     */
    CSPRNG = "csprng",

    /**
     * System time-based entropy
     */
    TIME = "time",

    /**
     * Math.random() based entropy (fallback, not secure)
     */
    MATH_RANDOM = "math_random",

    /**
     * Custom entropy source
     */
    CUSTOM = "custom",
}

/**
 * Security level for cryptographic operations
 */
export enum SecurityLevel {
    /**
     * Low security (basic protection)
     */
    LOW = "low",

    /**
     * Medium security (moderate protection)
     */
    MEDIUM = "medium",

    /**
     * High security (suitable for most applications)
     */
    HIGH = "high",

    /**
     * Maximum security (suitable for highly sensitive applications)
     */
    MAXIMUM = "maximum",

    /**
     * Military-grade security (highest level of protection)
     */
    MILITARY = "military",
}

/**
 * Token type for different use cases
 */
export enum TokenType {
    /**
     * General purpose token
     */
    GENERAL = "general",

    /**
     * API key
     */
    API_KEY = "api_key",

    /**
     * Session token
     */
    SESSION = "session",

    /**
     * JWT secret
     */
    JWT_SECRET = "jwt_secret",

    /**
     * TOTP secret
     */
    TOTP_SECRET = "totp_secret",

    /**
     * Password reset token
     */
    PASSWORD_RESET = "password_reset",

    /**
     * Email verification token
     */
    EMAIL_VERIFICATION = "email_verification",
}

/**
 * Hash algorithm type
 */
export enum HashAlgorithm {
    /**
     * SHA-256 algorithm
     */
    SHA256 = "sha256",

    /**
     * SHA-512 algorithm
     */
    SHA512 = "sha512",

    /**
     * SHA-3 algorithm
     */
    SHA3 = "sha3",

    /**
     * BLAKE3 algorithm
     */
    BLAKE3 = "blake3",
}

/**
 * Key derivation algorithm type
 */
export enum KeyDerivationAlgorithm {
    /**
     * PBKDF2 algorithm
     */
    PBKDF2 = "pbkdf2",

    /**
     * Scrypt algorithm
     */
    SCRYPT = "scrypt",

    /**
     * Argon2 algorithm
     */
    ARGON2 = "argon2",
}

/**
 * Output format for cryptographic operations
 */
export enum OutputFormat {
    /**
     * Hexadecimal string
     */
    HEX = "hex",

    /**
     * Base64 encoded string
     */
    BASE64 = "base64",

    /**
     * Base58 encoded string
     */
    BASE58 = "base58",

    /**
     * Raw buffer
     */
    BUFFER = "buffer",
}

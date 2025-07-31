/**
 * Security Utilities for XyPrissSecurity
 * Enhanced security functions for robust cryptographic operations
 */

import * as crypto from "crypto";

// Security constants
export const SECURITY_CONSTANTS = {
    MIN_PASSWORD_LENGTH: 12,
    MIN_KEY_SIZE: 2048,
    RECOMMENDED_KEY_SIZE: 3072,
    HIGH_SECURITY_KEY_SIZE: 4096,
    MAX_RETRY_ATTEMPTS: 3,
    SECURE_RANDOM_BYTES: 32,
    PBKDF2_ITERATIONS: 100000,
    ARGON2_MEMORY: 65536, // 64MB
    ARGON2_TIME: 3,
    ARGON2_PARALLELISM: 4,
} as const;

// Security levels
export type SecurityLevel = "minimal" | "standard" | "high" | "maximum";

export interface SecurityAssessment {
    level: SecurityLevel;
    score: number; // 0-100
    vulnerabilities: string[];
    recommendations: string[];
    compliance: {
        nist: boolean;
        fips: boolean;
        commonCriteria: boolean;
    };
}

/**
 * Generate cryptographically secure random bytes
 * @param size - Number of bytes to generate
 * @returns Buffer containing random bytes
 */
export function generateSecureRandom(
    size: number = SECURITY_CONSTANTS.SECURE_RANDOM_BYTES
): Buffer {
    if (size <= 0 || size > 1024) {
        throw new Error(
            "Invalid random size: must be between 1 and 1024 bytes"
        );
    }

    try {
        return crypto.randomBytes(size);
    } catch (error: any) {
        throw new Error(
            `Failed to generate secure random bytes: ${error.message}`
        );
    }
}

/**
 * Validate password strength
 * @param password - Password to validate
 * @returns Validation result with score and recommendations
 */
export function validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number; // 0-100
    issues: string[];
    recommendations: string[];
} {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 0;

    // Length check
    if (password.length < 8) {
        issues.push("Password is too short (minimum 8 characters)");
    } else if (password.length < SECURITY_CONSTANTS.MIN_PASSWORD_LENGTH) {
        issues.push(
            `Password should be at least ${SECURITY_CONSTANTS.MIN_PASSWORD_LENGTH} characters`
        );
        score += 10;
    } else {
        score += 25;
    }

    // Character variety checks
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
        password
    );

    if (hasLowercase) score += 15;
    else issues.push("Password should contain lowercase letters");

    if (hasUppercase) score += 15;
    else issues.push("Password should contain uppercase letters");

    if (hasNumbers) score += 15;
    else issues.push("Password should contain numbers");

    if (hasSpecialChars) score += 15;
    else issues.push("Password should contain special characters");

    // Common patterns check
    const commonPatterns = [
        /(.)\1{2,}/, // Repeated characters
        /123|abc|qwe/i, // Sequential patterns
        /password|admin|user/i, // Common words
    ];

    for (const pattern of commonPatterns) {
        if (pattern.test(password)) {
            score -= 20;
            issues.push("Password contains common patterns");
            break;
        }
    }

    // Length bonus
    if (password.length >= 16) score += 15;
    else if (password.length >= 12) score += 10;

    // Generate recommendations
    if (score < 60) {
        recommendations.push(
            "Use a longer password with mixed character types"
        );
    }
    if (!hasSpecialChars) {
        recommendations.push("Add special characters (!@#$%^&* etc.)");
    }
    if (password.length < 12) {
        recommendations.push("Use at least 12 characters for better security");
    }

    return {
        isValid: score >= 60 && issues.length === 0,
        score: Math.max(0, Math.min(100, score)),
        issues,
        recommendations,
    };
}

/**
 * Secure memory clearing utility
 * @param buffer - Buffer to clear
 */
export function secureMemoryClear(buffer: Buffer): void {
    if (buffer && buffer.length > 0) {
        // Overwrite with random data multiple times
        for (let i = 0; i < 3; i++) {
            const randomData = crypto.randomBytes(buffer.length);
            randomData.copy(buffer);
        }
        // Final zero fill
        buffer.fill(0);
    }
}

/**
 * Timing-safe string comparison
 * @param a - First string
 * @param b - Second string
 * @returns True if strings are equal
 */
export function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    const bufferA = Buffer.from(a, "utf8");
    const bufferB = Buffer.from(b, "utf8");

    try {
        return crypto.timingSafeEqual(bufferA, bufferB);
    } finally {
        secureMemoryClear(bufferA);
        secureMemoryClear(bufferB);
    }
}

/**
 * Generate secure salt for password hashing
 * @param size - Salt size in bytes (default: 32)
 * @returns Base64 encoded salt
 */
export function generateSalt(size: number = 32): string {
    return generateSecureRandom(size).toString("base64");
}

/**
 * Validate cryptographic key strength
 * @param keySize - Key size in bits
 * @param algorithm - Algorithm name
 * @returns Security assessment
 */
export function validateKeyStrength(
    keySize: number,
    algorithm: string
): SecurityAssessment {
    const vulnerabilities: string[] = [];
    const recommendations: string[] = [];
    let score = 100;
    let level: SecurityLevel = "maximum";

    // Algorithm-specific validation
    if (algorithm.toLowerCase().includes("rsa")) {
        if (keySize < 2048) {
            vulnerabilities.push("RSA key size below 2048 bits is vulnerable");
            score = 0;
            level = "minimal";
        } else if (keySize < 3072) {
            vulnerabilities.push(
                "RSA key size may be vulnerable to future attacks"
            );
            score -= 30;
            level = "standard";
            recommendations.push("Consider upgrading to 3072+ bits");
        } else if (keySize >= 4096) {
            level = "maximum";
            recommendations.push(
                "Excellent key size for high-security applications"
            );
        } else {
            level = "high";
        }
    } else if (algorithm.toLowerCase().includes("aes")) {
        if (keySize < 128) {
            vulnerabilities.push("AES key size below 128 bits is insufficient");
            score = 0;
            level = "minimal";
        } else if (keySize === 128) {
            level = "standard";
        } else if (keySize >= 256) {
            level = "maximum";
        } else {
            level = "high";
        }
    }

    // Compliance assessment
    const compliance = {
        nist: keySize >= (algorithm.includes("rsa") ? 2048 : 128),
        fips: keySize >= (algorithm.includes("rsa") ? 2048 : 128),
        commonCriteria: keySize >= (algorithm.includes("rsa") ? 3072 : 256),
    };

    return {
        level,
        score: Math.max(0, score),
        vulnerabilities,
        recommendations,
        compliance,
    };
}

/**
 * Rate limiting utility for security operations
 */
export class SecurityRateLimiter {
    private attempts: Map<string, { count: number; lastAttempt: number }> =
        new Map();
    private readonly maxAttempts: number;
    private readonly windowMs: number;

    constructor(maxAttempts: number = 5, windowMs: number = 300000) {
        // 5 minutes default
        this.maxAttempts = maxAttempts;
        this.windowMs = windowMs;
    }

    /**
     * Check if operation is allowed for the given identifier
     * @param identifier - Unique identifier (e.g., IP address, user ID)
     * @returns True if operation is allowed
     */
    isAllowed(identifier: string): boolean {
        const now = Date.now();
        const record = this.attempts.get(identifier);

        if (!record) {
            this.attempts.set(identifier, { count: 1, lastAttempt: now });
            return true;
        }

        // Reset if window has passed
        if (now - record.lastAttempt > this.windowMs) {
            this.attempts.set(identifier, { count: 1, lastAttempt: now });
            return true;
        }

        // Check if limit exceeded
        if (record.count >= this.maxAttempts) {
            return false;
        }

        // Increment counter
        record.count++;
        record.lastAttempt = now;
        return true;
    }

    /**
     * Reset attempts for an identifier
     * @param identifier - Identifier to reset
     */
    reset(identifier: string): void {
        this.attempts.delete(identifier);
    }

    /**
     * Clean up old entries
     */
    cleanup(): void {
        const now = Date.now();
        for (const [key, record] of this.attempts.entries()) {
            if (now - record.lastAttempt > this.windowMs) {
                this.attempts.delete(key);
            }
        }
    }
}

/**
 * Secure configuration validator
 * @param config - Configuration object to validate
 * @returns Validation result with security recommendations
 */
export function validateSecureConfiguration(config: any): {
    isSecure: boolean;
    issues: string[];
    recommendations: string[];
    score: number;
} {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check for insecure defaults
    if (config.debug === true) {
        issues.push("Debug mode is enabled in production");
        score -= 20;
        recommendations.push("Disable debug mode in production");
    }

    if (config.ssl === false || config.https === false) {
        issues.push("SSL/HTTPS is disabled");
        score -= 30;
        recommendations.push("Enable SSL/HTTPS for secure communication");
    }

    if (config.keySize && config.keySize < SECURITY_CONSTANTS.MIN_KEY_SIZE) {
        issues.push(
            `Key size ${config.keySize} is below minimum secure threshold`
        );
        score -= 40;
        recommendations.push(
            `Use at least ${SECURITY_CONSTANTS.MIN_KEY_SIZE}-bit keys`
        );
    }

    // Check for weak algorithms
    const weakAlgorithms = ["md5", "sha1", "des", "rc4"];
    for (const [key, value] of Object.entries(config)) {
        if (
            typeof value === "string" &&
            weakAlgorithms.some((weak) => value.toLowerCase().includes(weak))
        ) {
            issues.push(`Weak algorithm detected in ${key}: ${value}`);
            score -= 25;
            recommendations.push(`Replace ${value} with a stronger algorithm`);
        }
    }

    return {
        isSecure: score >= 80 && issues.length === 0,
        issues,
        recommendations,
        score: Math.max(0, score),
    };
}


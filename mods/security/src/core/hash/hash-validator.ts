/**
 * Hash validator - Input validation and security checks
 */

import { EnhancedHashOptions } from "../../types";

export class HashValidator {
    /**
     * Validate hash input for security
     * @param input - Input to validate
     * @param options - Validation options
     */
    public static validateHashInput(
        input: string | Uint8Array,
        options: EnhancedHashOptions
    ): void {
        // Check input length (allow empty strings for edge cases)
        if (typeof input === "string" && input.length === 0) {
            console.warn("Warning: Hashing empty string");
        }

        if (input instanceof Uint8Array && input.length === 0) {
            console.warn("Warning: Hashing empty array");
        }

        // Check for suspicious patterns
        if (typeof input === "string") {
            // Check for null bytes
            if (input.includes("\0")) {
                throw new Error("Input contains null bytes");
            }

            // Check for extremely long inputs (potential DoS)
            if (input.length > 1000000) {
                // 1MB limit
                throw new Error("Input too large (max 1MB)");
            }

            // Check for common weak patterns
            if (HashValidator.hasWeakPatterns(input)) {
                console.warn(
                    "Input contains weak patterns that may reduce security"
                );
            }
        }

        // Validate Uint8Array input
        if (input instanceof Uint8Array) {
            if (input.length > 10000000) {
                // 10MB limit for binary data
                throw new Error("Binary input too large (max 10MB)");
            }
        }

        // Validate options
        HashValidator.validateOptions(options);
    }

    /**
     * Check for weak patterns in input
     * @param input - String input to check
     * @returns True if weak patterns found
     */
    private static hasWeakPatterns(input: string): boolean {
        // Check for repeated characters
        if (/(.)\1{10,}/.test(input)) {
            return true;
        }

        // Check for simple sequences
        if (/012345|123456|abcdef|qwerty/i.test(input)) {
            return true;
        }

        // Check for common weak passwords
        const weakPatterns = [
            /^password/i,
            /^123456/,
            /^admin/i,
            /^test/i,
            /^guest/i,
        ];

        return weakPatterns.some((pattern) => pattern.test(input));
    }

    /**
     * Validate hash options
     * @param options - Options to validate
     */
    private static validateOptions(options: EnhancedHashOptions): void {
        // Validate iterations
        if (options.iterations !== undefined) {
            if (options.iterations < 1) {
                throw new Error("Iterations must be at least 1");
            }
            if (options.iterations > 10000000) {
                throw new Error("Iterations too high (max 10,000,000)");
            }
        }

        // Validate algorithm
        if (options.algorithm) {
            const validAlgorithms = [
                "sha256",
                "sha512",
                "sha3-256",
                "sha3-512",
                "blake3",
                "blake2b",
                "blake2s",
                "pbkdf2",
            ];
            if (!validAlgorithms.includes(options.algorithm)) {
                throw new Error(`Unsupported algorithm: ${options.algorithm}`);
            }
        }

        // Validate output format
        if (options.outputFormat) {
            const validFormats = [
                "hex",
                "base64",
                "base58",
                "binary",
                "base64url",
                "buffer",
            ];
            if (!validFormats.includes(options.outputFormat)) {
                throw new Error(
                    `Unsupported output format: ${options.outputFormat}`
                );
            }
        }

        // Validate salt
        if (options.salt) {
            if (typeof options.salt === "string" && options.salt.length === 0) {
                throw new Error("Salt cannot be empty string");
            }
            if (
                options.salt instanceof Uint8Array &&
                options.salt.length === 0
            ) {
                throw new Error("Salt cannot be empty array");
            }
        }

        // Validate pepper
        if (options.pepper) {
            if (
                typeof options.pepper === "string" &&
                options.pepper.length === 0
            ) {
                throw new Error("Pepper cannot be empty string");
            }
            if (
                options.pepper instanceof Uint8Array &&
                options.pepper.length === 0
            ) {
                throw new Error("Pepper cannot be empty array");
            }
        }
    }

    /**
     * Validate password strength
     * @param password - Password to validate
     * @returns Validation result
     */
    public static validatePasswordStrength(password: string): {
        isSecure: boolean;
        score: number;
        issues: string[];
        recommendations: string[];
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];
        let score = 0;

        // Length check
        if (password.length < 8) {
            issues.push("Password too short (minimum 8 characters)");
        } else if (password.length < 12) {
            issues.push("Password should be at least 12 characters");
            score += 10;
        } else {
            score += 25;
        }

        // Character variety
        const hasLower = /[a-z]/.test(password);
        const hasUpper = /[A-Z]/.test(password);
        const hasDigit = /\d/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
            password
        );

        if (hasLower) score += 15;
        else issues.push("Missing lowercase letters");
        if (hasUpper) score += 15;
        else issues.push("Missing uppercase letters");
        if (hasDigit) score += 15;
        else issues.push("Missing numbers");
        if (hasSpecial) score += 15;
        else issues.push("Missing special characters");

        // Common patterns
        if (/(.)\1{2,}/.test(password)) {
            issues.push("Contains repeated characters");
            score -= 10;
        }

        // Only flag sequential patterns if they're significant (4+ chars)
        if (/1234|abcd|qwer/i.test(password)) {
            issues.push("Contains sequential patterns");
            score -= 15;
        }

        // Dictionary words (basic check)
        const commonWords = [
            "password",
            "admin",
            "user",
            "test",
            "guest",
            "login",
        ];
        if (commonWords.some((word) => password.toLowerCase().includes(word))) {
            issues.push("Contains common dictionary words");
            score -= 20;
        }

        // Generate recommendations
        if (score < 60) {
            recommendations.push(
                "Use a longer password with mixed character types"
            );
        }
        if (!hasSpecial) {
            recommendations.push("Add special characters");
        }
        if (password.length < 12) {
            recommendations.push("Use at least 12 characters");
        }
        if (
            issues.some(
                (issue) =>
                    issue.includes("repeated") || issue.includes("sequential")
            )
        ) {
            recommendations.push(
                "Avoid repeated characters and sequential patterns"
            );
        }

        return {
            isSecure:
                score >= 70 &&
                issues.filter((issue) => !issue.includes("should be"))
                    .length === 0,
            score: Math.max(0, Math.min(100, score)),
            issues,
            recommendations,
        };
    }

    /**
     * Enhanced timing-safe string comparison
     * @param a - First string/buffer
     * @param b - Second string/buffer
     * @returns True if equal
     */
    public static timingSafeEqual(
        a: string | Buffer | Uint8Array,
        b: string | Buffer | Uint8Array
    ): boolean {
        // Convert inputs to buffers
        const bufferA = Buffer.isBuffer(a)
            ? a
            : a instanceof Uint8Array
            ? Buffer.from(a)
            : Buffer.from(a, "utf8");
        const bufferB = Buffer.isBuffer(b)
            ? b
            : b instanceof Uint8Array
            ? Buffer.from(b)
            : Buffer.from(b, "utf8");

        // Use Node.js timing-safe comparison if lengths match
        if (bufferA.length === bufferB.length) {
            try {
                return require("crypto").timingSafeEqual(bufferA, bufferB);
            } catch (error) {
                // Fallback to manual timing-safe comparison
                return HashValidator.manualTimingSafeEqual(bufferA, bufferB);
            }
        }

        // For different lengths, still do timing-safe comparison
        return HashValidator.manualTimingSafeEqual(bufferA, bufferB);
    }

    /**
     * Manual timing-safe comparison implementation
     */
    private static manualTimingSafeEqual(a: Buffer, b: Buffer): boolean {
        let result = 0;
        const maxLength = Math.max(a.length, b.length);

        // Always compare the same number of bytes
        for (let i = 0; i < maxLength; i++) {
            const byteA = i < a.length ? a[i] : 0;
            const byteB = i < b.length ? b[i] : 0;
            result |= byteA ^ byteB;
        }

        // Also compare lengths in a timing-safe way
        result |= a.length ^ b.length;

        return result === 0;
    }

    /**
     * Validate salt quality
     * @param salt - Salt to validate
     * @returns Validation result
     */
    public static validateSalt(salt: string | Buffer | Uint8Array): {
        isValid: boolean;
        issues: string[];
        recommendations: string[];
    } {
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Convert to buffer for analysis
        const saltBuffer = Buffer.isBuffer(salt)
            ? salt
            : salt instanceof Uint8Array
            ? Buffer.from(salt)
            : Buffer.from(salt, "base64");

        // Check length
        if (saltBuffer.length < 16) {
            issues.push("Salt too short (minimum 16 bytes recommended)");
            recommendations.push("Use at least 16 bytes for salt");
        }

        if (saltBuffer.length < 32) {
            recommendations.push(
                "Consider using 32+ bytes for stronger security"
            );
        }

        // Check for patterns (basic entropy check)
        const uniqueBytes = new Set(saltBuffer);
        const entropyRatio = uniqueBytes.size / saltBuffer.length;

        if (entropyRatio < 0.5) {
            issues.push("Salt has low entropy (too many repeated bytes)");
            recommendations.push(
                "Use cryptographically secure random salt generation"
            );
        }

        // Check for all zeros or all same value
        if (uniqueBytes.size === 1) {
            issues.push("Salt contains only one unique value");
            recommendations.push(
                "Generate random salt using secure random number generator"
            );
        }

        return {
            isValid: issues.length === 0,
            issues,
            recommendations,
        };
    }
}


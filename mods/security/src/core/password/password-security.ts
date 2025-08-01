/**
 * 🔐 Password Security Analysis Module
 *
 * Production-ready password strength analysis and security validation
 */

import { commonPassword, keyboardPatterns } from "../../utils/patterns";
import {
    PasswordStrengthAnalysis,
    PasswordPolicy,
    PasswordValidationResult,
    PasswordAuditResult,
    PasswordManagerConfig,
    PasswordAlgorithm,
    PasswordSecurityLevel,
} from "./password-types";

/**
 * Password security analysis and validation
 */
export class PasswordSecurity {
    private config: PasswordManagerConfig;
    private commonPasswords: Set<string>;
    private keyboardPatterns: RegExp[];

    constructor(config: PasswordManagerConfig) {
        this.config = config;
        this.commonPasswords = this.getCommonPasswords();
        this.keyboardPatterns = this.getKeyboardPatterns();
    }

    /**
     * Update configuration
     */
    public updateConfig(config: PasswordManagerConfig): void {
        this.config = config;
    }

    /**
     * Analyze password strength with detailed metrics
     */
    public analyzeStrength(password: string): PasswordStrengthAnalysis {
        if (!password) {
            return this.createEmptyAnalysis();
        }

        const details = this.analyzePasswordDetails(password);
        const entropy = this.calculateEntropy(password, details);
        const score = this.calculateStrengthScore(password, details, entropy);
        const vulnerabilities = this.findVulnerabilities(password, details);
        const feedback = this.generateFeedback(details, vulnerabilities);
        const estimatedCrackTime = this.estimateCrackTime(score, entropy);

        return {
            score: Math.round(score),
            feedback,
            entropy: Math.round(entropy * 100) / 100,
            estimatedCrackTime,
            vulnerabilities,
            details,
        };
    }

    /**
     * Validate password against policy
     */
    public validatePolicy(password: string): PasswordValidationResult {
        if (!this.config.policy) {
            return {
                isValid: true,
                violations: [],
                score: this.analyzeStrength(password).score,
                suggestions: [],
            };
        }

        const policy = this.config.policy;
        const violations: string[] = [];
        const suggestions: string[] = [];

        // Length validation
        if (password.length < policy.minLength) {
            violations.push(
                `Password must be at least ${policy.minLength} characters long`
            );
            suggestions.push(
                `Add ${policy.minLength - password.length} more characters`
            );
        }

        if (policy.maxLength && password.length > policy.maxLength) {
            violations.push(
                `Password must be no more than ${policy.maxLength} characters long`
            );
        }

        // Character requirements
        if (policy.requireUppercase && !/[A-Z]/.test(password)) {
            violations.push("Password must contain uppercase letters");
            suggestions.push("Add uppercase letters (A-Z)");
        }

        if (policy.requireLowercase && !/[a-z]/.test(password)) {
            violations.push("Password must contain lowercase letters");
            suggestions.push("Add lowercase letters (a-z)");
        }

        if (policy.requireNumbers && !/[0-9]/.test(password)) {
            violations.push("Password must contain numbers");
            suggestions.push("Add numbers (0-9)");
        }

        if (policy.requireSymbols && !/[^A-Za-z0-9]/.test(password)) {
            violations.push("Password must contain special characters");
            suggestions.push("Add special characters (!@#$%^&*)");
        }

        // Strength requirement
        const strength = this.analyzeStrength(password);
        if (
            policy.minStrengthScore &&
            strength.score < policy.minStrengthScore
        ) {
            violations.push(
                `Password strength score (${strength.score}) is below required minimum (${policy.minStrengthScore})`
            );
            suggestions.push(...strength.feedback);
        }

        // Forbidden patterns
        if (policy.forbiddenPatterns) {
            for (const pattern of policy.forbiddenPatterns) {
                if (pattern.test(password)) {
                    violations.push("Password contains forbidden patterns");
                    suggestions.push("Avoid common patterns and sequences");
                    break;
                }
            }
        }

        // Forbidden words
        if (policy.forbiddenWords) {
            const lowerPassword = password.toLowerCase();
            for (const word of policy.forbiddenWords) {
                if (lowerPassword.includes(word.toLowerCase())) {
                    violations.push("Password contains forbidden words");
                    suggestions.push(
                        "Avoid common words and personal information"
                    );
                    break;
                }
            }
        }

        return {
            isValid: violations.length === 0,
            violations,
            score: strength.score,
            suggestions: [...new Set(suggestions)],
        };
    }

    /**
     * Audit multiple passwords for security issues
     */
    public async auditPasswords(
        hashes: string[]
    ): Promise<PasswordAuditResult> {
        const algorithmDistribution: Record<PasswordAlgorithm, number> = {
            [PasswordAlgorithm.ARGON2ID]: 0,
            [PasswordAlgorithm.ARGON2I]: 0,
            [PasswordAlgorithm.ARGON2D]: 0,
            [PasswordAlgorithm.SCRYPT]: 0,
            [PasswordAlgorithm.PBKDF2_SHA512]: 0,
            [PasswordAlgorithm.BCRYPT_PLUS]: 0,
            [PasswordAlgorithm.MILITARY]: 0,
        };

        const securityLevelDistribution: Record<PasswordSecurityLevel, number> =
            {
                [PasswordSecurityLevel.STANDARD]: 0,
                [PasswordSecurityLevel.HIGH]: 0,
                [PasswordSecurityLevel.MAXIMUM]: 0,
                [PasswordSecurityLevel.MILITARY]: 0,
                [PasswordSecurityLevel.QUANTUM_RESISTANT]: 0,
            };

        let weakPasswords = 0;
        let outdatedHashes = 0;
        let needsRehash = 0;
        let oldestHash = Date.now();
        let totalStrength = 0;

        for (const hash of hashes) {
            try {
                const hashInfo = this.parseHashMetadata(hash);

                // Update algorithm distribution
                if (hashInfo.algorithm in algorithmDistribution) {
                    algorithmDistribution[hashInfo.algorithm]++;
                }

                // Update security level distribution
                if (hashInfo.securityLevel in securityLevelDistribution) {
                    securityLevelDistribution[hashInfo.securityLevel]++;
                }

                // Check if hash is outdated
                if (this.isOutdatedAlgorithm(hashInfo.algorithm)) {
                    outdatedHashes++;
                    needsRehash++;
                }

                // Check if hash is weak based on iterations/parameters
                if (this.isWeakHash(hashInfo)) {
                    weakPasswords++;
                    needsRehash++;
                }

                // Track oldest hash
                if (hashInfo.timestamp && hashInfo.timestamp < oldestHash) {
                    oldestHash = hashInfo.timestamp;
                }

                // Add to total strength calculation
                totalStrength += this.getSecurityLevelScore(
                    hashInfo.securityLevel
                );
            } catch (error) {
                // Log parsing errors for debugging
                if (process.env.NODE_ENV === "development") {
                    console.warn(
                        `[PasswordSecurity] Failed to parse hash: ${
                            (error as Error).message
                        }`
                    );
                }
                outdatedHashes++;
            }
        }

        const securityScore = Math.max(
            0,
            100 - weakPasswords * 10 - outdatedHashes * 5
        );
        const averageStrength =
            hashes.length > 0 ? totalStrength / hashes.length : 0;

        const recommendations: string[] = [];
        if (weakPasswords > 0) {
            recommendations.push(
                `${weakPasswords} weak passwords should be strengthened`
            );
        }
        if (outdatedHashes > 0) {
            recommendations.push(
                `${outdatedHashes} passwords use outdated hashing algorithms`
            );
        }
        if (needsRehash > 0) {
            recommendations.push(
                `${needsRehash} passwords should be rehashed with stronger algorithms`
            );
        }

        return {
            totalPasswords: hashes.length,
            weakPasswords,
            outdatedHashes,
            needsRehash,
            securityScore,
            recommendations,
            details: {
                algorithmDistribution,
                securityLevelDistribution,
                averageStrength,
                oldestHash,
            },
        };
    }

    // ===== PRIVATE HELPER METHODS =====

    private getCommonPasswords(): Set<string> {
        return new Set(commonPassword);
    }

    private getKeyboardPatterns(): RegExp[] {
        return keyboardPatterns;
    }

    private createEmptyAnalysis(): PasswordStrengthAnalysis {
        return {
            score: 0,
            feedback: ["Password is empty"],
            entropy: 0,
            estimatedCrackTime: "Instant",
            vulnerabilities: ["Empty password"],
            details: {
                length: 0,
                hasUppercase: false,
                hasLowercase: false,
                hasNumbers: false,
                hasSymbols: false,
                hasRepeated: false,
                hasSequential: false,
                hasCommonPatterns: false,
            },
        };
    }

    private analyzePasswordDetails(password: string) {
        return {
            length: password.length,
            hasUppercase: /[A-Z]/.test(password),
            hasLowercase: /[a-z]/.test(password),
            hasNumbers: /[0-9]/.test(password),
            hasSymbols: /[^A-Za-z0-9]/.test(password),
            hasRepeated: /(.)\1{2,}/.test(password),
            hasSequential: this.hasSequentialChars(password),
            hasCommonPatterns: this.hasCommonPatterns(password),
        };
    }

    private calculateEntropy(password: string, details: any): number {
        let charsetSize = 0;
        if (details.hasUppercase) charsetSize += 26;
        if (details.hasLowercase) charsetSize += 26;
        if (details.hasNumbers) charsetSize += 10;
        if (details.hasSymbols) charsetSize += 33;

        if (charsetSize === 0) return 0;
        return Math.log2(Math.pow(charsetSize, details.length));
    }

    private calculateStrengthScore(
        password: string,
        details: any,
        entropy: number
    ): number {
        let score = 0;

        // Length scoring (0-40 points)
        score += Math.min(40, details.length * 2.5);

        // Character variety (0-25 points)
        if (details.hasUppercase) score += 6.25;
        if (details.hasLowercase) score += 6.25;
        if (details.hasNumbers) score += 6.25;
        if (details.hasSymbols) score += 6.25;

        // Entropy bonus (0-25 points)
        score += Math.min(25, entropy / 4);

        // Penalties
        if (details.hasRepeated) score -= 10;
        if (details.hasSequential) score -= 15;
        if (details.hasCommonPatterns) score -= 20;
        if (details.length < 8) score -= 20;
        if (this.commonPasswords.has(password.toLowerCase())) score -= 50;

        return Math.max(0, Math.min(100, score));
    }

    private findVulnerabilities(password: string, details: any): string[] {
        const vulnerabilities: string[] = [];

        if (details.length < 8) vulnerabilities.push("Password too short");
        if (details.hasRepeated)
            vulnerabilities.push("Contains repeated characters");
        if (details.hasSequential)
            vulnerabilities.push("Contains sequential patterns");
        if (details.hasCommonPatterns)
            vulnerabilities.push("Contains common patterns");
        if (this.commonPasswords.has(password.toLowerCase())) {
            vulnerabilities.push("Password is commonly used");
        }

        return vulnerabilities;
    }

    private generateFeedback(
        details: any,
        vulnerabilities: string[]
    ): string[] {
        const feedback: string[] = [];

        if (details.length < 12)
            feedback.push("Consider using a longer password");
        if (!details.hasUppercase) feedback.push("Add uppercase letters");
        if (!details.hasLowercase) feedback.push("Add lowercase letters");
        if (!details.hasNumbers) feedback.push("Add numbers");
        if (!details.hasSymbols) feedback.push("Add special characters");

        if (vulnerabilities.length > 0) {
            feedback.push("Address security vulnerabilities");
        }

        return feedback.length > 0 ? feedback : ["Password is strong"];
    }

    private estimateCrackTime(score: number, entropy: number): string {
        // More accurate calculation based on entropy and modern hardware capabilities
        if (entropy >= 80) return "Centuries";
        if (entropy >= 60) return "Decades";
        if (entropy >= 50) return "Years";
        if (entropy >= 40) return "Months";
        if (entropy >= 30) return "Weeks";
        if (entropy >= 25) return "Days";
        if (entropy >= 20) return "Hours";
        if (entropy >= 15) return "Minutes";
        if (entropy >= 10) return "Seconds";
        return "Instant";
    }

    private hasSequentialChars(password: string): boolean {
        for (let i = 0; i < password.length - 2; i++) {
            const char1 = password.charCodeAt(i);
            const char2 = password.charCodeAt(i + 1);
            const char3 = password.charCodeAt(i + 2);

            if (char2 === char1 + 1 && char3 === char2 + 1) {
                return true;
            }
        }
        return false;
    }

    private hasCommonPatterns(password: string): boolean {
        return this.keyboardPatterns.some((pattern) => pattern.test(password));
    }

    private parseHashMetadata(hash: string): {
        algorithm: PasswordAlgorithm;
        securityLevel: PasswordSecurityLevel;
        iterations?: number;
        timestamp?: number;
        version?: string;
    } {
        // Parse XyPrissSecurity format (if available)
        if (hash.startsWith("$xypriss$")) {
            return this.parseXyPrissHash(hash);
        }

        // Parse bcrypt format
        if (
            hash.startsWith("$2a$") ||
            hash.startsWith("$2b$") ||
            hash.startsWith("$2y$")
        ) {
            return this.parseBcryptHash(hash);
        }

        // Parse Argon2 format
        if (hash.startsWith("$argon2")) {
            return this.parseArgon2Hash(hash);
        }

        // Parse scrypt format
        if (
            hash.includes("scrypt") ||
            hash.startsWith("$s0$") ||
            hash.startsWith("$s1$")
        ) {
            return this.parseScryptHash(hash);
        }

        // Parse PBKDF2 format
        if (hash.includes("pbkdf2") || hash.includes("$pbkdf2")) {
            return this.parsePBKDF2Hash(hash);
        }

        // Fallback for unknown formats
        return this.parseGenericHash(hash);
    }

    private parseXyPrissHash(hash: string): any {
        try {
            // Parse XyPrissSecurity specific format
            const parts = hash.split("$");
            if (parts.length < 4)
                throw new Error("Invalid XyPrissSecurity hash format");

            const version = parts[2];
            const metadata = JSON.parse(
                Buffer.from(parts[3], "base64").toString()
            );

            return {
                algorithm: metadata.algorithm || PasswordAlgorithm.ARGON2ID,
                securityLevel:
                    metadata.securityLevel || PasswordSecurityLevel.HIGH,
                iterations: metadata.iterations,
                timestamp: metadata.timestamp || Date.now(),
                version,
            };
        } catch (error) {
            return this.parseGenericHash(hash);
        }
    }

    private parseBcryptHash(hash: string): any {
        const rounds = parseInt(hash.split("$")[2] || "10");
        return {
            algorithm: PasswordAlgorithm.BCRYPT_PLUS,
            securityLevel:
                rounds >= 12
                    ? PasswordSecurityLevel.HIGH
                    : PasswordSecurityLevel.STANDARD,
            iterations: Math.pow(2, rounds),
            timestamp: Date.now() - 365 * 24 * 60 * 60 * 1000, // Estimate 1 year old
        };
    }

    private parseArgon2Hash(hash: string): any {
        const parts = hash.split("$");
        const variant = parts[1];
        const params = parts[3]?.split(",") || [];
        const iterations = parseInt(
            params.find((p) => p.startsWith("t="))?.substring(2) || "3"
        );
        const memory = parseInt(
            params.find((p) => p.startsWith("m="))?.substring(2) || "65536"
        );

        let algorithm = PasswordAlgorithm.ARGON2ID;
        if (variant === "argon2i") algorithm = PasswordAlgorithm.ARGON2I;
        if (variant === "argon2d") algorithm = PasswordAlgorithm.ARGON2D;

        return {
            algorithm,
            securityLevel:
                memory >= 65536
                    ? PasswordSecurityLevel.HIGH
                    : PasswordSecurityLevel.STANDARD,
            iterations,
            timestamp: Date.now() - 180 * 24 * 60 * 60 * 1000, // Estimate 6 months old
        };
    }

    private parseScryptHash(hash: string): any {
        return {
            algorithm: PasswordAlgorithm.SCRYPT,
            securityLevel: PasswordSecurityLevel.HIGH,
            iterations: 32768,
            timestamp: Date.now() - 90 * 24 * 60 * 60 * 1000, // Estimate 3 months old
        };
    }

    private parsePBKDF2Hash(hash: string): any {
        const iterations = this.extractIterationsFromPBKDF2(hash);
        return {
            algorithm: PasswordAlgorithm.PBKDF2_SHA512,
            securityLevel:
                iterations >= 100000
                    ? PasswordSecurityLevel.STANDARD
                    : PasswordSecurityLevel.STANDARD,
            iterations,
            timestamp: Date.now() - 730 * 24 * 60 * 60 * 1000, // Estimate 2 years old
        };
    }

    private parseGenericHash(hash: string): any {
        // Infer from hash characteristics
        if (hash.length >= 128) {
            return {
                algorithm: PasswordAlgorithm.MILITARY,
                securityLevel: PasswordSecurityLevel.MILITARY,
                timestamp: Date.now(),
            };
        } else if (hash.length >= 64) {
            return {
                algorithm: PasswordAlgorithm.ARGON2ID,
                securityLevel: PasswordSecurityLevel.HIGH,
                timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
            };
        } else {
            return {
                algorithm: PasswordAlgorithm.PBKDF2_SHA512,
                securityLevel: PasswordSecurityLevel.STANDARD,
                iterations: 10000,
                timestamp: Date.now() - 365 * 24 * 60 * 60 * 1000,
            };
        }
    }

    private extractIterationsFromPBKDF2(hash: string): number {
        const iterationMatch = hash.match(/\$(\d+)\$/);
        if (iterationMatch) {
            return parseInt(iterationMatch[1]);
        }

        const iterMatch = hash.match(/iter[=:](\d+)/i);
        if (iterMatch) {
            return parseInt(iterMatch[1]);
        }

        return 10000; // Default PBKDF2 iterations
    }

    private isOutdatedAlgorithm(algorithm: PasswordAlgorithm): boolean {
        const outdatedAlgorithms = [
            PasswordAlgorithm.PBKDF2_SHA512, // If iterations are too low
        ];
        return outdatedAlgorithms.includes(algorithm);
    }

    private isWeakHash(hashInfo: {
        algorithm: PasswordAlgorithm;
        securityLevel: PasswordSecurityLevel;
        iterations?: number;
        timestamp?: number;
    }): boolean {
        switch (hashInfo.algorithm) {
            case PasswordAlgorithm.PBKDF2_SHA512:
                return (hashInfo.iterations || 0) < 100000;
            case PasswordAlgorithm.BCRYPT_PLUS:
                return (hashInfo.iterations || 0) < 4096; // 2^12 rounds
            case PasswordAlgorithm.SCRYPT:
                return (hashInfo.iterations || 0) < 16384;
            case PasswordAlgorithm.ARGON2ID:
            case PasswordAlgorithm.ARGON2I:
            case PasswordAlgorithm.ARGON2D:
                return (
                    hashInfo.securityLevel === PasswordSecurityLevel.STANDARD
                );
            default:
                return false;
        }
    }

    private getSecurityLevelScore(level: PasswordSecurityLevel): number {
        switch (level) {
            case PasswordSecurityLevel.QUANTUM_RESISTANT:
                return 100;
            case PasswordSecurityLevel.MILITARY:
                return 90;
            case PasswordSecurityLevel.MAXIMUM:
                return 80;
            case PasswordSecurityLevel.HIGH:
                return 70;
            case PasswordSecurityLevel.STANDARD:
                return 50;
            default:
                return 30;
        }
    }
}


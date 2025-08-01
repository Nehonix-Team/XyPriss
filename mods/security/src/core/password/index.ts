/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) NEHONIX INC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 * -------------------------------------------------------------------------------------------
 */

/**
 * XyPrissSecurity Password Management Module => FPMM
 *
 * Modular, military-grade password management system
 *
 * @example
 * ```typescript
 * import { PasswordManager } from "xypriss-security/core/password";
 *
 * // Create password manager instance
 * const pm = PasswordManager.getInstance();
 *
 * // Hash a password
 * const hash = await pm.hash("mySecurePassword123!");
 *
 * // Verify a password
 * const result = await pm.verify("mySecurePassword123!", hash);
 * console.log(result.isValid); // true
 *
 * // Generate secure password
 * const generated = pm.generatePassword({ length: 16, minStrengthScore: 90 });
 * console.log(generated.password);
 *
 * // Migrate from bcrypt
 * const migration = await pm.migrate("password", bcryptHash);
 * if (migration.migrated) {
 *     console.log("Successfully migrated to XyPrissSecurity!");
 * }
 * ```
 */

import { PasswordManager } from "./password-core";
import { PasswordGenerator } from "./password-generator";
import {
    PasswordGenerationOptions,
    PasswordGenerationResult,
    PasswordHashOptions,
    PasswordManagerConfig,
    PasswordMigrationResult,
    PasswordPolicy,
} from "./password-types";

// ===== MAIN EXPORTS =====

export { PasswordManager } from "./password-core";
export const pm = PasswordManager.getInstance();

// ===== TYPE EXPORTS =====

export type {
    PasswordHashOptions,
    PasswordVerificationResult,
    PasswordStrengthAnalysis,
    PasswordGenerationOptions,
    PasswordGenerationResult,
    PasswordMigrationResult,
    PasswordPolicy,
    PasswordValidationResult,
    PasswordAuditResult,
    PasswordManagerConfig,
    PasswordHashMetadata,
    PasswordStorageOptions,
} from "./password-types";

export { PasswordAlgorithm, PasswordSecurityLevel } from "./password-types";

// ===== MODULAR COMPONENT EXPORTS =====

export { PasswordAlgorithms } from "./password-algorithms";
export { PasswordSecurity } from "./password-security";
export { PasswordMigration } from "./password-migration";
export { PasswordGenerator } from "./password-generator";
export { PasswordUtils } from "./password-utils";

// ===== CONVENIENCE FUNCTIONS =====

/**
 * Quick hash function for simple use cases
 */
export async function hashPassword(
    password: string,
    options?: PasswordHashOptions
): Promise<string> {
    return pm.hash(password, options);
}

/**
 * Quick verify function for simple use cases
 */
export async function verifyPassword(
    password: string,
    hash: string
): Promise<boolean> {
    const result = await pm.verify(password, hash);
    return result.isValid;
}

/**
 * Quick password generation for simple use cases
 */
export function generateSecurePassword(options?: any): any {
    const pm = PasswordManager.getInstance();
    return pm.generatePassword(options);
}

/**
 * Quick password strength analysis
 */
export function analyzePasswordStrength(password: string): any {
    return pm.analyzeStrength(password);
}

/**
 * Quick bcrypt migration
 */
export async function migrateBcryptPassword(
    password: string,
    bcryptHash: string,
    options?: any
): Promise<any> {
    return pm.migrate(password, bcryptHash, options);
}

// ===== UTILITY FUNCTIONS =====

/**
 * Create a configured password manager instance
 */
export function createPasswordManager(
    config?: Partial<PasswordManagerConfig>
): PasswordManager {
    return PasswordManager.create(config);
}

/**
 * Get default password policy
 */
export function getDefaultPasswordPolicy(): PasswordPolicy {
    return {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSymbols: true,
        minStrengthScore: 70,
        forbiddenPatterns: [
            /^[0-9]+$/, // All numbers
            /^[a-zA-Z]+$/, // All letters
            /^(.)\1{2,}$/, // Repeated characters
            /^(qwerty|asdfgh|zxcvbn)/i, // Keyboard patterns
            /^(password|admin|user)/i, // Common words
        ],
        forbiddenWords: [
            "password",
            "admin",
            "user",
            "login",
            "welcome",
            "123456",
            "qwerty",
            "abc123",
            "password123",
        ],
    };
}

/**
 * Get recommended security configuration
 */
export function getRecommendedConfig(): any {
    return {
        defaultAlgorithm: "argon2id" as any,
        defaultSecurityLevel: "high" as any,
        timingSafeVerification: true,
        secureMemoryWipe: true,
        enableMigration: true,
        policy: getDefaultPasswordPolicy(),
    };
}

/**
 * Get military-grade security configuration
 */
export function getMilitaryConfig(): any {
    return {
        defaultAlgorithm: "military" as any,
        defaultSecurityLevel: "military" as any,
        timingSafeVerification: true,
        secureMemoryWipe: true,
        enableMigration: true,
        policy: {
            ...getDefaultPasswordPolicy(),
            minLength: 12,
            minStrengthScore: 90,
            requireSymbols: true,
        },
    };
}

// ===== BCRYPT COMPATIBILITY LAYER =====

/**
 * bcrypt-compatible hash function
 * Drop-in replacement for bcrypt.hash()
 */
export async function hash(
    password: string,
    saltRounds: number = 12
): Promise<string> {
    return pm.hash(password, {
        algorithm: "bcrypt-plus" as any,
        iterations: saltRounds * 10000, // Convert rounds to iterations
        securityLevel: "high" as any,
    });
}

/**
 * bcrypt-compatible compare function
 * Drop-in replacement for bcrypt.compare()
 */
export async function compare(
    password: string,
    hash: string
): Promise<boolean> {
    // Handle both XyPrissSecurity hashes and legacy bcrypt hashes
    if (hash.startsWith("$xypriss$")) {
        return verifyPassword(password, hash);
    }

    // For legacy bcrypt hashes, try to use bcrypt library
    try {
        const bcrypt = await import("bcrypt").catch(() => null);
        if (bcrypt) {
            return await bcrypt.compare(password, hash);
        }
    } catch (error) {
        // Fall back to XyPrissSecurity verification
    }

    return verifyPassword(password, hash);
}

/**
 * Generate salt (bcrypt compatibility)
 */
export function genSalt(rounds: number = 12): string {
    // Return a XyPrissSecurity salt identifier
    return `$xypriss$rounds=${rounds}$`;
}

// ===== ADVANCED FEATURES =====

/**
 * Batch password operations
 */
export class PasswordBatch {
    private pm: PasswordManager;

    constructor(config?: Partial<PasswordManagerConfig>) {
        this.pm = config
            ? PasswordManager.create(config)
            : PasswordManager.getInstance();
    }

    /**
     * Hash multiple passwords
     */
    async hashMany(
        passwords: string[],
        options?: PasswordHashOptions
    ): Promise<string[]> {
        const results: string[] = [];
        for (const password of passwords) {
            results.push(await this.pm.hash(password, options));
        }
        return results;
    }

    /**
     * Verify multiple passwords
     */
    async verifyMany(
        passwordHashPairs: Array<{ password: string; hash: string }>
    ): Promise<boolean[]> {
        const results: boolean[] = [];
        for (const { password, hash } of passwordHashPairs) {
            const result = await this.pm.verify(password, hash);
            results.push(result.isValid);
        }
        return results;
    }

    /**
     * Generate multiple passwords
     */
    generateMany(
        count: number,
        options?: PasswordGenerationOptions
    ): PasswordGenerationResult[] {
        const generator = new PasswordGenerator(this.pm.getConfig());
        return generator.generateBatch(count, options);
    }
}

// ===== DEFAULT INSTANCE =====

/**
 * Default password manager instance
 * Ready to use out of the box
 */
export const defaultPasswordManager = PasswordManager.getInstance(
    getRecommendedConfig()
);

// ===== LEGACY SUPPORT =====

/**
 * Legacy class name for backward compatibility
 * @deprecated Use PasswordManager instead
 */
export const SecurePasswordManager = PasswordManager;


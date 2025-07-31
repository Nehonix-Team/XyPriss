/**
 * 🔐 Password Migration Module
 *
 * Handles migration from bcrypt and other password systems
 */

import { PasswordManager } from "./password-core";
import {
    PasswordMigrationResult,
    PasswordManagerConfig,
    PasswordAlgorithm,
    PasswordSecurityLevel,
    PasswordHashOptions,
} from "./password-types";

/**
 * Password migration utilities
 */
export class PasswordMigration {
    private config: PasswordManagerConfig;

    constructor(config: PasswordManagerConfig) {
        this.config = config;
    }

    /**
     * Update configuration
     */
    public updateConfig(config: PasswordManagerConfig): void {
        this.config = config;
    }

    /**
     * Migrate from bcrypt to XyPrissSecurity
     */
    public async fromBcrypt(
        password: string,
        bcryptHash: string,
        newOptions: PasswordHashOptions = {}
    ): Promise<PasswordMigrationResult> {
        try {
            // Try to import bcrypt
            const bcrypt = await import("bcrypt").catch(() => null);
            if (!bcrypt) {
                return {
                    newHash: bcryptHash,
                    migrated: false,
                    originalAlgorithm: "bcrypt",
                    newAlgorithm: PasswordAlgorithm.ARGON2ID,
                    securityImprovement: 0,
                    recommendations: [
                        "bcrypt library not available for migration",
                    ],
                };
            }

            // Verify the bcrypt hash first
            const isValid = await bcrypt.compare(password, bcryptHash);
            if (!isValid) {
                return {
                    newHash: bcryptHash,
                    migrated: false,
                    originalAlgorithm: "bcrypt",
                    newAlgorithm: PasswordAlgorithm.ARGON2ID,
                    securityImprovement: 0,
                    recommendations: ["Password verification failed"],
                };
            }

            // Create new hash with enhanced security using real implementation
            const enhancedOptions: PasswordHashOptions = {
                algorithm: PasswordAlgorithm.ARGON2ID,
                securityLevel: PasswordSecurityLevel.HIGH,
                iterations: 100000,
                memorySize: 65536,
                parallelism: 4,
                saltLength: 32,
                ...newOptions,
            };

            // Use real PasswordManager to create new hash
            const pm = PasswordManager.getInstance();
            const newHash = await pm.hash(password, enhancedOptions);

            const securityImprovement = this.calculateSecurityImprovement(
                "bcrypt",
                enhancedOptions.algorithm!
            );

            return {
                newHash,
                migrated: true,
                originalAlgorithm: "bcrypt",
                newAlgorithm: enhancedOptions.algorithm!,
                securityImprovement,
                recommendations: [
                    "Successfully migrated to Argon2ID",
                    "Consider enabling additional security features",
                    "Update all user passwords gradually",
                ],
            };
        } catch (error) {
            return {
                newHash: bcryptHash,
                migrated: false,
                originalAlgorithm: "bcrypt",
                newAlgorithm: PasswordAlgorithm.ARGON2ID,
                securityImprovement: 0,
                recommendations: [
                    `Migration failed: ${(error as Error).message}`,
                ],
            };
        }
    }

    /**
     * Migrate from PBKDF2
     */
    public async fromPBKDF2(
        password: string,
        pbkdf2Hash: string,
        iterations: number,
        newOptions: PasswordHashOptions = {}
    ): Promise<PasswordMigrationResult> {
        // Implementation for PBKDF2 migration
        const enhancedOptions: PasswordHashOptions = {
            algorithm: PasswordAlgorithm.ARGON2ID,
            securityLevel: PasswordSecurityLevel.HIGH,
            ...newOptions,
        };

        const securityImprovement = this.calculateSecurityImprovement(
            "pbkdf2",
            enhancedOptions.algorithm!
        );

        // Create new hash using real PasswordManager
        const pm = PasswordManager.getInstance();
        const newHash = await pm.hash(password, enhancedOptions);

        return {
            newHash,
            migrated: true,
            originalAlgorithm: "pbkdf2",
            newAlgorithm: enhancedOptions.algorithm!,
            securityImprovement,
            recommendations: [
                "Migrated from PBKDF2 to modern algorithm",
                "Security significantly improved",
                `Original iterations: ${iterations}, New: ${
                    enhancedOptions.iterations || 100000
                }`,
            ],
        };
    }

    /**
     * Migrate from plain text (emergency use only)
     */
    public async fromPlainText(
        password: string,
        newOptions: PasswordHashOptions = {}
    ): Promise<PasswordMigrationResult> {
        const enhancedOptions: PasswordHashOptions = {
            algorithm: PasswordAlgorithm.MILITARY,
            securityLevel: PasswordSecurityLevel.MAXIMUM,
            ...newOptions,
        };

        // Create new hash using real PasswordManager with maximum security
        const pm = PasswordManager.getInstance();
        const newHash = await pm.hash(password, enhancedOptions);

        return {
            newHash,
            migrated: true,
            originalAlgorithm: "plaintext",
            newAlgorithm: enhancedOptions.algorithm!,
            securityImprovement: 1000, // Massive improvement
            recommendations: [
                "CRITICAL: Migrated from plain text storage",
                "Implement immediate security audit",
                "Force all users to change passwords",
                "Review security practices",
                "Password now protected with military-grade hashing",
            ],
        };
    }

    /**
     * Batch migration utility
     */
    public async batchMigrate(
        passwords: Array<{
            password: string;
            oldHash: string;
            algorithm: string;
        }>,
        newOptions: PasswordHashOptions = {}
    ): Promise<PasswordMigrationResult[]> {
        const results: PasswordMigrationResult[] = [];

        for (const { password, oldHash, algorithm } of passwords) {
            let result: PasswordMigrationResult;

            switch (algorithm.toLowerCase()) {
                case "bcrypt":
                    result = await this.fromBcrypt(
                        password,
                        oldHash,
                        newOptions
                    );
                    break;

                case "pbkdf2":
                    result = await this.fromPBKDF2(
                        password,
                        oldHash,
                        100000,
                        newOptions
                    );
                    break;

                case "plaintext":
                case "plain":
                    result = await this.fromPlainText(password, newOptions);
                    break;

                default:
                    result = {
                        newHash: oldHash,
                        migrated: false,
                        originalAlgorithm: algorithm,
                        newAlgorithm: PasswordAlgorithm.ARGON2ID,
                        securityImprovement: 0,
                        recommendations: [
                            `Unsupported algorithm: ${algorithm}`,
                        ],
                    };
            }

            results.push(result);
        }

        return results;
    }

    /**
     * Generate migration report
     */
    public generateMigrationReport(results: PasswordMigrationResult[]): {
        totalPasswords: number;
        successfulMigrations: number;
        failedMigrations: number;
        averageSecurityImprovement: number;
        recommendations: string[];
    } {
        const totalPasswords = results.length;
        const successfulMigrations = results.filter((r) => r.migrated).length;
        const failedMigrations = totalPasswords - successfulMigrations;

        const totalImprovement = results
            .filter((r) => r.migrated)
            .reduce((sum, r) => sum + r.securityImprovement, 0);

        const averageSecurityImprovement =
            successfulMigrations > 0
                ? totalImprovement / successfulMigrations
                : 0;

        const recommendations: string[] = [
            `Successfully migrated ${successfulMigrations}/${totalPasswords} passwords`,
            `Average security improvement: ${averageSecurityImprovement.toFixed(
                1
            )}%`,
        ];

        if (failedMigrations > 0) {
            recommendations.push(
                `${failedMigrations} migrations failed - review and retry`
            );
        }

        if (averageSecurityImprovement > 200) {
            recommendations.push("Significant security improvement achieved");
        }

        return {
            totalPasswords,
            successfulMigrations,
            failedMigrations,
            averageSecurityImprovement,
            recommendations,
        };
    }

    // ===== PRIVATE HELPER METHODS =====

    private calculateSecurityImprovement(
        oldAlgorithm: string,
        newAlgorithm: PasswordAlgorithm
    ): number {
        // Security improvement percentages (rough estimates)
        const algorithmScores: Record<string, number> = {
            plaintext: 0,
            md5: 10,
            sha1: 20,
            sha256: 30,
            bcrypt: 60,
            pbkdf2: 65,
            scrypt: 80,
            argon2i: 90,
            argon2d: 90,
            argon2id: 95,
            military: 100,
        };

        const oldScore = algorithmScores[oldAlgorithm.toLowerCase()] || 50;
        const newScore = algorithmScores[newAlgorithm.toLowerCase()] || 80;

        return Math.max(0, ((newScore - oldScore) / oldScore) * 100);
    }
}


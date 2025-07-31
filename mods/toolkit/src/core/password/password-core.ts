/**
 * PasswordManager - Core Password Management Class
 *
 * A modular, military-grade password management system
 * Short name: PasswordManager (instead of SecurePasswordManager)
 */

import { SecureRandom } from "../random";
import { secureWipe } from "../../components";
import { constantTimeEqual } from "../../components";
import {
    PasswordAlgorithm,
    PasswordSecurityLevel,
    PasswordHashOptions,
    PasswordVerificationResult,
    PasswordHashMetadata,
    PasswordManagerConfig,
    PasswordStorageOptions,
} from "./password-types";
import { PasswordAlgorithms } from "./password-algorithms";
import { PasswordSecurity } from "./password-security";
import { PasswordMigration } from "./password-migration";
import { PasswordGenerator } from "./password-generator";
import { PasswordUtils } from "./password-utils";

/**
 * @author Supper Coder
 *  PasswordManager
 *
 * Main class for secure password management with modular architecture
 */
export class PasswordManager {
    private static instance: PasswordManager;
    private config: PasswordManagerConfig;
    private algorithms: PasswordAlgorithms;
    private security: PasswordSecurity;
    private migration: PasswordMigration;
    private generator: PasswordGenerator;
    private utils: PasswordUtils;

    private constructor(config?: Partial<PasswordManagerConfig>) {
        this.config = {
            defaultAlgorithm: PasswordAlgorithm.ARGON2ID,
            defaultSecurityLevel: PasswordSecurityLevel.HIGH,
            timingSafeVerification: true,
            secureMemoryWipe: true,
            enableMigration: true,
            ...config,
        };

        // Initialize modular components
        this.algorithms = new PasswordAlgorithms(this.config);
        this.security = new PasswordSecurity(this.config);
        this.migration = new PasswordMigration(this.config);
        this.generator = new PasswordGenerator(this.config);
        this.utils = new PasswordUtils(this.config);
    }

    /**
     * Get singleton instance
     */
    public static getInstance(
        config?: Partial<PasswordManagerConfig>
    ): PasswordManager {
        if (!PasswordManager.instance) {
            PasswordManager.instance = new PasswordManager(config);
        }
        return PasswordManager.instance;
    }

    /**
     * Create a new instance (for multiple configurations)
     */
    public static create(
        config?: Partial<PasswordManagerConfig>
    ): PasswordManager {
        return new PasswordManager(config);
    }

    /**
     * Hash a password with advanced security
     */
    public async hash(
        password: string,
        options: PasswordHashOptions = {}
    ): Promise<string> {
        // Input validation
        if (!password || password.length === 0) {
            throw new Error("Password cannot be empty");
        }

        const opts = this.mergeOptions(options);

        try {
            // Apply pepper if configured
            const processedPassword = this.applyPepper(password);

            // Generate salt
            const salt = SecureRandom.generateSalt(opts.saltLength!);

            // Hash using selected algorithm
            const hash = await this.algorithms.hash(
                processedPassword,
                salt,
                opts
            );

            // Create metadata
            const metadata = this.createMetadata(opts);

            // Combine hash with metadata
            const result = this.utils.combineHashWithMetadata(
                hash,
                salt,
                metadata
            );

            // Encrypt if encryption key is available
            if (
                this.config.encryptionKey &&
                opts.securityLevel !== PasswordSecurityLevel.STANDARD
            ) {
                return await this.utils.encryptPasswordHash(
                    result,
                    this.config.encryptionKey
                );
            }

            return result;
        } finally {
            // Secure cleanup
            if (opts.secureWipe) {
                secureWipe(Buffer.from(password));
            }
        }
    }

    /**
     * Verify a password against a hash
     */
    public async verify(
        password: string,
        hash: string
    ): Promise<PasswordVerificationResult> {
        const startTime = Date.now();

        try {
            // Decrypt hash if needed
            let actualHash = hash;
            if (this.config.encryptionKey && this.utils.isEncryptedHash(hash)) {
                actualHash = await this.utils.decryptPasswordHash(
                    hash,
                    this.config.encryptionKey
                );
            }

            // Parse metadata
            const {
                hash: extractedHash,
                salt,
                metadata,
            } = this.utils.parseHashWithMetadata(actualHash);

            // Apply pepper if configured
            const processedPassword = this.applyPepper(password);

            // Verify using the same algorithm
            const isValid = await this.algorithms.verify(
                processedPassword,
                extractedHash,
                salt,
                metadata
            );

            const timeTaken = Date.now() - startTime;

            // Check if rehashing is needed
            const needsRehash = this.shouldRehash(metadata);

            // Generate recommendations
            const recommendations = this.generateRecommendations(
                metadata,
                timeTaken
            );

            return {
                isValid,
                needsRehash,
                securityLevel: metadata.securityLevel,
                algorithm: metadata.algorithm,
                timeTaken,
                recommendations,
            };
        } catch (error) {
            // Timing-safe error handling
            if (this.config.timingSafeVerification) {
                await this.constantTimeDelay();
            }

            return {
                isValid: false,
                securityLevel: PasswordSecurityLevel.STANDARD,
                algorithm: PasswordAlgorithm.PBKDF2_SHA512,
                timeTaken: Date.now() - startTime,
                recommendations: ["Password verification failed"],
            };
        }
    }

    /**
     * Generate a secure password
     */
    public generatePassword(options: any = {}) {
        return this.generator.generate(options);
    }

    /**
     * Analyze password strength
     */
    public analyzeStrength(password: string) {
        return this.security.analyzeStrength(password);
    }

    /**
     * Migrate from bcrypt or other systems
     */
    public async migrate(password: string, oldHash: string, options: any = {}) {
        return this.migration.fromBcrypt(password, oldHash, options);
    }

    /**
     * Validate password against policy
     */
    public validatePolicy(password: string) {
        return this.security.validatePolicy(password);
    }

    /**
     * Rehash password with updated security
     */
    public async rehash(
        password: string,
        oldHash: string,
        newOptions: PasswordHashOptions = {}
    ): Promise<{ newHash: string; upgraded: boolean }> {
        // First verify the old password
        const verification = await this.verify(password, oldHash);

        if (!verification.isValid) {
            return { newHash: oldHash, upgraded: false };
        }

        // Create new hash with enhanced options
        const enhancedOptions = {
            ...this.config,
            algorithm: PasswordAlgorithm.ARGON2ID,
            securityLevel: PasswordSecurityLevel.MAXIMUM,
            ...newOptions,
        };

        const newHash = await this.hash(password, enhancedOptions);

        return { newHash, upgraded: true };
    }

    /**
     * Audit password security
     */
    public async auditSecurity(hashes: string[]) {
        return this.security.auditPasswords(hashes);
    }

    /**
     * Configure global settings
     */
    public configure(config: Partial<PasswordManagerConfig>): void {
        this.config = { ...this.config, ...config };

        // Update modular components
        this.algorithms.updateConfig(this.config);
        this.security.updateConfig(this.config);
        this.migration.updateConfig(this.config);
        this.generator.updateConfig(this.config);
        this.utils.updateConfig(this.config);
    }

    /**
     * Get current configuration
     */
    public getConfig(): PasswordManagerConfig {
        return { ...this.config };
    }

    // ===== PRIVATE HELPER METHODS =====

    private mergeOptions(options: PasswordHashOptions): PasswordHashOptions {
        return {
            algorithm: this.config.defaultAlgorithm,
            securityLevel: this.config.defaultSecurityLevel,
            iterations: 100000,
            memorySize: 65536, // 64MB
            parallelism: 4,
            saltLength: 32,
            quantumResistant: false,
            timingSafe: this.config.timingSafeVerification,
            secureWipe: this.config.secureMemoryWipe,
            ...options,
        };
    }

    private applyPepper(password: string): string {
        return this.config.globalPepper
            ? password + this.config.globalPepper
            : password;
    }

    private createMetadata(options: PasswordHashOptions): PasswordHashMetadata {
        return {
            algorithm: options.algorithm!,
            securityLevel: options.securityLevel!,
            iterations: options.iterations!,
            memorySize: options.memorySize,
            parallelism: options.parallelism,
            saltLength: options.saltLength!,
            hasEncryption: !!this.config.encryptionKey,
            hasPepper: !!this.config.globalPepper,
            timestamp: Date.now(),
            version: "2.0.0",
        };
    }

    private shouldRehash(metadata: PasswordHashMetadata): boolean {
        // Check if algorithm is outdated
        if (
            metadata.algorithm === PasswordAlgorithm.PBKDF2_SHA512 &&
            metadata.iterations < 100000
        ) {
            return true;
        }

        // Check if security level is below current default
        if (
            metadata.securityLevel === PasswordSecurityLevel.STANDARD &&
            this.config.defaultSecurityLevel !== PasswordSecurityLevel.STANDARD
        ) {
            return true;
        }

        // Check age (if policy specifies max age)
        if (this.config.policy?.maxAge) {
            const ageInDays =
                (Date.now() - metadata.timestamp) / (1000 * 60 * 60 * 24);
            if (ageInDays > this.config.policy.maxAge) {
                return true;
            }
        }

        return false;
    }

    private generateRecommendations(
        metadata: PasswordHashMetadata,
        timeTaken: number
    ): string[] {
        const recommendations: string[] = [];

        if (this.shouldRehash(metadata)) {
            recommendations.push("Consider upgrading password hash");
        }

        if (timeTaken > 1000) {
            recommendations.push(
                "Verification time is high, consider optimizing"
            );
        }

        if (
            !metadata.hasEncryption &&
            metadata.securityLevel === PasswordSecurityLevel.MILITARY
        ) {
            recommendations.push(
                "Consider enabling encryption for military-grade security"
            );
        }

        return recommendations;
    }

    private async constantTimeDelay(): Promise<void> {
        // Add a small random delay to prevent timing attacks
        const delay = 50 + Math.floor(Math.random() * 100);
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
}

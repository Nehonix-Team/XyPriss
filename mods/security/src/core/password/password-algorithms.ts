/**
 * 🔐 Password Algorithms Module
 *
 * Implements various password hashing algorithms with security optimizations
 */

import { Hash, HashStrength } from "../hash";
import { SecureRandom } from "../random";
import { constantTimeEqual } from "../../components";
import { HashAlgorithm } from "../../types";
import {
    PasswordAlgorithm,
    PasswordSecurityLevel,
    PasswordHashOptions,
    PasswordHashMetadata,
    PasswordManagerConfig,
    Argon2Options,
    ScryptOptions,
    PBKDF2Options,
} from "./password-types";

/**
 * Password hashing algorithms implementation
 */
export class PasswordAlgorithms {
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
     * Hash password using specified algorithm
     */
    public async hash(
        password: string,
        salt: Uint8Array,
        options: PasswordHashOptions
    ): Promise<string> {
        switch (options.algorithm) {
            case PasswordAlgorithm.ARGON2ID:
                return this.hashWithArgon2(password, salt, options, "id");

            case PasswordAlgorithm.ARGON2I:
                return this.hashWithArgon2(password, salt, options, "i");

            case PasswordAlgorithm.ARGON2D:
                return this.hashWithArgon2(password, salt, options, "d");

            case PasswordAlgorithm.SCRYPT:
                return this.hashWithScrypt(password, salt, options);

            case PasswordAlgorithm.PBKDF2_SHA512:
                return this.hashWithPBKDF2(password, salt, options);

            case PasswordAlgorithm.BCRYPT_PLUS:
                return this.hashWithBcryptPlus(password, salt, options);

            case PasswordAlgorithm.MILITARY:
                return this.hashWithMilitary(password, salt, options);

            default:
                throw new Error(`Unsupported algorithm: ${options.algorithm}`);
        }
    }

    /**
     * Verify password using specified algorithm
     */
    public async verify(
        password: string,
        hash: string,
        salt: Uint8Array,
        metadata: PasswordHashMetadata
    ): Promise<boolean> {
        const options: PasswordHashOptions = {
            algorithm: metadata.algorithm,
            securityLevel: metadata.securityLevel,
            iterations: metadata.iterations,
            memorySize: metadata.memorySize,
            parallelism: metadata.parallelism,
            saltLength: metadata.saltLength,
        };

        const computedHash = await this.hash(password, salt, options);

        // Use constant-time comparison to prevent timing attacks
        return constantTimeEqual(hash, computedHash);
    }

    /**
     * Hash with Argon2 (recommended)
     */
    private async hashWithArgon2(
        password: string,
        salt: Uint8Array,
        options: PasswordHashOptions,
        variant: "i" | "d" | "id"
    ): Promise<string> {
        // Try to use native Argon2 implementation
        try {
            const argon2 = await import("argon2").catch(() => null);
            if (argon2) {
                const argon2Options = {
                    type:
                        variant === "i"
                            ? argon2.argon2i
                            : variant === "d"
                            ? argon2.argon2d
                            : argon2.argon2id,
                    memoryCost: options.memorySize || 65536,
                    timeCost: Math.floor((options.iterations || 100000) / 1000),
                    parallelism: options.parallelism || 4,
                    salt: Buffer.from(salt),
                    hashLength: 32,
                };

                const fullHash = await argon2.hash(password, argon2Options);
                // Extract just the hash part from the full Argon2 format
                return this.extractHashValue(fullHash);
            }
        } catch (error) {
            // Fall back to custom implementation
        }

        // Fallback: Use PBKDF2 with enhanced security
        return this.hashWithEnhancedPBKDF2(
            password,
            salt,
            options,
            `argon2${variant}-fallback`
        );
    }

    /**
     * Hash with scrypt
     */
    private async hashWithScrypt(
        password: string,
        salt: Uint8Array,
        options: PasswordHashOptions
    ): Promise<string> {
        try {
            // Use Node.js built-in crypto.scrypt
            const crypto = await import("crypto");
            const scryptOptions = {
                N: Math.pow(2, 14), // CPU/memory cost (16384 - more reasonable)
                r: 8, // Block size
                p: options.parallelism || 1,
            };

            // Use promisified scrypt
            const result = await new Promise<Buffer>((resolve, reject) => {
                crypto.scrypt(
                    password,
                    Buffer.from(salt),
                    32,
                    scryptOptions,
                    (err, derivedKey) => {
                        if (err) reject(err);
                        else resolve(derivedKey);
                    }
                );
            });

            return result.toString("hex");
        } catch (error) {
            // Fall back to enhanced PBKDF2
        }

        return this.hashWithEnhancedPBKDF2(
            password,
            salt,
            options,
            "scrypt-fallback"
        );
    }

    /**
     * Hash with PBKDF2-SHA512
     */
    private async hashWithPBKDF2(
        password: string,
        salt: Uint8Array,
        options: PasswordHashOptions
    ): Promise<string> {
        const iterations = options.iterations || 100000;

        // Use XyPrissSecurity Hash module for PBKDF2
        const hash = Hash.createSecureHash(password, salt, {
            algorithm: HashAlgorithm.PBKDF2,
            iterations,
            outputFormat: "hex",
            strength: HashStrength.MILITARY,
            memoryHard: false, // Explicitly disable memory-hard hashing
            quantumResistant: false, // Explicitly disable quantum-resistant hashing
            timingSafe: false, // Explicitly disable timing-safe hashing
        }) as string;

        // Extract just the hash part using our helper method
        return this.extractHashValue(hash);
    }

    /**
     * Enhanced PBKDF2 with multiple rounds and algorithms
     */
    private async hashWithEnhancedPBKDF2(
        password: string,
        salt: Uint8Array,
        options: PasswordHashOptions,
        prefix: string = "enhanced"
    ): Promise<string> {
        const iterations = options.iterations || 100000;

        // First round: PBKDF2-SHA512
        let round1 = Hash.createSecureHash(password, salt, {
            algorithm: HashAlgorithm.PBKDF2,
            iterations: Math.floor(iterations / 3),
            outputFormat: "hex",
            memoryHard: false,
            quantumResistant: false,
            timingSafe: false,
        }) as string;

        // Extract just the hash using our helper method
        round1 = this.extractHashValue(round1);

        // Second round: SHA3-512
        let round2 = Hash.createSecureHash(round1, salt, {
            algorithm: HashAlgorithm.SHA3_512,
            iterations: Math.floor(iterations / 3),
            outputFormat: "hex",
            memoryHard: false,
            quantumResistant: false,
            timingSafe: false,
        }) as string;

        // Extract just the hash using our helper method
        round2 = this.extractHashValue(round2);

        // Third round: BLAKE3
        let finalHash = Hash.createSecureHash(round2, salt, {
            algorithm: HashAlgorithm.BLAKE3,
            iterations: Math.floor(iterations / 3),
            outputFormat: "hex",
            memoryHard: false,
            quantumResistant: false,
            timingSafe: false,
        }) as string;

        // Extract just the hash using our helper method
        finalHash = this.extractHashValue(finalHash);

        return `${prefix}:${finalHash}`;
    }

    /**
     * Enhanced bcrypt with additional security layers
     */
    private async hashWithBcryptPlus(
        password: string,
        salt: Uint8Array,
        options: PasswordHashOptions
    ): Promise<string> {
        try {
            const bcrypt = await import("bcrypt").catch(() => null);
            if (bcrypt) {
                // First layer: Standard bcrypt
                const rounds = Math.min(
                    15,
                    Math.max(
                        10,
                        Math.floor((options.iterations || 100000) / 10000)
                    )
                );
                const bcryptHash = await bcrypt.hash(password, rounds);

                // Second layer: PBKDF2 on bcrypt result
                let enhancedHash = Hash.createSecureHash(bcryptHash, salt, {
                    algorithm: HashAlgorithm.PBKDF2,
                    iterations: 50000,
                    outputFormat: "hex",
                    memoryHard: false,
                    quantumResistant: false,
                    timingSafe: false,
                }) as string;

                // Extract just the hash using our helper method
                enhancedHash = this.extractHashValue(enhancedHash);

                return `bcrypt-plus:${enhancedHash}`;
            }
        } catch (error) {
            // Fall back to enhanced PBKDF2
        }

        return this.hashWithEnhancedPBKDF2(
            password,
            salt,
            options,
            "bcrypt-plus-fallback"
        );
    }

    /**
     * Military-grade multi-layer hashing
     */
    private async hashWithMilitary(
        password: string,
        salt: Uint8Array,
        options: PasswordHashOptions
    ): Promise<string> {
        const iterations = options.iterations || 200000;

        // Layer 1: Key stretching with PBKDF2-SHA512
        let layer1 = Hash.createSecureHash(password, salt, {
            algorithm: HashAlgorithm.PBKDF2,
            iterations: Math.floor(iterations / 4),
            outputFormat: "hex",
            memoryHard: false,
            quantumResistant: false,
            timingSafe: false,
        }) as string;

        // Extract just the hash using our helper method
        layer1 = this.extractHashValue(layer1);

        // Layer 2: Memory-hard function simulation
        let layer2 = layer1;
        for (let i = 0; i < 1000; i++) {
            const tempSalt = SecureRandom.generateSalt(32);
            let tempHash = Hash.createSecureHash(layer2, tempSalt, {
                algorithm: HashAlgorithm.SHA3_512,
                outputFormat: "hex",
                memoryHard: false,
                quantumResistant: false,
                timingSafe: false,
            }) as string;

            // Extract just the hash using our helper method
            layer2 = this.extractHashValue(tempHash);
        }

        // Layer 3: BLAKE3 with high iterations
        let layer3 = Hash.createSecureHash(layer2, salt, {
            algorithm: HashAlgorithm.BLAKE3,
            iterations: Math.floor(iterations / 4),
            outputFormat: "hex",
            memoryHard: false,
            quantumResistant: false,
            timingSafe: false,
        }) as string;

        // Extract just the hash using our helper method
        layer3 = this.extractHashValue(layer3);

        // Layer 4: Final hardening with SHA3-512
        let finalHash = Hash.createSecureHash(layer3, salt, {
            algorithm: HashAlgorithm.SHA3_512,
            iterations: Math.floor(iterations / 4),
            outputFormat: "hex",
            strength: HashStrength.MILITARY,
            memoryHard: false,
            quantumResistant: false,
            timingSafe: false,
        }) as string;

        // Extract just the hash using our helper method
        finalHash = this.extractHashValue(finalHash);

        return `military:${finalHash}`;
    }

    // ===== PRIVATE HELPER METHODS =====

    /**
     * Extract just the hash value from complex hash formats
     */
    private extractHashValue(hashResult: string): string {
        // Handle Argon2 format: $argon2id$v=19$m=65536,t=3,p=4$salt$hash
        if (hashResult.startsWith("$argon2")) {
            const parts = hashResult.split("$");
            if (parts.length >= 6) {
                return parts[5]; // The actual hash is the last part
            }
        }

        // Handle PBKDF2 format: $pbkdf2$rounds$salt$hash
        if (hashResult.startsWith("$pbkdf2")) {
            const parts = hashResult.split("$");
            if (parts.length >= 5) {
                return parts[4]; // The actual hash
            }
        }

        // Handle bcrypt format: $2b$rounds$salthash (extract hash part)
        if (hashResult.startsWith("$2")) {
            const parts = hashResult.split("$");
            if (parts.length >= 4) {
                const saltAndHash = parts[3];
                if (saltAndHash.length > 22) {
                    return saltAndHash.substring(22); // bcrypt hash after 22-char salt
                }
            }
        }

        // Handle scrypt format: $scrypt$N$r$p$salt$hash
        if (hashResult.startsWith("$scrypt")) {
            const parts = hashResult.split("$");
            if (parts.length >= 7) {
                return parts[6]; // The actual hash
            }
        }

        // Handle any other $ delimited format - take the last part
        if (hashResult.includes("$")) {
            const parts = hashResult.split("$");
            return parts[parts.length - 1];
        }

        // If no special format, return as-is
        return hashResult;
    }

    /**
     * Get algorithm-specific default options
     */
    public getAlgorithmDefaults(
        algorithm: PasswordAlgorithm
    ): PasswordHashOptions {
        switch (algorithm) {
            case PasswordAlgorithm.ARGON2ID:
            case PasswordAlgorithm.ARGON2I:
            case PasswordAlgorithm.ARGON2D:
                return {
                    iterations: 3,
                    memorySize: 65536, // 64MB
                    parallelism: 4,
                    saltLength: 32,
                };

            case PasswordAlgorithm.SCRYPT:
                return {
                    iterations: 32768, // N parameter
                    memorySize: 8, // r parameter
                    parallelism: 1, // p parameter
                    saltLength: 32,
                };

            case PasswordAlgorithm.PBKDF2_SHA512:
                return {
                    iterations: 100000,
                    saltLength: 32,
                };

            case PasswordAlgorithm.BCRYPT_PLUS:
                return {
                    iterations: 120000, // Equivalent to bcrypt rounds + PBKDF2
                    saltLength: 32,
                };

            case PasswordAlgorithm.MILITARY:
                return {
                    iterations: 200000,
                    memorySize: 131072, // 128MB equivalent
                    parallelism: 8,
                    saltLength: 64,
                };

            default:
                return {
                    iterations: 100000,
                    saltLength: 32,
                };
        }
    }

    /**
     * Estimate hashing time for algorithm
     */
    public estimateHashingTime(
        algorithm: PasswordAlgorithm,
        options: PasswordHashOptions
    ): number {
        // Rough estimates in milliseconds
        switch (algorithm) {
            case PasswordAlgorithm.ARGON2ID:
            case PasswordAlgorithm.ARGON2I:
            case PasswordAlgorithm.ARGON2D:
                return (
                    (options.memorySize || 65536) / 1000 +
                    (options.iterations || 3) * 100
                );

            case PasswordAlgorithm.SCRYPT:
                return (options.iterations || 32768) / 100;

            case PasswordAlgorithm.PBKDF2_SHA512:
                return (options.iterations || 100000) / 1000;

            case PasswordAlgorithm.BCRYPT_PLUS:
                return (options.iterations || 120000) / 500;

            case PasswordAlgorithm.MILITARY:
                return (options.iterations || 200000) / 200;

            default:
                return 100; // Default estimate
        }
    }
}


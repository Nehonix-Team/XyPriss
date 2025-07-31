/**
 * Key Derivation Core
 * Main orchestrator for the modular key derivation system
 */

import {
    KeyDerivationOptions,
    ExtendedKeyDerivationOptions,
    KeyDerivationAlgorithm,
    KeyDerivationResult,
    KeyDerivationMetrics,
    AlgorithmBackend,
} from "./keys-types";
import { keyLogger } from "./keys-logger";
import {
    EnvironmentDetector,
    ValidationUtils,
    ConversionUtils,
    ALGORITHM_DEFAULTS,
} from "./keys-utils";
import { Argon2Algo, PBKDF2Algo, ScryptAlgo } from "./algorithms";
import { StatsTracker } from "../../utils/stats";
import { SecureRandom } from "../random";
import { SECURITY_DEFAULTS } from "../../utils/constants";

/**
 * Optimized Keys class with modular architecture
 * Maintains backward compatibility while providing enhanced performance
 */
export class OptimizedKeys {
    private static instance: OptimizedKeys;
    private environmentInfo = EnvironmentDetector.detect();
    private metricsCache: KeyDerivationMetrics[] = [];

    private constructor() {
        keyLogger.info("Core", "Optimized Keys system initialized", {
            environment: this.environmentInfo.type,
            capabilities: this.environmentInfo.capabilities,
        });
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): OptimizedKeys {
        if (!OptimizedKeys.instance) {
            OptimizedKeys.instance = new OptimizedKeys();
        }
        return OptimizedKeys.instance;
    }

    /**
     * Derive a key from a password or other input (backward compatible)
     * @param input - The input to derive a key from
     * @param options - Key derivation options
     * @returns The derived key as a hex string
     */
    public deriveKey(
        input: string | Uint8Array,
        options: KeyDerivationOptions = {}
    ): string {
        const result = this.deriveKeyExtended(input, options);
        return result.key;
    }

    /**
     * Derive a key with extended options and metadata
     * @param input - The input to derive a key from
     * @param options - Extended key derivation options
     * @returns Complete derivation result with metadata
     */
    public deriveKeyExtended(
        input: string | Uint8Array,
        options: ExtendedKeyDerivationOptions = {}
    ): KeyDerivationResult {
        const startTime = Date.now();

        // Validate and normalize inputs
        const algorithm = ValidationUtils.validateAlgorithm(
            options.algorithm || "pbkdf2"
        );
        const iterations = ValidationUtils.validateIterations(
            options.iterations || this.getDefaultIterations(algorithm)
        );
        const keyLength = ValidationUtils.validateKeyLength(
            options.keyLength || SECURITY_DEFAULTS.KEY_LENGTH
        );
        const hashFunction = ValidationUtils.validateHashFunction(
            options.hashFunction || "sha256"
        );

        // Convert input to bytes
        const inputBytes = ConversionUtils.toUint8Array(input);

        // Generate or validate salt
        let saltBytes: Uint8Array;
        if (options.salt) {
            saltBytes = ValidationUtils.validateSalt(options.salt)!;
        } else {
            saltBytes = SecureRandom.getRandomBytes(16);
        }

        keyLogger.logAlgorithmSelection(
            algorithm,
            AlgorithmBackend.NODE_CRYPTO, // Will be updated by implementation
            "User specified or default selection"
        );

        // Derive the key using the appropriate algorithm
        let derivationResult: {
            key: Uint8Array;
            backend: AlgorithmBackend;
            metrics: KeyDerivationMetrics;
        };

        try {
            switch (algorithm) {
                case KeyDerivationAlgorithm.PBKDF2:
                    derivationResult = PBKDF2Algo.derive(
                        inputBytes,
                        saltBytes,
                        iterations,
                        keyLength,
                        hashFunction
                    );
                    break;

                case KeyDerivationAlgorithm.SCRYPT:
                    const scryptCost = this.iterationsToScryptCost(iterations);
                    derivationResult = ScryptAlgo.derive(
                        inputBytes,
                        saltBytes,
                        scryptCost,
                        keyLength
                    );
                    break;

                case KeyDerivationAlgorithm.ARGON2:
                case KeyDerivationAlgorithm.ARGON2ID:
                    derivationResult = Argon2Algo.derive(
                        inputBytes,
                        saltBytes,
                        iterations,
                        keyLength,
                        "argon2id"
                    );
                    break;

                case KeyDerivationAlgorithm.ARGON2I:
                    derivationResult = Argon2Algo.derive(
                        inputBytes,
                        saltBytes,
                        iterations,
                        keyLength,
                        "argon2i"
                    );
                    break;

                case KeyDerivationAlgorithm.ARGON2D:
                    derivationResult = Argon2Algo.derive(
                        inputBytes,
                        saltBytes,
                        iterations,
                        keyLength,
                        "argon2d"
                    );
                    break;

                default:
                    throw new Error(`Unsupported algorithm: ${algorithm}`);
            }
        } catch (error) {
            keyLogger.error("Core", "Key derivation failed", error);
            throw error;
        }

        // Convert result to hex
        const hexKey = ConversionUtils.toHexString(derivationResult.key);

        // Secure memory cleanup
        if (options.secureWipe !== false) {
            ConversionUtils.secureWipe(derivationResult.key);
            ConversionUtils.secureWipe(inputBytes);
        }

        // Track statistics
        const endTime = Date.now();
        StatsTracker.getInstance().trackKeyDerivation(
            endTime - startTime,
            keyLength * 8 // Entropy bits
        );

        // Cache metrics
        this.metricsCache.push(derivationResult.metrics);
        if (this.metricsCache.length > 100) {
            this.metricsCache.shift(); // Keep only recent metrics
        }

        const result: KeyDerivationResult = {
            key: hexKey,
            algorithm,
            backend: derivationResult.backend,
            metrics: derivationResult.metrics,
            salt: saltBytes,
            iterations,
        };

        keyLogger.info("Core", "Key derivation completed successfully", {
            algorithm,
            backend: derivationResult.backend,
            executionTime: `${derivationResult.metrics.executionTime}ms`,
        });

        return result;
    }

    /**
     * Get default iterations for an algorithm
     */
    private getDefaultIterations(algorithm: KeyDerivationAlgorithm): number {
        switch (algorithm) {
            case KeyDerivationAlgorithm.PBKDF2:
                return ALGORITHM_DEFAULTS.PBKDF2.iterations;
            case KeyDerivationAlgorithm.SCRYPT:
                return Math.pow(2, ALGORITHM_DEFAULTS.SCRYPT.cost);
            case KeyDerivationAlgorithm.ARGON2:
            case KeyDerivationAlgorithm.ARGON2ID:
            case KeyDerivationAlgorithm.ARGON2I:
            case KeyDerivationAlgorithm.ARGON2D:
                return ALGORITHM_DEFAULTS.ARGON2.timeCost;
            default:
                return SECURITY_DEFAULTS.PBKDF2_ITERATIONS;
        }
    }

    /**
     * Convert iterations to scrypt cost parameter
     */
    private iterationsToScryptCost(iterations: number): number {
        // Convert iterations to scrypt N parameter (power of 2)
        const cost = Math.log2(iterations);
        return Math.max(10, Math.min(20, Math.round(cost)));
    }

    /**
     * Get performance metrics
     */
    public getMetrics(): KeyDerivationMetrics[] {
        return this.metricsCache.slice();
    }

    /**
     * Get environment information
     */
    public getEnvironmentInfo() {
        return this.environmentInfo;
    }

    /**
     * Clear metrics cache
     */
    public clearMetrics(): void {
        this.metricsCache.length = 0;
    }

    /**
     * Get algorithm recommendations based on environment
     */
    public getRecommendedAlgorithm(): KeyDerivationAlgorithm {
        if (this.environmentInfo.capabilities.argon2) {
            return KeyDerivationAlgorithm.ARGON2ID;
        } else if (this.environmentInfo.capabilities.scrypt) {
            return KeyDerivationAlgorithm.SCRYPT;
        } else {
            return KeyDerivationAlgorithm.PBKDF2;
        }
    }
}


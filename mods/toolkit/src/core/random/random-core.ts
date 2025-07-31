/**
 * Random core - Main SecureRandom class with modular architecture
 */

import { SECURITY_CONSTANTS } from "../../utils/constants";
import { StatsTracker } from "../../utils/stats";
import {
    RNGState,
    EntropyQuality,
    RandomState,
    RandomGenerationOptions,
    SecurityMonitoringResult,
    LibraryStatus,
    SecurityLevel,
} from "./random-types";
import { RandomSources } from "./random-sources";
import { RandomEntropy } from "./random-entropy";
import { RandomGenerators } from "./random-generators";
import { EnhancedUint8Array } from "../../helpers/Uint8Array";

/**
 * ## Core Cryptographic Exports
 *
 * Primary cryptographic classes and utilities for secure random generation,
 * key management, validation, and buffer operations.
 */

/**
 * ### Secure Random Generation
 *
 * High-entropy random number and data generation with multiple entropy sources.
 * Provides cryptographically secure random values for all security operations.
 *
 * @example
 * ```typescript
 * import { Random } from "xypriss-security";
 *
 * // Generate secure random bytes
 * const randomBytes = Random.getRandomBytes(32);
 *
 * // Generate secure UUID
 * const uuid = Random.generateSecureUUID();
 *
 * // Generate random integers
 * const randomInt = Random.getSecureRandomInt(1, 100);
 * ```
 */
export class SecureRandom {
    private static instance: SecureRandom;
    private state: RandomState;
    private stats: StatsTracker;

    private constructor() {
        this.stats = StatsTracker.getInstance();
        this.state = {
            entropyPool: Buffer.alloc(SECURITY_CONSTANTS.ENTROPY_POOL_SIZE),
            lastReseed: Date.now(),
            state: RNGState.UNINITIALIZED,
            bytesGenerated: 0,
            entropyQuality: EntropyQuality.POOR,
            securityLevel: SecurityLevel.HIGH,
            quantumSafeMode: false,
            reseedCounter: 0,
            hardwareEntropyAvailable: this.detectHardwareEntropy(),
            sidechannelProtection: true,
            entropyAugmentation: true,
            realTimeMonitoring: true,
            lastEntropyTest: Date.now(),
            entropyTestResults: new Map(),
            securityAlerts: [],
            additionalEntropySources: new Map(),
        };

        this.setupAdditionalEntropySources();
        this.initializeEntropyPool();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): SecureRandom {
        if (!SecureRandom.instance) {
            SecureRandom.instance = new SecureRandom();
        }
        return SecureRandom.instance;
    }

    /**
     * Initialize entropy pool
     */
    private async initializeEntropyPool(): Promise<void> {
        this.state.state = RNGState.INITIALIZING;

        try {
            this.state.entropyPool = await RandomEntropy.initializeEntropyPool(
                SECURITY_CONSTANTS.ENTROPY_POOL_SIZE
            );

            this.state.entropyQuality = RandomEntropy.assessEntropyQuality(
                this.state.entropyPool
            );
            this.state.state = RNGState.READY;
            this.state.lastReseed = Date.now();
        } catch (error) {
            this.state.state = RNGState.ERROR;
            throw new Error(`Failed to initialize entropy pool: ${error}`);
        }
    }

    /**
     * Setup additional entropy sources
     */
    private setupAdditionalEntropySources(): void {
        // High-resolution timing entropy
        this.state.additionalEntropySources.set("timing", () =>
            RandomEntropy.getTimingEntropy()
        );

        // Memory usage entropy
        this.state.additionalEntropySources.set("memory", () =>
            RandomEntropy.getMemoryEntropy()
        );

        // Process entropy
        this.state.additionalEntropySources.set("process", () =>
            RandomEntropy.getProcessEntropy()
        );
    }

    /**
     * Detect hardware entropy availability
     */
    private detectHardwareEntropy(): boolean {
        try {
            // Check for hardware random number generator
            if (
                typeof crypto !== "undefined" &&
                typeof crypto.getRandomValues === "function"
            ) {
                return true;
            }
            if (
                typeof window !== "undefined" &&
                window.crypto &&
                typeof window.crypto.getRandomValues === "function"
            ) {
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    // ============================================================================
    // PUBLIC API - CORE RANDOM GENERATION
    // ============================================================================

    /**
     * Generate ultra-secure random bytes with enhanced entropy
     * @param length - Number of bytes to generate
     * @param options - Generation options
     * @returns Enhanced random bytes
     */
    public static getRandomBytes(
        length: number,
        options: RandomGenerationOptions = {}
    ): EnhancedUint8Array {
        const instance = SecureRandom.getInstance();

        // Check if we need to reseed
        const reseedThreshold =
            options.reseedThreshold || SECURITY_CONSTANTS.RESEED_THRESHOLD;
        if (instance.state.bytesGenerated > reseedThreshold) {
            instance.reseedEntropyPool();
        }

        // Generate bytes using the generators module
        const bytes = RandomGenerators.getRandomBytes(length, options);

        // Update statistics
        instance.state.bytesGenerated += length;
        // instance.stats.recordRandomGeneration(length); // TODO: Implement this method

        // Return enhanced array
        return new EnhancedUint8Array(bytes);
    }

    /**
     * Get system random bytes (fallback method)
     */
    public static getSystemRandomBytes(length: number): Uint8Array {
        return RandomGenerators.getSystemRandomBytes(length);
    }

    /**
     * Generate secure random integer
     */
    public static getSecureRandomInt(
        min: number,
        max: number,
        options: RandomGenerationOptions = {}
    ): number {
        return RandomGenerators.getSecureRandomInt(min, max, options);
    }

    /**
     * Generate secure UUID v4
     */
    public static generateSecureUUID(
        options: RandomGenerationOptions = {}
    ): string {
        return RandomGenerators.generateSecureUUID(options);
    }

    /**
     * Generate secure random float
     */
    public static getSecureRandomFloat(
        options: RandomGenerationOptions = {}
    ): number {
        return RandomGenerators.getSecureRandomFloat(options);
    }

    /**
     * Generate secure random boolean
     */
    public static getSecureRandomBoolean(
        options: RandomGenerationOptions = {}
    ): boolean {
        return RandomGenerators.getSecureRandomBoolean(options);
    }

    /**
     * Generate salt
     */
    public static generateSalt(
        length: number = 32,
        options: RandomGenerationOptions = {}
    ): Buffer {
        return RandomGenerators.generateSalt(length, options);
    }

    // ============================================================================
    // ENTROPY MANAGEMENT
    // ============================================================================

    /**
     * Reseed entropy pool
     */
    public reseedEntropyPool(): void {
        this.state.state = RNGState.RESEEDING;

        try {
            RandomEntropy.reseedEntropyPool(this.state.entropyPool).then(
                (newPool) => {
                    this.state.entropyPool = newPool;
                    this.state.lastReseed = Date.now();
                    this.state.reseedCounter++;
                    this.state.state = RNGState.READY;
                    this.state.entropyQuality =
                        RandomEntropy.assessEntropyQuality(newPool);
                }
            );
        } catch (error) {
            this.state.state = RNGState.ERROR;
            console.error("Failed to reseed entropy pool:", error);
        }
    }

    /**
     * Get entropy analysis
     */
    public static getEntropyAnalysis(data?: Buffer) {
        const instance = SecureRandom.getInstance();
        const analysisData = data || instance.state.entropyPool;
        return RandomEntropy.analyzeEntropy(analysisData);
    }

    /**
     * Assess entropy quality
     */
    public static assessEntropyQuality(data: Buffer): EntropyQuality {
        return RandomEntropy.assessEntropyQuality(data);
    }

    // ============================================================================
    // MONITORING AND STATUS
    // ============================================================================

    /**
     * Get security monitoring result
     */
    public static getSecurityStatus(): SecurityMonitoringResult {
        const instance = SecureRandom.getInstance();
        const libraryStatus = RandomSources.getLibraryStatus();

        // Assess threats
        const threats: string[] = [];
        if (instance.state.entropyQuality === EntropyQuality.POOR) {
            threats.push("Low entropy quality detected");
        }
        if (
            instance.state.bytesGenerated >
            SECURITY_CONSTANTS.RESEED_THRESHOLD * 2
        ) {
            threats.push("Entropy pool needs reseeding");
        }
        if (!libraryStatus.sodium && !libraryStatus.secureRandom) {
            threats.push("No enhanced entropy sources available");
        }

        // Generate recommendations
        const recommendations: string[] = [];
        if (threats.length > 0) {
            recommendations.push("Consider reseeding entropy pool");
        }
        if (instance.state.entropyQuality !== EntropyQuality.MILITARY) {
            recommendations.push(
                "Enable quantum-safe mode for maximum security"
            );
        }

        return {
            entropyQuality: instance.state.entropyQuality,
            securityLevel: instance.state.securityLevel,
            threats,
            recommendations,
            timestamp: Date.now(),
            bytesGenerated: instance.state.bytesGenerated,
            reseedCount: instance.state.reseedCounter,
            libraryStatus,
        };
    }

    /**
     * Get library status
     */
    public static getLibraryStatus(): LibraryStatus {
        return RandomSources.getLibraryStatus();
    }

    /**
     * Check if secure random is available
     */
    public static isSecureRandomAvailable(): boolean {
        return (
            (typeof crypto !== "undefined" &&
                typeof crypto.getRandomValues === "function") ||
            (typeof window !== "undefined" &&
                typeof window.crypto !== "undefined" &&
                typeof window.crypto.getRandomValues === "function") ||
            typeof require === "function"
        );
    }

    /**
     * Get current state
     */
    public getState(): RandomState {
        return { ...this.state };
    }

    /**
     * Get statistics
     */
    public static getStatistics() {
        const instance = SecureRandom.getInstance();
        return {
            bytesGenerated: instance.state.bytesGenerated,
            reseedCount: instance.state.reseedCounter,
            lastReseed: instance.state.lastReseed,
            entropyQuality: instance.state.entropyQuality,
            state: instance.state.state,
        };
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    /**
     * Reset instance (for testing)
     */
    public static resetInstance(): void {
        SecureRandom.instance = new SecureRandom();
    }

    /**
     * Enable quantum-safe mode
     */
    public static enableQuantumSafeMode(): void {
        const instance = SecureRandom.getInstance();
        instance.state.quantumSafeMode = true;
    }

    /**
     * Disable quantum-safe mode
     */
    public static disableQuantumSafeMode(): void {
        const instance = SecureRandom.getInstance();
        instance.state.quantumSafeMode = false;
    }

    /**
     * Set security level
     */
    public static setSecurityLevel(level: SecurityLevel): void {
        const instance = SecureRandom.getInstance();
        instance.state.securityLevel = level;
    }
}


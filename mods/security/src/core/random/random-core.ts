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
import { RandomTokens } from "./random-tokens";
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

    // ============================================================================
    // TOKEN GENERATION APIS
    // ============================================================================

    /**
     * ### Generate Secure Password
     *
     * Creates a cryptographically secure password with enforced complexity requirements.
     * Ensures the password contains at least one character from each required character set
     * and shuffles the result to prevent predictable patterns.
     *
     * @param {number} [length=16] - Desired password length (minimum 8 characters)
     * @param {import('./random-types').TokenGenerationOptions} [options] - Password generation options
     * @param {boolean} [options.includeUppercase=true] - Include uppercase letters (A-Z)
     * @param {boolean} [options.includeLowercase=true] - Include lowercase letters (a-z)
     * @param {boolean} [options.includeNumbers=true] - Include numeric digits (0-9)
     * @param {boolean} [options.includeSymbols=true] - Include special symbols (!@#$%^&*)
     * @param {boolean} [options.excludeSimilarCharacters=true] - Exclude visually similar characters (0O1lI|)
     * @param {import('./random-types').SecurityLevel} [options.entropyLevel='high'] - Security level for entropy
     * @returns {string} A cryptographically secure password meeting all complexity requirements
     *
     * @example
     * ```typescript
     * // Generate a 16-character password with all character types
     * const password = SecureRandom.generateSecurePassword(16);
     * // Output: "Tr7$Kp9#mN2&vL4!"
     *
     * // Generate a simpler password without symbols
     * const simple = SecureRandom.generateSecurePassword(12, {
     *   includeSymbols: false
     * });
     * ```
     *
     * @security This method uses cryptographically secure random generation
     * @throws {Error} If password length is less than 8 characters
     */
    public static generateSecurePassword(
        ...params: Parameters<typeof RandomTokens.generateSecurePassword>
    ): string {
        return RandomTokens.generateSecurePassword(...params);
    }

    /**
     * ### Generate Session Token
     *
     * Creates a secure session token encoded in the specified format.
     * Uses high-entropy random bytes for maximum security.
     *
     * @param {number} [length=32] - Token length in bytes before encoding
     * @param {"hex"|"base64"|"base64url"} [encoding="base64url"] - Output encoding format
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {string} Secure session token in the specified encoding
     *
     * @example
     * ```typescript
     * // Generate a base64url session token
     * const token = SecureRandom.generateSessionToken(32, 'base64url');
     *
     * // Generate a hex token for database storage
     * const hexToken = SecureRandom.generateSessionToken(32, 'hex');
     * ```
     */
    public static generateSessionToken(
        ...params: Parameters<typeof RandomTokens.generateSessionToken>
    ): string {
        return RandomTokens.generateSessionToken(...params);
    }

    /**
     * ### Generate API Key
     *
     * Creates a secure API key with optional prefix for easy identification.
     * Uses a combination of random characters for maximum security.
     *
     * @param {number} [length=32] - Length of the random part of the API key
     * @param {string} [prefix] - Optional prefix (e.g., "sk_", "pk_") followed by underscore
     * @param {import('./random-types').TokenGenerationOptions} [options] - Generation options
     * @returns {string} Secure API key with optional prefix
     *
     * @example
     * ```typescript
     * // Generate API key with prefix
     * const key = SecureRandom.generateAPIKey(32, 'sk_live_');
     * // Output: "**************************"
     *
     * // Generate API key without prefix
     * const key = SecureRandom.generateAPIKey(24);
     * ```
     */
    public static generateAPIKey(
        ...params: Parameters<typeof RandomTokens.generateAPIKey>
    ): string {
        return RandomTokens.generateAPIKey(...params);
    }

    /**
     * ### Generate Secure PIN
     *
     * Creates a numeric PIN code for authentication purposes.
     * Uses cryptographically secure random digits.
     *
     * @param {number} [length=6] - PIN length (minimum 4 digits)
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {string} Numeric PIN as a string
     *
     * @example
     * ```typescript
     * // Generate a 6-digit PIN
     * const pin = SecureRandom.generateSecurePIN(6);
     * // Output: "482739"
     *
     * // Generate a longer PIN
     * const longPin = SecureRandom.generateSecurePIN(8);
     * ```
     *
     * @throws {Error} If PIN length is less than 4 digits
     */
    public static generateSecurePIN(
        ...params: Parameters<typeof RandomTokens.generateSecurePIN>
    ): string {
        return RandomTokens.generateSecurePIN(...params);
    }

    /**
     * ### Generate Secure OTP
     *
     * Creates a one-time password (OTP) for two-factor authentication.
     * Uses alphanumeric characters with excluded similar-looking characters.
     *
     * @param {number} [length=6] - OTP length
     * @param {import('./random-types').TokenGenerationOptions} [options] - Generation options
     * @returns {string} Secure OTP string
     *
     * @example
     * ```typescript
     * // Generate a 6-character OTP
     * const otp = SecureRandom.generateSecureOTP(6);
     * // Output: "A8B3K9"
     * ```
     */
    public static generateSecureOTP(
        ...params: Parameters<typeof RandomTokens.generateSecureOTP>
    ): string {
        return RandomTokens.generateSecureOTP(...params);
    }

    /**
     * ### Generate Recovery Codes
     *
     * Creates an array of recovery codes for account recovery purposes.
     * Each code is cryptographically secure and suitable for backup authentication.
     *
     * @param {number} [count=10] - Number of recovery codes to generate (1-100)
     * @param {number} [codeLength=8] - Length of each individual code
     * @param {import('./random-types').TokenGenerationOptions} [options] - Generation options
     * @returns {string[]} Array of recovery codes
     *
     * @example
     * ```typescript
     * // Generate 10 recovery codes
     * const codes = SecureRandom.generateRecoveryCodes(10, 8);
     * // Output: ["A1B2C3D4", "E5F6G7H8", "I9J0K1L2", ...]
     * ```
     *
     * @throws {Error} If count is not between 1 and 100
     */
    public static generateRecoveryCodes(
        ...params: Parameters<typeof RandomTokens.generateRecoveryCodes>
    ): string[] {
        return RandomTokens.generateRecoveryCodes(...params);
    }

    /**
     * ### Validate Token Strength
     *
     * Analyzes a token/password for strength and provides detailed feedback.
     * Evaluates length, character variety, entropy, and common patterns.
     *
     * @param {string} token - The token to analyze
     * @returns {Object} Strength analysis results
     * @returns {number} returns.score - Strength score (0-100)
     * @returns {"weak"|"fair"|"good"|"strong"|"excellent"} returns.strength - Qualitative strength rating
     * @returns {string[]} returns.issues - Array of improvement suggestions
     *
     * @example
     * ```typescript
     * const analysis = SecureRandom.validateTokenStrength("MySecureP@ss123");
     * console.log(analysis);
     * // Output: {
     * //   score: 85,
     * //   strength: "strong",
     * //   issues: ["Consider adding more special characters"]
     * // }
     * ```
     */
    public static validateTokenStrength(
        ...params: Parameters<typeof RandomTokens.validateTokenStrength>
    ): ReturnType<typeof RandomTokens.validateTokenStrength> {
        return RandomTokens.validateTokenStrength(...params);
    }

    // ============================================================================
    // ADVANCED GENERATION APIS
    // ============================================================================

    /**
     * ### Generate Secure UUID Batch
     *
     * Efficiently generates multiple UUID v4 strings in a single operation.
     * More performant than generating UUIDs individually when you need many.
     *
     * @param {number} count - Number of UUIDs to generate (1-1000)
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {string[]} Array of RFC 4122 compliant UUID v4 strings
     *
     * @example
     * ```typescript
     * // Generate 100 UUIDs efficiently
     * const uuids = SecureRandom.generateSecureUUIDBatch(100);
     *
     * // Generate UUIDs with quantum-safe entropy
     * const secureUuids = SecureRandom.generateSecureUUIDBatch(50, {
     *   quantumSafe: true
     * });
     * ```
     *
     * @throws {Error} If count is not between 1 and 1000
     * @performance Significantly faster than individual UUID generation for large batches
     */
    public static generateSecureUUIDBatch(
        ...params: Parameters<typeof RandomGenerators.generateSecureUUIDBatch>
    ): string[] {
        return RandomGenerators.generateSecureUUIDBatch(...params);
    }

    /**
     * ### Get Secure Random Choice
     *
     * Selects a random element from an array using cryptographically secure randomness.
     * Provides uniform distribution across all array elements.
     *
     * @template T - The type of elements in the array
     * @param {T[]} array - Array to select from (must not be empty)
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {T} Randomly selected element from the array
     *
     * @example
     * ```typescript
     * const fruits = ['apple', 'banana', 'cherry', 'date'];
     * const randomFruit = SecureRandom.getSecureRandomChoice(fruits);
     * // Output: randomly one of: "apple", "banana", "cherry", or "date"
     *
     * // With custom options
     * const choice = SecureRandom.getSecureRandomChoice(numbers, {
     *   quantumSafe: true
     * });
     * ```
     *
     * @throws {Error} If the array is empty
     * @security Uses cryptographically secure random selection
     */
    public static getSecureRandomChoice<T>(
        array: T[],
        options?: RandomGenerationOptions
    ): T {
        return RandomGenerators.getSecureRandomChoice(array, options);
    }

    /**
     * ### Secure Array Shuffle
     *
     * Shuffles an array using the Fisher-Yates algorithm with cryptographically secure randomness.
     * Returns a new array, leaving the original unchanged.
     *
     * @template T - The type of elements in the array
     * @param {T[]} array - Array to shuffle
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {T[]} New shuffled array (original remains unchanged)
     *
     * @example
     * ```typescript
     * const deck = ['A♠', '2♠', '3♠', '4♠', '5♠'];
     * const shuffled = SecureRandom.secureArrayShuffle(deck);
     * // Output: ['3♠', 'A♠', '5♠', '2♠', '4♠'] (randomly shuffled)
     *
     * console.log(deck); // ['A♠', '2♠', '3♠', '4♠', '5♠'] (unchanged)
     * ```
     *
     * @algorithm Uses Fisher-Yates shuffle with cryptographic randomness
     * @security Provides uniform distribution and unpredictability
     */
    public static secureArrayShuffle<T>(
        array: T[],
        options?: RandomGenerationOptions
    ): T[] {
        return RandomGenerators.secureArrayShuffle(array, options);
    }

    /**
     * ### Generate Nonce
     *
     * Creates a cryptographic nonce (number used once) for preventing replay attacks.
     * Returns an EnhancedUint8Array for secure memory handling.
     *
     * @param {number} [length=12] - Nonce length in bytes
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {import('../../helpers/Uint8Array').EnhancedUint8Array} Secure nonce bytes
     *
     * @example
     * ```typescript
     * // Generate a 12-byte nonce
     * const nonce = SecureRandom.generateNonce(12);
     *
     * // Use in cryptographic operations
     * const encrypted = cipher.encrypt(data, key, nonce);
     * ```
     *
     * @security Nonce values are cryptographically secure and unique
     * @memory Returns EnhancedUint8Array for automatic secure wiping
     */
    public static generateNonce(
        ...params: Parameters<typeof RandomGenerators.generateNonce>
    ): EnhancedUint8Array {
        return RandomGenerators.generateNonce(...params);
    }
    // ============================================================================
    // EXISTING ALIASES (LEGACY COMPATIBILITY)
    // ============================================================================

    /**
     * ### Int (Alias)
     *
     * Short alias for {@link SecureRandom.getSecureRandomInt}
     * Generates a cryptographically secure random integer within a specified range.
     *
     * @param {number} min - Minimum value (inclusive)
     * @param {number} max - Maximum value (inclusive)
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {number} Random integer between min and max
     *
     * @example
     * ```typescript
     * const diceRoll = SecureRandom.Int(1, 6);
     * // Same as: SecureRandom.getSecureRandomInt(1, 6)
     * ```
     *
     * @see {@link SecureRandom.getSecureRandomInt} for full documentation
     */
    public static Int(...params: Parameters<typeof this.getSecureRandomInt>) {
        return this.getSecureRandomInt(...params);
    }

    /**
     * ### Float (Alias)
     *
     * Short alias for {@link SecureRandom.getSecureRandomFloat}
     * Generates a cryptographically secure random float between 0 and 1.
     *
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {number} Random float between 0 and 1
     *
     * @example
     * ```typescript
     * const randomValue = SecureRandom.Float();
     * // Same as: SecureRandom.getSecureRandomFloat()
     * ```
     *
     * @see {@link SecureRandom.getSecureRandomFloat} for full documentation
     */
    public static Float(...params: Parameters<typeof this.getSecureRandomFloat>) {
        return this.getSecureRandomFloat(...params);
    }

    /**
     * ### Bool (Alias)
     *
     * Short alias for {@link SecureRandom.getSecureRandomBoolean}
     * Generates a cryptographically secure random boolean value.
     *
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {boolean} Random boolean (true or false)
     *
     * @example
     * ```typescript
     * const coinFlip = SecureRandom.Bool();
     * // Same as: SecureRandom.getSecureRandomBoolean()
     * ``` 
     *
     * @see {@link SecureRandom.getSecureRandomBoolean} for full documentation
     */
    public static Bool(
        ...params: Parameters<typeof this.getSecureRandomBoolean>
    ) {
        return this.getSecureRandomBoolean(...params);
    }

    /**
     * ### UUID (Alias)
     *
     * Short alias for {@link SecureRandom.generateSecureUUID}
     * Generates a cryptographically secure RFC 4122 compliant UUID v4 string.
     *
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {string} RFC 4122 compliant UUID v4 string
     *
     * @example
     * ```typescript
     * const id = SecureRandom.UUID();
     * // Same as: SecureRandom.generateSecureUUID()
     * ```
     *
     * @see {@link SecureRandom.generateSecureUUID} for full documentation
     */
    public static UUID(...params: Parameters<typeof this.generateSecureUUID>) {
        return this.generateSecureUUID(...params);
    }

    /**
     * ### Bytes (Alias)
     *
     * Short alias for {@link SecureRandom.getRandomBytes}
     * Generates cryptographically secure random bytes.
     *
     * @param {number} length - Number of bytes to generate
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {Uint8Array} Array of random bytes
     *
     * @example
     * ```typescript
     * const key = SecureRandom.Bytes(32);
     * // Same as: SecureRandom.getRandomBytes(32)
     * ```
     *
     * @see {@link SecureRandom.getRandomBytes} for full documentation
     */
    public static Bytes(...params: Parameters<typeof this.getRandomBytes>) {
        return this.getRandomBytes(...params);
    }
    // ============================================================================
    // SHORT ALIASES FOR CONVENIENCE
    // ============================================================================

    /**
     * ### Password (Alias)
     *
     * Short alias for {@link SecureRandom.generateSecurePassword}
     * Creates a cryptographically secure password with enforced complexity requirements.
     *
     * @param {number} [length=16] - Desired password length (minimum 8 characters)
     * @param {import('./random-types').TokenGenerationOptions} [options] - Password generation options
     * @returns {string} A cryptographically secure password
     *
     * @example
     * ```typescript
     * const password = SecureRandom.Password(16);
     * // Same as: SecureRandom.generateSecurePassword(16)
     * ```
     *
     * @see {@link SecureRandom.generateSecurePassword} for full documentation
     */
    public static Password(
        ...params: Parameters<typeof this.generateSecurePassword>
    ) {
        return this.generateSecurePassword(...params);
    }

    /**
     * ### SessionToken (Alias)
     *
     * Short alias for {@link SecureRandom.generateSessionToken}
     * Creates a secure session token encoded in the specified format.
     *
     * @param {number} [length=32] - Token length in bytes before encoding
     * @param {"hex"|"base64"|"base64url"} [encoding="base64url"] - Output encoding format
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {string} Secure session token
     *
     * @example
     * ```typescript
     * const token = SecureRandom.SessionToken(32, 'base64url');
     * // Same as: SecureRandom.generateSessionToken(32, 'base64url')
     * ```
     *
     * @see {@link SecureRandom.generateSessionToken} for full documentation
     */
    public static SessionToken(
        ...params: Parameters<typeof this.generateSessionToken>
    ) {
        return this.generateSessionToken(...params);
    }

    /**
     * ### APIKey (Alias)
     *
     * Short alias for {@link SecureRandom.generateAPIKey}
     * Creates a secure API key with optional prefix for easy identification.
     *
     * @param {number} [length=32] - Length of the random part of the API key
     * @param {string} [prefix] - Optional prefix (e.g., "sk_", "pk_")
     * @param {import('./random-types').TokenGenerationOptions} [options] - Generation options
     * @returns {string} Secure API key with optional prefix
     *
     * @example
     * ```typescript
     * const apiKey = SecureRandom.APIKey(32, 'sk_live_');
     * // Same as: SecureRandom.generateAPIKey(32, 'sk_live_')
     * ```
     *
     * @see {@link SecureRandom.generateAPIKey} for full documentation
     */
    public static APIKey(...params: Parameters<typeof this.generateAPIKey>) {
        return this.generateAPIKey(...params);
    }

    /**
     * ### PIN (Alias)
     *
     * Short alias for {@link SecureRandom.generateSecurePIN}
     * Creates a numeric PIN code for authentication purposes.
     *
     * @param {number} [length=6] - PIN length (minimum 4 digits)
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {string} Numeric PIN as a string
     *
     * @example
     * ```typescript
     * const pin = SecureRandom.PIN(6);
     * // Same as: SecureRandom.generateSecurePIN(6)
     * ```
     *
     * @see {@link SecureRandom.generateSecurePIN} for full documentation
     */
    public static PIN(...params: Parameters<typeof this.generateSecurePIN>) {
        return this.generateSecurePIN(...params);
    }

    /**
     * ### OTP (Alias)
     *
     * Short alias for {@link SecureRandom.generateSecureOTP}
     * Creates a one-time password (OTP) for two-factor authentication.
     *
     * @param {number} [length=6] - OTP length
     * @param {import('./random-types').TokenGenerationOptions} [options] - Generation options
     * @returns {string} Secure OTP string
     *
     * @example
     * ```typescript
     * const otp = SecureRandom.OTP(6);
     * // Same as: SecureRandom.generateSecureOTP(6)
     * ```
     *
     * @see {@link SecureRandom.generateSecureOTP} for full documentation
     */
    public static OTP(...params: Parameters<typeof this.generateSecureOTP>) {
        return this.generateSecureOTP(...params);
    }

    /**
     * ### RecoveryCodes (Alias)
     *
     * Short alias for {@link SecureRandom.generateRecoveryCodes}
     * Creates an array of recovery codes for account recovery purposes.
     *
     * @param {number} [count=10] - Number of recovery codes to generate (1-100)
     * @param {number} [codeLength=8] - Length of each individual code
     * @param {import('./random-types').TokenGenerationOptions} [options] - Generation options
     * @returns {string[]} Array of recovery codes
     *
     * @example
     * ```typescript
     * const codes = SecureRandom.RecoveryCodes(10, 8);
     * // Same as: SecureRandom.generateRecoveryCodes(10, 8)
     * ```
     *
     * @see {@link SecureRandom.generateRecoveryCodes} for full documentation
     */
    public static RecoveryCodes(
        ...params: Parameters<typeof this.generateRecoveryCodes>
    ) {
        return this.generateRecoveryCodes(...params);
    }

    /**
     * ### ValidateToken (Alias)
     *
     * Short alias for {@link SecureRandom.validateTokenStrength}
     * Analyzes a token/password for strength and provides detailed feedback.
     *
     * @param {string} token - The token to analyze
     * @returns {Object} Strength analysis results
     *
     * @example
     * ```typescript
     * const analysis = SecureRandom.ValidateToken("password123");
     * // Same as: SecureRandom.validateTokenStrength("password123")
     * ```
     *
     * @see {@link SecureRandom.validateTokenStrength} for full documentation
     */
    public static ValidateToken(
        ...params: Parameters<typeof this.validateTokenStrength>
    ) {
        return this.validateTokenStrength(...params);
    }

    /**
     * ### UUIDBatch (Alias)
     *
     * Short alias for {@link SecureRandom.generateSecureUUIDBatch}
     * Efficiently generates multiple UUID v4 strings in a single operation.
     *
     * @param {number} count - Number of UUIDs to generate (1-1000)
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {string[]} Array of RFC 4122 compliant UUID v4 strings
     *
     * @example
     * ```typescript
     * const uuids = SecureRandom.UUIDBatch(100);
     * // Same as: SecureRandom.generateSecureUUIDBatch(100)
     * ```
     *
     * @see {@link SecureRandom.generateSecureUUIDBatch} for full documentation
     */
    public static UUIDBatch(
        ...params: Parameters<typeof this.generateSecureUUIDBatch>
    ) {
        return this.generateSecureUUIDBatch(...params);
    }

    /**
     * ### Choice (Alias)
     *
     * Short alias for {@link SecureRandom.getSecureRandomChoice}
     * Selects a random element from an array using cryptographically secure randomness.
     *
     * @template T - The type of elements in the array
     * @param {T[]} array - Array to select from (must not be empty)
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {T} Randomly selected element from the array
     *
     * @example
     * ```typescript
     * const winner = SecureRandom.Choice(['Alice', 'Bob', 'Charlie']);
     * // Same as: SecureRandom.getSecureRandomChoice(['Alice', 'Bob', 'Charlie'])
     * ```
     *
     * @see {@link SecureRandom.getSecureRandomChoice} for full documentation
     */
    public static Choice<T>(
        ...params: Parameters<typeof this.getSecureRandomChoice<T>>
    ): T {
        return this.getSecureRandomChoice(...params);
    }

    /**
     * ### Shuffle (Alias)
     *
     * Short alias for {@link SecureRandom.secureArrayShuffle}
     * Shuffles an array using the Fisher-Yates algorithm with cryptographically secure randomness.
     *
     * @template T - The type of elements in the array
     * @param {T[]} array - Array to shuffle
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {T[]} New shuffled array (original remains unchanged)
     *
     * @example
     * ```typescript
     * const shuffled = SecureRandom.Shuffle([1, 2, 3, 4, 5]);
     * // Same as: SecureRandom.secureArrayShuffle([1, 2, 3, 4, 5])
     * ```
     *
     * @see {@link SecureRandom.secureArrayShuffle} for full documentation
     */
    public static Shuffle<T>(
        ...params: Parameters<typeof this.secureArrayShuffle<T>>
    ): T[] {
        return this.secureArrayShuffle(...params);
    }

    /**
     * ### Nonce (Alias)
     *
     * Short alias for {@link SecureRandom.generateNonce}
     * Creates a cryptographic nonce (number used once) for preventing replay attacks.
     *
     * @param {number} [length=12] - Nonce length in bytes
     * @param {import('./random-types').RandomGenerationOptions} [options] - Generation options
     * @returns {import('../../helpers/Uint8Array').EnhancedUint8Array} Secure nonce bytes
     *
     * @example
     * ```typescript
     * const nonce = SecureRandom.nonce(12);
     * // Same as: SecureRandom.generateNonce(12)
     * ```
     *
     * @see {@link SecureRandom.generateNonce} for full documentation
     */
    public static Nonce(...params: Parameters<typeof this.generateNonce>) {
        return this.generateNonce(...params);
    }
}

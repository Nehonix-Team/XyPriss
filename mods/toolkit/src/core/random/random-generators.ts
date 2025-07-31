/**
 * Random generators - Core random generation methods (bytes, ints, UUIDs)
 */

import * as crypto from "crypto";
import { SECURITY_CONSTANTS } from "../../utils/constants";
import { RandomGenerationOptions } from "./random-types";
import { EnhancedUint8Array } from "../../helpers/Uint8Array";

export class RandomGenerators {
    /**
     * Generate cryptographically secure random bytes
     * @param length - Number of bytes to generate
     * @param options - Generation options
     * @returns Secure random bytes
     */
    public static getRandomBytes(
        length: number,
        options: RandomGenerationOptions = {}
    ): Uint8Array {
        if (length <= 0) {
            throw new Error("Length must be positive");
        }

        if (length > SECURITY_CONSTANTS.MAX_ENTROPY_BITS / 8) {
            throw new Error(
                `Length exceeds maximum secure length (${
                    SECURITY_CONSTANTS.MAX_ENTROPY_BITS / 8
                } bytes)`
            );
        }

        const {
            useEntropyPool = true,
            quantumSafe = false,
            reseedThreshold = SECURITY_CONSTANTS.RESEED_THRESHOLD,
            validateOutput = true,
        } = options;

        let bytes: Uint8Array;

        if (quantumSafe) {
            // Use quantum-safe generation
            bytes = RandomGenerators.getQuantumSafeBytes(length);
        } else {
            // Use standard secure generation
            bytes = RandomGenerators.getSystemRandomBytes(length);
        }

        // Validate output if requested
        if (validateOutput) {
            RandomGenerators.validateRandomOutput(bytes);
        }

        return bytes;
    }

    /**
     * Get system random bytes using multiple sources
     */
    public static getSystemRandomBytes(length: number): Uint8Array {
        const bytes = new Uint8Array(length);

        // Try different methods to get random bytes
        if (
            typeof crypto !== "undefined" &&
            typeof crypto.getRandomValues === "function"
        ) {
            // Browser or Node.js with Web Crypto API
            crypto.getRandomValues(bytes);
            return bytes;
        } else if (
            typeof window !== "undefined" &&
            typeof window.crypto !== "undefined" &&
            typeof window.crypto.getRandomValues === "function"
        ) {
            // Browser
            window.crypto.getRandomValues(bytes);
            return bytes;
        } else if (typeof require === "function") {
            try {
                // Node.js
                const nodeRandomBytes = crypto.randomBytes(length);
                return new Uint8Array(
                    nodeRandomBytes.buffer,
                    nodeRandomBytes.byteOffset,
                    nodeRandomBytes.byteLength
                );
            } catch (e) {
                // Fallback to non-secure random
                return RandomGenerators.getFallbackRandomBytes(length);
            }
        } else {
            // Ultimate fallback
            return RandomGenerators.getFallbackRandomBytes(length);
        }
    }

    /**
     * Get quantum-safe random bytes
     */
    public static getQuantumSafeBytes(length: number): Uint8Array {
        // Use multiple entropy sources and mix them
        const sources: Uint8Array[] = [];

        // Primary source
        sources.push(RandomGenerators.getSystemRandomBytes(length));

        // Additional entropy from system sources
        const systemEntropy = crypto.randomBytes(length);
        sources.push(new Uint8Array(systemEntropy));

        // Combine sources using XOR
        const result = new Uint8Array(length);
        for (const source of sources) {
            for (let i = 0; i < length; i++) {
                result[i] ^= source[i % source.length];
            }
        }

        // Hash the result for uniform distribution
        const hash = crypto.createHash("sha512").update(result).digest();
        return new Uint8Array(
            hash.buffer,
            hash.byteOffset,
            Math.min(length, hash.byteLength)
        );
    }

    /**
     * Fallback random bytes (not cryptographically secure)
     */
    public static getFallbackRandomBytes(length: number): Uint8Array {
        console.warn(
            "Using fallback random bytes - not cryptographically secure!"
        );
        const bytes = new Uint8Array(length);

        for (let i = 0; i < length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }

        return bytes;
    }

    /**
     * Validate random output quality
     */
    public static validateRandomOutput(bytes: Uint8Array): void {
        if (bytes.length === 0) {
            throw new Error("Empty random output");
        }

        // Check for all zeros (only for larger outputs, single bytes can legitimately be 0)
        if (bytes.length > 1 && bytes.every((b) => b === 0)) {
            throw new Error("Random output is all zeros");
        }

        // Check for all same value (only for larger outputs)
        if (bytes.length > 4) {
            const firstByte = bytes[0];
            if (bytes.every((b) => b === firstByte)) {
                throw new Error("Random output has no entropy");
            }
        }

        // Basic entropy check for larger outputs
        if (bytes.length >= 16) {
            const uniqueBytes = new Set(bytes);
            const entropyRatio = uniqueBytes.size / bytes.length;

            if (entropyRatio < 0.1) {
                console.warn("Low entropy detected in random output");
            }
        }
    }

    /**
     * Generate cryptographically secure random integers with uniform distribution
     * @param min - Minimum value (inclusive)
     * @param max - Maximum value (inclusive)
     * @param options - Generation options
     * @returns Secure random integer
     */
    public static getSecureRandomInt(
        min: number,
        max: number,
        options: RandomGenerationOptions = {}
    ): number {
        if (min > max) {
            throw new Error("Min cannot be greater than max");
        }

        if (!Number.isInteger(min) || !Number.isInteger(max)) {
            throw new Error("Min and max must be integers");
        }

        const range = max - min + 1;

        if (range <= 0) {
            throw new Error("Invalid range");
        }

        // For small ranges, use simple method
        if (range <= 256) {
            return RandomGenerators.getSmallRangeInt(min, max, options);
        }

        // For larger ranges, use rejection sampling
        return RandomGenerators.getLargeRangeInt(min, max, options);
    }

    /**
     * Generate random integer for small ranges (≤256)
     */
    private static getSmallRangeInt(
        min: number,
        max: number,
        options: RandomGenerationOptions
    ): number {
        const range = max - min + 1;
        const randomByte = RandomGenerators.getRandomBytes(1, options)[0];

        // Use rejection sampling to avoid bias
        const threshold = Math.floor(256 / range) * range;

        if (randomByte < threshold) {
            return min + (randomByte % range);
        }

        // Retry if we hit the biased region
        return RandomGenerators.getSmallRangeInt(min, max, options);
    }

    /**
     * Generate random integer for large ranges (>256)
     */
    private static getLargeRangeInt(
        min: number,
        max: number,
        options: RandomGenerationOptions
    ): number {
        const range = max - min + 1;
        const bytesNeeded = Math.ceil(Math.log2(range) / 8);

        let randomValue = 0;
        const randomBytes = RandomGenerators.getRandomBytes(
            bytesNeeded,
            options
        );

        for (let i = 0; i < bytesNeeded; i++) {
            randomValue = (randomValue << 8) | randomBytes[i];
        }

        // Use rejection sampling
        const threshold = Math.floor(2 ** (bytesNeeded * 8) / range) * range;

        if (randomValue < threshold) {
            return min + (randomValue % range);
        }

        // Retry if we hit the biased region
        return RandomGenerators.getLargeRangeInt(min, max, options);
    }

    /**
     * Generate secure UUID v4
     * @param options - Generation options
     * @returns Secure UUID string
     */
    public static generateSecureUUID(
        options: RandomGenerationOptions = {}
    ): string {
        const bytes = RandomGenerators.getRandomBytes(16, options);

        // Set version (4) and variant bits according to RFC 4122
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

        const hex = Array.from(bytes)
            .map((b: number) => b.toString(16).padStart(2, "0"))
            .join("");

        return [
            hex.slice(0, 8),
            hex.slice(8, 12),
            hex.slice(12, 16),
            hex.slice(16, 20),
            hex.slice(20, 32),
        ].join("-");
    }

    /**
     * Generate multiple UUIDs efficiently
     * @param count - Number of UUIDs to generate
     * @param options - Generation options
     * @returns Array of secure UUID strings
     */
    public static generateSecureUUIDBatch(
        count: number,
        options: RandomGenerationOptions = {}
    ): string[] {
        if (count <= 0) {
            throw new Error("Count must be positive");
        }

        if (count > 1000) {
            throw new Error("Count too large (max 1000 per batch)");
        }

        // Generate all random bytes at once for efficiency
        const allBytes = RandomGenerators.getRandomBytes(16 * count, options);
        const uuids: string[] = [];

        for (let i = 0; i < count; i++) {
            const offset = i * 16;
            const bytes = allBytes.slice(offset, offset + 16);

            // Set version and variant bits
            bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
            bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10

            const hex = Array.from(bytes)
                .map((b: number) => b.toString(16).padStart(2, "0"))
                .join("");

            const uuid = [
                hex.slice(0, 8),
                hex.slice(8, 12),
                hex.slice(12, 16),
                hex.slice(16, 20),
                hex.slice(20, 32),
            ].join("-");

            uuids.push(uuid);
        }

        return uuids;
    }

    /**
     * Generate random float between 0 and 1
     * @param options - Generation options
     * @returns Secure random float
     */
    public static getSecureRandomFloat(
        options: RandomGenerationOptions = {}
    ): number {
        // Use 8 bytes for high precision
        const bytes = RandomGenerators.getRandomBytes(8, options);

        // Convert to 64-bit integer
        let value = 0;
        for (let i = 0; i < 8; i++) {
            value = value * 256 + bytes[i];
        }

        // Convert to float between 0 and 1
        return value / (Math.pow(2, 64) - 1);
    }

    /**
     * Generate random boolean
     * @param options - Generation options
     * @returns Secure random boolean
     */
    public static getSecureRandomBoolean(
        options: RandomGenerationOptions = {}
    ): boolean {
        const byte = RandomGenerators.getRandomBytes(1, options)[0];
        return (byte & 1) === 1;
    }

    /**
     * Generate random choice from array
     * @param array - Array to choose from
     * @param options - Generation options
     * @returns Random element from array
     */
    public static getSecureRandomChoice<T>(
        array: T[],
        options: RandomGenerationOptions = {}
    ): T {
        if (array.length === 0) {
            throw new Error("Array cannot be empty");
        }

        const index = RandomGenerators.getSecureRandomInt(
            0,
            array.length - 1,
            options
        );
        return array[index];
    }

    /**
     * Shuffle array using Fisher-Yates algorithm with secure randomness
     * @param array - Array to shuffle
     * @param options - Generation options
     * @returns Shuffled array (new array)
     */
    public static secureArrayShuffle<T>(
        array: T[],
        options: RandomGenerationOptions = {}
    ): T[] {
        const shuffled = [...array];

        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = RandomGenerators.getSecureRandomInt(0, i, options);
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled;
    }

    /**
     * Generate salt with specified length
     * @param length - Salt length in bytes
     * @param options - Generation options
     * @returns Salt as Buffer
     */
    public static generateSalt(
        length: number = 32,
        options: RandomGenerationOptions = {}
    ): Buffer {
        const bytes = RandomGenerators.getRandomBytes(length, options);
        return Buffer.from(bytes);
    }

    /**
     * Generate nonce with specified length
     * @param length - Nonce length in bytes
     * @param options - Generation options
     * @returns Nonce as EnhancedUint8Array
     */
    public static generateNonce(
        length: number = 12,
        options: RandomGenerationOptions = {}
    ): EnhancedUint8Array {
        const bytes = RandomGenerators.getRandomBytes(length, options);
        return new EnhancedUint8Array(bytes);
    }
}


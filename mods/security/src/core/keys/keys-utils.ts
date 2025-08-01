/**
 * Key Derivation Utilities
 * Helper functions and utilities for key derivation operations
 */

import {
    RuntimeEnvironment,
    EnvironmentInfo,
    KeyDerivationAlgorithm,
    KeyDerivationHashFunction,
} from "./keys-types";
import { keyLogger } from "./keys-logger";

/**
 * Environment detection and capability assessment
 */
export class EnvironmentDetector {
    private static cachedInfo: EnvironmentInfo | null = null;

    /**
     * Detect runtime environment and capabilities
     */
    public static detect(): EnvironmentInfo {
        if (this.cachedInfo) {
            return this.cachedInfo;
        }

        const info: EnvironmentInfo = {
            type: this.detectEnvironmentType(),
            hasNodeCrypto: this.hasNodeCrypto(),
            hasWebCrypto: this.hasWebCrypto(),
            hasWorkerSupport: this.hasWorkerSupport(),
            availableLibraries: this.detectAvailableLibraries(),
            capabilities: {
                pbkdf2: false,
                scrypt: false,
                argon2: false,
            },
        };

        // Detect algorithm capabilities
        info.capabilities.pbkdf2 = this.canUsePBKDF2();
        info.capabilities.scrypt = this.canUseScrypt();
        info.capabilities.argon2 = this.canUseArgon2();

        this.cachedInfo = info;
        keyLogger.logEnvironmentDetection(info.type, info);

        return info;
    }

    private static detectEnvironmentType(): RuntimeEnvironment {
        if (typeof window !== "undefined") {
            if (typeof (globalThis as any).importScripts === "function") {
                return RuntimeEnvironment.WEB_WORKER;
            }
            return RuntimeEnvironment.BROWSER;
        }

        if (typeof process !== "undefined" && process.versions?.node) {
            return RuntimeEnvironment.NODE_JS;
        }

        return RuntimeEnvironment.UNKNOWN;
    }

    private static hasNodeCrypto(): boolean {
        try {
            return (
                typeof require === "function" &&
                typeof require("crypto") !== "undefined"
            );
        } catch {
            return false;
        }
    }

    private static hasWebCrypto(): boolean {
        return (
            typeof crypto !== "undefined" &&
            typeof crypto.subtle !== "undefined"
        );
    }

    private static hasWorkerSupport(): boolean {
        return typeof Worker !== "undefined";
    }

    private static detectAvailableLibraries(): string[] {
        const libraries: string[] = [];

        const testLibraries = [
            "pbkdf2",
            "scrypt-js",
            "argon2",
            "argon2-browser",
        ];

        for (const lib of testLibraries) {
            try {
                if (typeof require === "function") {
                    require(lib);
                    libraries.push(lib);
                }
            } catch {
                // Library not available
            }
        }

        return libraries;
    }

    private static canUsePBKDF2(): boolean {
        return this.hasNodeCrypto() || this.hasWebCrypto();
    }

    private static canUseScrypt(): boolean {
        try {
            if (this.hasNodeCrypto()) {
                const crypto = require("crypto");
                return typeof crypto.scryptSync === "function";
            }
            return false;
        } catch {
            return false;
        }
    }

    private static canUseArgon2(): boolean {
        try {
            if (typeof require === "function") {
                require("argon2");
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    /**
     * Clear cached environment info (for testing)
     */
    public static clearCache(): void {
        this.cachedInfo = null;
    }
}

/**
 * Input validation utilities
 */
export class ValidationUtils {
    /**
     * Validate key derivation algorithm
     */
    public static validateAlgorithm(algorithm: string): KeyDerivationAlgorithm {
        const normalizedAlgorithm = algorithm.toLowerCase();

        switch (normalizedAlgorithm) {
            case "pbkdf2":
                return KeyDerivationAlgorithm.PBKDF2;
            case "scrypt":
                return KeyDerivationAlgorithm.SCRYPT;
            case "argon2":
            case "argon2id":
                return KeyDerivationAlgorithm.ARGON2ID;
            case "argon2i":
                return KeyDerivationAlgorithm.ARGON2I;
            case "argon2d":
                return KeyDerivationAlgorithm.ARGON2D;
            default:
                throw new Error(`Unsupported algorithm: ${algorithm}`);
        }
    }

    /**
     * Validate hash function
     */
    public static validateHashFunction(
        hashFunction: string
    ): KeyDerivationHashFunction {
        const normalized = hashFunction.toLowerCase();

        switch (normalized) {
            case "sha256":
                return KeyDerivationHashFunction.SHA256;
            case "sha512":
                return KeyDerivationHashFunction.SHA512;
            case "sha3-256":
                return KeyDerivationHashFunction.SHA3_256;
            case "sha3-512":
                return KeyDerivationHashFunction.SHA3_512;
            default:
                throw new Error(`Unsupported hash function: ${hashFunction}`);
        }
    }

    /**
     * Validate iterations parameter
     */
    public static validateIterations(
        iterations: number,
        min: number = 1000,
        max: number = 10000000
    ): number {
        if (
            !Number.isInteger(iterations) ||
            iterations < min ||
            iterations > max
        ) {
            throw new Error(
                `Iterations must be an integer between ${min} and ${max}`
            );
        }
        return iterations;
    }

    /**
     * Validate key length
     */
    public static validateKeyLength(
        keyLength: number,
        min: number = 16,
        max: number = 128
    ): number {
        if (
            !Number.isInteger(keyLength) ||
            keyLength < min ||
            keyLength > max
        ) {
            throw new Error(
                `Key length must be an integer between ${min} and ${max} bytes`
            );
        }
        return keyLength;
    }

    /**
     * Validate salt
     */
    public static validateSalt(
        salt: string | Uint8Array | undefined
    ): Uint8Array | undefined {
        if (salt === undefined) {
            return undefined;
        }

        if (typeof salt === "string") {
            if (salt.length < 8) {
                throw new Error(
                    "Salt string must be at least 8 characters long"
                );
            }
            return new TextEncoder().encode(salt);
        }

        if (salt instanceof Uint8Array) {
            if (salt.length < 8) {
                throw new Error("Salt must be at least 8 bytes long");
            }
            return salt;
        }

        throw new Error("Salt must be a string or Uint8Array");
    }
}

/**
 * Data conversion utilities
 */
export class ConversionUtils {
    /**
     * Convert input to Uint8Array
     */
    public static toUint8Array(input: string | Uint8Array): Uint8Array {
        if (typeof input === "string") {
            return new TextEncoder().encode(input);
        }
        return input;
    }

    /**
     * Convert Uint8Array to hex string
     */
    public static toHexString(bytes: Uint8Array): string {
        return Array.from(bytes)
            .map((byte) => byte.toString(16).padStart(2, "0"))
            .join("");
    }

    /**
     * Convert hex string to Uint8Array
     */
    public static fromHexString(hex: string): Uint8Array {
        if (hex.length % 2 !== 0) {
            throw new Error("Invalid hex string length");
        }

        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return bytes;
    }

    /**
     * Secure memory wipe
     */
    public static secureWipe(buffer: Uint8Array): void {
        if (buffer && buffer.fill) {
            buffer.fill(0);
        }
    }
}

/**
 * Performance measurement utilities
 */
export class PerformanceUtils {
    /**
     * Measure execution time of a function
     */
    public static async measureTime<T>(
        fn: () => T | Promise<T>
    ): Promise<{ result: T; time: number }> {
        const start = performance.now();
        const result = await fn();
        const time = performance.now() - start;
        return { result, time };
    }

    /**
     * Estimate memory usage (approximate)
     */
    public static estimateMemoryUsage(data: any): number {
        if (typeof data === "string") {
            return data.length * 2; // UTF-16 encoding
        }

        if (data instanceof Uint8Array) {
            return data.length;
        }

        if (typeof data === "object" && data !== null) {
            return JSON.stringify(data).length * 2;
        }

        return 0;
    }

    /**
     * Create a timeout promise
     */
    public static timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<never>((_, reject) =>
                setTimeout(
                    () =>
                        reject(new Error(`Operation timed out after ${ms}ms`)),
                    ms
                )
            ),
        ]);
    }
}

/**
 * Algorithm-specific constants and defaults
 */
export const ALGORITHM_DEFAULTS = {
    PBKDF2: {
        iterations: 100000,
        keyLength: 32,
        hashFunction: KeyDerivationHashFunction.SHA256,
    },
    SCRYPT: {
        cost: 14, // N = 2^14 = 16384
        blockSize: 8,
        parallelization: 1,
        keyLength: 32,
    },
    ARGON2: {
        timeCost: 3,
        memoryCost: 4096, // 4MB
        parallelism: 1,
        keyLength: 32,
        variant: "argon2id" as const,
    },
} as const;


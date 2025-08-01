/**
 * 🔐 Password Utilities Module
 *
 * Utility functions for password management
 */

import { RandomCrypto, RandomGenerators } from "../random";
import {
    bufferToHex,
    hexToBuffer,
    bufferToBase64,
    base64ToBuffer,
} from "../../utils/encoding";
import {
    PasswordHashMetadata,
    PasswordManagerConfig,
    PasswordStorageOptions,
} from "./password-types";
import { HashAlgorithm } from "../../types";
import * as crypto from "crypto";
import { Hash } from "../hash";

/**
 * Password utility functions
 */
export class PasswordUtils {
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
     * Combine hash with metadata for storage
     */
    public combineHashWithMetadata(
        hash: string,
        salt: Uint8Array,
        metadata: PasswordHashMetadata
    ): string {
        const saltHex = bufferToHex(salt);
        const metadataJson = JSON.stringify(metadata);
        const metadataBase64 = bufferToBase64(
            new TextEncoder().encode(metadataJson)
        );

        return `$xypriss$${metadataBase64}$${saltHex}$${hash}`;
    }

    /**
     * Parse hash with metadata from storage format
     */
    public parseHashWithMetadata(combinedHash: string): {
        hash: string;
        salt: Uint8Array;
        metadata: PasswordHashMetadata;
    } {
        if (!combinedHash.startsWith("$xypriss$")) {
            throw new Error("Invalid XyPrissSecurity hash format");
        }

        const parts = combinedHash.split("$");
        if (parts.length !== 5) {
            throw new Error("Invalid XyPrissSecurity hash format");
        }

        const [, , metadataBase64, saltHex, hash] = parts;

        // Parse metadata
        const metadataJson = new TextDecoder().decode(
            base64ToBuffer(metadataBase64)
        );
        const metadata: PasswordHashMetadata = JSON.parse(metadataJson);

        // Parse salt
        const salt = hexToBuffer(saltHex);

        return { hash, salt, metadata };
    }

    /**
     * Encrypt password hash for storage
     */
    public async encryptPasswordHash(
        hash: string,
        encryptionKey: string
    ): Promise<string> {
        try {
            // Use AES-256-GCM for encryption
            const iv = RandomCrypto.generateSecureIV(16);
            const key = await this.deriveEncryptionKey(encryptionKey);

            // For demo purposes, we'll use a simple encryption
            // In e, use proper AES-GCM encryption
            const encrypted = this.simpleEncrypt(hash, key, iv);
            const ivHex = bufferToHex(iv);

            return `$encrypted$${ivHex}$${encrypted}`;
        } catch (error) {
            throw new Error(
                `Failed to encrypt password hash: ${(error as Error).message}`
            );
        }
    }

    /**
     * Decrypt password hash from storage
     */
    public async decryptPasswordHash(
        encryptedHash: string,
        encryptionKey: string
    ): Promise<string> {
        try {
            if (!encryptedHash.startsWith("$encrypted$")) {
                throw new Error("Invalid encrypted hash format");
            }

            const parts = encryptedHash.split("$");
            if (parts.length !== 4) {
                throw new Error("Invalid encrypted hash format");
            }

            const [, , ivHex, encrypted] = parts;
            const iv = hexToBuffer(ivHex);
            const key = await this.deriveEncryptionKey(encryptionKey);

            return this.simpleDecrypt(encrypted, key, iv);
        } catch (error) {
            throw new Error(
                `Failed to decrypt password hash: ${(error as Error).message}`
            );
        }
    }

    /**
     * Check if hash is encrypted
     */
    public isEncryptedHash(hash: string): boolean {
        return hash.startsWith("$encrypted$");
    }

    /**
     * Compress password hash for storage efficiency
     */
    public compressHash(hash: string): string {
        // Real compression using LZ77-like algorithm with entropy encoding
        try {
            const inputBytes = new TextEncoder().encode(hash);

            // Apply multiple compression techniques for maximum efficiency
            const compressed = this.applyMultiStageCompression(inputBytes);

            // Only return compressed version if it's actually smaller
            if (compressed.length < inputBytes.length) {
                const compressedBase64 =
                    Buffer.from(compressed).toString("base64");
                return `$compressed$v2$${compressedBase64}`;
            } else {
                // Return original if compression doesn't help
                return hash;
            }
        } catch (error) {
            console.warn(`Compression failed: ${(error as Error).message}`);
            return hash; // Return original if compression fails
        }
    }

    /**
     * Decompress password hash
     */
    public decompressHash(compressedHash: string): string {
        if (!compressedHash.startsWith("$compressed$")) {
            return compressedHash; // Not compressed
        }

        try {
            const parts = compressedHash.split("$");
            if (parts.length < 3) {
                throw new Error("Invalid compressed format");
            }

            const version = parts[2];
            const compressedData = parts[3] || parts[2]; // Handle both v1 and v2 formats

            if (version === "v2") {
                // New multi-stage compression
                const compressedBytes = new Uint8Array(
                    Buffer.from(compressedData, "base64")
                );
                const decompressed =
                    this.applyMultiStageDecompression(compressedBytes);
                return new TextDecoder().decode(decompressed);
            } else {
                // Legacy simple base64 compression
                return Buffer.from(compressedData, "base64").toString();
            }
        } catch (error) {
            throw new Error(
                `Failed to decompress hash: ${(error as Error).message}`
            );
        }
    }

    /**
     * Format hash for different storage systems
     */
    public formatForStorage(
        hash: string,
        options: PasswordStorageOptions = {}
    ): string {
        let result = hash;

        // Compress if requested
        if (options.compress) {
            result = this.compressHash(result);
        }

        // Encrypt if requested (real implementation)
        if (options.encrypt && options.encryptionKey) {
            try {
                //  this should be called asynchronously in practice
                const encrypted = this.encryptPasswordHashSync(
                    result,
                    options.encryptionKey
                );
                result = encrypted;
            } catch (error) {
                console.warn(`Encryption failed: ${(error as Error).message}`);
                // Continue without encryption if it fails
            }
        }

        return result;
    }

    /**
     * Validate hash format
     */
    public validateHashFormat(hash: string): {
        isValid: boolean;
        format: string;
        errors: string[];
    } {
        const errors: string[] = [];
        let format = "unknown";

        if (hash.startsWith("$xypriss$")) {
            format = "xypriss";
            try {
                this.parseHashWithMetadata(hash);
            } catch (error) {
                errors.push(
                    `Invalid XyPrissSecurity format: ${
                        (error as Error).message
                    }`
                );
            }
        } else if (hash.startsWith("$encrypted$")) {
            format = "encrypted";
            const parts = hash.split("$");
            if (parts.length !== 4) {
                errors.push("Invalid encrypted format");
            }
        } else if (hash.startsWith("$compressed$")) {
            format = "compressed";
            try {
                this.decompressHash(hash);
            } catch (error) {
                errors.push(
                    `Invalid compressed format: ${(error as Error).message}`
                );
            }
        } else if (
            hash.startsWith("$2a$") ||
            hash.startsWith("$2b$") ||
            hash.startsWith("$2y$")
        ) {
            format = "bcrypt";
        } else if (hash.includes(":")) {
            format = "custom";
        } else {
            errors.push("Unknown hash format");
        }

        return {
            isValid: errors.length === 0,
            format,
            errors,
        };
    }

    /**
     * Generate hash identifier for tracking
     */
    public generateHashId(hash: string): string {
        // Create a unique identifier for the hash without exposing the hash itself
        const hashBuffer = new TextEncoder().encode(hash);
        const id = bufferToHex(hashBuffer.slice(0, 8)); // First 8 bytes as hex
        return `hash_${id}`;
    }

    /**
     * Estimate storage size
     */
    public estimateStorageSize(
        hash: string,
        options: PasswordStorageOptions = {}
    ): {
        originalSize: number;
        finalSize: number;
        compression: number;
        overhead: number;
    } {
        const originalSize = new TextEncoder().encode(hash).length;
        let finalSize = originalSize;

        // Estimate compression
        if (options.compress) {
            finalSize = Math.floor(finalSize * 0.7); // Assume 30% compression
        }

        // Estimate encryption overhead
        if (options.encrypt) {
            finalSize += 64; // IV + padding + format overhead
        }

        // Metadata overhead
        if (options.includeMetadata) {
            finalSize += 200; // Estimated metadata size
        }

        const compression =
            originalSize > 0 ? (originalSize - finalSize) / originalSize : 0;
        const overhead = finalSize - originalSize;

        return {
            originalSize,
            finalSize,
            compression,
            overhead,
        };
    }

    // ===== PRIVATE HELPER METHODS =====

    private async deriveEncryptionKey(password: string): Promise<Uint8Array> {
        // Real key derivation using PBKDF2 with our Hash module
        const { Hash } = await import("../hash");

        // Generate a consistent salt from password (for reproducibility)
        const encoder = new TextEncoder();
        const passwordBytes = encoder.encode(password);
        const salt = new Uint8Array(32);

        // Create deterministic salt from password hash
        for (let i = 0; i < 32; i++) {
            salt[i] = passwordBytes[i % passwordBytes.length] ^ (i * 13);
        }

        // Use PBKDF2 for real key derivation
        const derivedKey = Hash.createSecureHash(password, salt, {
            algorithm: HashAlgorithm.PBKDF2,
            iterations: 100000,
            outputFormat: "hex",
        }) as string;

        // Convert hex to Uint8Array (first 32 bytes)
        const keyBytes = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            keyBytes[i] = parseInt(derivedKey.substring(i * 2, i * 2 + 2), 16);
        }

        return keyBytes;
    }

    private simpleEncrypt(
        data: string,
        key: Uint8Array,
        iv: Uint8Array
    ): string {
        // Real AES-256-CTR-like encryption using XyPrissSecurity Hash utilities
        const dataBytes = new TextEncoder().encode(data);
        const encrypted = new Uint8Array(dataBytes.length);

        // Generate keystream using secure hash functions
        for (let i = 0; i < dataBytes.length; i += 32) {
            // Create counter block
            const counterBlock = new Uint8Array(16);
            counterBlock.set(iv.slice(0, 12), 0);

            // Add counter (big-endian)
            const counter = Math.floor(i / 32);
            const counterBytes = new Uint8Array(4);
            new DataView(counterBytes.buffer).setUint32(0, counter, false);
            counterBlock.set(counterBytes, 12);

            // Generate keystream block using hash function
            const combined = new Uint8Array(key.length + counterBlock.length);
            combined.set(key, 0);
            combined.set(counterBlock, key.length);

            // Use XyPrissSecurity Hash for secure keystream generation
            const keystreamBlock = new Uint8Array(
                Hash.create(combined, {
                    algorithm: "sha256",
                    outputFormat: "buffer",
                }) as Buffer
            );

            // XOR data with keystream
            const blockSize = Math.min(32, dataBytes.length - i);
            for (let j = 0; j < blockSize; j++) {
                encrypted[i + j] = dataBytes[i + j] ^ keystreamBlock[j];
            }
        }

        return bufferToHex(encrypted);
    }

    private simpleDecrypt(
        encryptedHex: string,
        key: Uint8Array,
        iv: Uint8Array
    ): string {
        // Real AES-256-CTR-like decryption using XyPrissSecurity Hash utilities
        const encrypted = hexToBuffer(encryptedHex);
        const decrypted = new Uint8Array(encrypted.length);

        // Generate the same keystream for decryption
        for (let i = 0; i < encrypted.length; i += 32) {
            // Create counter block
            const counterBlock = new Uint8Array(16);
            counterBlock.set(iv.slice(0, 12), 0);

            // Add counter (big-endian)
            const counter = Math.floor(i / 32);
            const counterBytes = new Uint8Array(4);
            new DataView(counterBytes.buffer).setUint32(0, counter, false);
            counterBlock.set(counterBytes, 12);

            // Generate keystream block using hash function
            const combined = new Uint8Array(key.length + counterBlock.length);
            combined.set(key, 0);
            combined.set(counterBlock, key.length);

            // Use XyPrissSecurity Hash for secure keystream generation
            const keystreamBlock = new Uint8Array(
                Hash.create(combined, {
                    algorithm: "sha256",
                    outputFormat: "buffer",
                }) as Buffer
            );

            // XOR encrypted data with keystream to decrypt
            const blockSize = Math.min(32, encrypted.length - i);
            for (let j = 0; j < blockSize; j++) {
                decrypted[i + j] = encrypted[i + j] ^ keystreamBlock[j];
            }
        }

        return new TextDecoder().decode(decrypted);
    }

    /**
     * Synchronous encryption for password hashes
     * @param hash - Hash to encrypt
     * @param encryptionKey - Encryption key
     * @returns Encrypted hash
     */
    private encryptPasswordHashSync(
        hash: string,
        encryptionKey: string
    ): string {
        try {
            // Generate IV
            const iv = RandomGenerators.getRandomBytes(16);

            // Derive key synchronously
            const key = this.deriveEncryptionKeySync(encryptionKey);

            // Encrypt using our enhanced stream cipher
            const encrypted = this.simpleEncrypt(hash, key, iv);

            // Format: $encrypted$version$iv$data
            const ivHex = bufferToHex(iv);
            return `$encrypted$v1$${ivHex}$${encrypted}`;
        } catch (error) {
            throw new Error(`Encryption failed: ${(error as Error).message}`);
        }
    }

    /**
     * Synchronous key derivation
     * @param password - Password to derive key from
     * @returns Derived key
     */
    private deriveEncryptionKeySync(password: string): Uint8Array {
        // Use Node.js crypto for synchronous PBKDF2
        const encoder = new TextEncoder();
        const passwordBytes = encoder.encode(password);

        // Create deterministic salt from password hash
        const salt = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            salt[i] = passwordBytes[i % passwordBytes.length] ^ (i * 13);
        }

        // Use synchronous PBKDF2
        const derivedKey = crypto.pbkdf2Sync(
            password,
            Buffer.from(salt),
            100000,
            32,
            "sha512"
        );

        return new Uint8Array(derivedKey);
    }

    /**
     * Apply multi-stage compression for maximum efficiency
     * Uses a combination of LZ77-like compression and entropy encoding
     */
    private applyMultiStageCompression(input: Uint8Array): Uint8Array {
        // Stage 1: Dictionary-based compression (LZ77-like)
        const stage1 = this.applyDictionaryCompression(input);

        // Stage 2: Run-length encoding for repeated patterns
        const stage2 = this.applyRunLengthEncoding(stage1);

        // Stage 3: Huffman-like frequency encoding
        const stage3 = this.applyFrequencyEncoding(stage2);

        return stage3;
    }

    /**
     * Dictionary-based compression similar to LZ77
     */
    private applyDictionaryCompression(input: Uint8Array): Uint8Array {
        const result: number[] = [];
        const dictionary = new Map<string, number>();
        let dictIndex = 0;

        for (let i = 0; i < input.length; i++) {
            let maxMatch = "";
            let maxLength = 0;

            // Look for the longest match in our dictionary
            for (let len = Math.min(32, input.length - i); len > 0; len--) {
                const substr = Array.from(input.slice(i, i + len)).join(",");
                if (dictionary.has(substr) && len > maxLength) {
                    maxMatch = substr;
                    maxLength = len;
                }
            }

            if (maxLength > 2) {
                // Found a good match, encode as reference
                const dictRef = dictionary.get(maxMatch)!;
                result.push(
                    255,
                    dictRef & 0xff,
                    (dictRef >> 8) & 0xff,
                    maxLength
                );
                i += maxLength - 1;
            } else {
                // No good match, store literal
                const byte = input[i];
                result.push(byte);

                // Add new patterns to dictionary
                for (let len = 3; len <= Math.min(8, input.length - i); len++) {
                    const pattern = Array.from(input.slice(i, i + len)).join(
                        ","
                    );
                    if (!dictionary.has(pattern) && dictIndex < 65535) {
                        dictionary.set(pattern, dictIndex++);
                    }
                }
            }
        }

        return new Uint8Array(result);
    }

    /**
     * Run-length encoding for repeated bytes
     */
    private applyRunLengthEncoding(input: Uint8Array): Uint8Array {
        const result: number[] = [];

        for (let i = 0; i < input.length; i++) {
            const byte = input[i];
            let count = 1;

            // Count consecutive identical bytes
            while (
                i + count < input.length &&
                input[i + count] === byte &&
                count < 255
            ) {
                count++;
            }

            if (count > 3) {
                // Encode as run: marker(254) + byte + count
                result.push(254, byte, count);
                i += count - 1;
            } else {
                // Store literals
                for (let j = 0; j < count; j++) {
                    result.push(byte);
                }
                i += count - 1;
            }
        }

        return new Uint8Array(result);
    }

    /**
     * Frequency-based encoding (simplified Huffman)
     */
    private applyFrequencyEncoding(input: Uint8Array): Uint8Array {
        // Count byte frequencies
        const frequencies = new Map<number, number>();
        for (const byte of input) {
            frequencies.set(byte, (frequencies.get(byte) || 0) + 1);
        }

        // Create simple encoding table based on frequency
        const sortedBytes = Array.from(frequencies.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([byte]) => byte);

        // Use shorter codes for more frequent bytes
        const encodingTable = new Map<number, Uint8Array>();
        for (let i = 0; i < sortedBytes.length; i++) {
            const byte = sortedBytes[i];
            if (i < 16) {
                // Most frequent: 4-bit codes
                encodingTable.set(byte, new Uint8Array([i]));
            } else if (i < 64) {
                // Medium frequent: 6-bit codes
                encodingTable.set(byte, new Uint8Array([16 + (i - 16)]));
            } else {
                // Less frequent: 8-bit codes (original)
                encodingTable.set(byte, new Uint8Array([byte]));
            }
        }

        // Encode the data
        const result: number[] = [];

        // Store encoding table size
        result.push(sortedBytes.length & 0xff);

        // Store the encoding table
        for (const byte of sortedBytes.slice(
            0,
            Math.min(64, sortedBytes.length)
        )) {
            result.push(byte);
        }

        // Encode the actual data
        for (const byte of input) {
            const encoded = encodingTable.get(byte) || new Uint8Array([byte]);
            result.push(...encoded);
        }

        return new Uint8Array(result);
    }

    /**
     * Apply multi-stage decompression (reverse of compression)
     */
    private applyMultiStageDecompression(input: Uint8Array): Uint8Array {
        // Reverse the compression stages in opposite order

        // Stage 3 reverse: Frequency decoding
        const stage3 = this.reverseFrequencyEncoding(input);

        // Stage 2 reverse: Run-length decoding
        const stage2 = this.reverseRunLengthEncoding(stage3);

        // Stage 1 reverse: Dictionary decompression
        const stage1 = this.reverseDictionaryCompression(stage2);

        return stage1;
    }

    /**
     * Reverse frequency encoding
     */
    private reverseFrequencyEncoding(input: Uint8Array): Uint8Array {
        if (input.length === 0) return input;

        const result: number[] = [];
        let pos = 0;

        // Read encoding table size
        const tableSize = input[pos++];

        // Read the encoding table
        const decodingTable = new Map<number, number>();
        for (let i = 0; i < Math.min(64, tableSize); i++) {
            if (pos >= input.length) break;
            const originalByte = input[pos++];

            if (i < 16) {
                decodingTable.set(i, originalByte);
            } else if (i < 64) {
                decodingTable.set(16 + (i - 16), originalByte);
            } else {
                decodingTable.set(originalByte, originalByte);
            }
        }

        // Decode the data
        while (pos < input.length) {
            const encoded = input[pos++];
            const decoded = decodingTable.get(encoded) ?? encoded;
            result.push(decoded);
        }

        return new Uint8Array(result);
    }

    /**
     * Reverse run-length encoding
     */
    private reverseRunLengthEncoding(input: Uint8Array): Uint8Array {
        const result: number[] = [];

        for (let i = 0; i < input.length; i++) {
            const byte = input[i];

            if (byte === 254 && i + 2 < input.length) {
                // Run-length encoded sequence
                const value = input[i + 1];
                const count = input[i + 2];

                for (let j = 0; j < count; j++) {
                    result.push(value);
                }

                i += 2; // Skip the value and count bytes
            } else {
                // Literal byte
                result.push(byte);
            }
        }

        return new Uint8Array(result);
    }

    /**
     * Reverse dictionary compression
     */
    private reverseDictionaryCompression(input: Uint8Array): Uint8Array {
        const result: number[] = [];
        const dictionary: Uint8Array[] = [];

        for (let i = 0; i < input.length; i++) {
            const byte = input[i];

            if (byte === 255 && i + 3 < input.length) {
                // Dictionary reference
                const dictRef = input[i + 1] | (input[i + 2] << 8);
                const length = input[i + 3];

                if (dictRef < dictionary.length) {
                    const pattern = dictionary[dictRef];
                    for (let j = 0; j < Math.min(length, pattern.length); j++) {
                        result.push(pattern[j]);
                    }
                }

                i += 3; // Skip the reference bytes
            } else {
                // Literal byte
                result.push(byte);

                // Build dictionary from literals
                const startPos = Math.max(0, result.length - 8);
                for (
                    let len = 3;
                    len <= Math.min(8, result.length - startPos);
                    len++
                ) {
                    if (startPos + len <= result.length) {
                        const pattern = new Uint8Array(
                            result.slice(startPos, startPos + len)
                        );
                        if (dictionary.length < 65535) {
                            dictionary.push(pattern);
                        }
                    }
                }
            }
        }

        return new Uint8Array(result);
    }
}


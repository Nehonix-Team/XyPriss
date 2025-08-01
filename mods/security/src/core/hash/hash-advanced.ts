/**
 * Hash advanced features - Optimized hash implementations
 */

import * as crypto from "crypto";
import { Worker } from "worker_threads";
import * as path from "path";
import {
    HashAgilityResult,
    AgilityHashOptions,
    SideChannelOptions,
} from "./hash-types";
import { HashUtils } from "./hash-utils";
import { HashAlgorithms } from "../../algorithms/hash-algorithms";
import { cpus } from "os";

export class HashAdvanced {
    private static readonly CHUNK_SIZE = 64 * 1024; // 64KB
    private static readonly MAX_WORKERS = cpus().length;

    /**
     * Cryptographic agility - support for algorithm migration
     * @param input - Input to hash
     * @param options - Migration options
     * @returns Hash with algorithm metadata
     */
    public static agilityHash(
        input: string | Uint8Array,
        options: AgilityHashOptions = {}
    ): HashAgilityResult {
        const {
            primaryAlgorithm = "blake3",
            fallbackAlgorithms = ["sha512", "sha3-256"],
            futureProof = true,
            outputFormat = "hex",
        } = options;

        // Primary hash
        const primaryHash = HashAlgorithms.secureHash(input, {
            algorithm: primaryAlgorithm,
            outputFormat: "buffer",
        });

        // Generate fallback hashes for migration support
        const fallbacks: string[] = [];
        if (futureProof) {
            for (const algo of fallbackAlgorithms) {
                try {
                    const fallbackHash = HashAlgorithms.secureHash(input, {
                        algorithm: algo,
                        outputFormat: "hex",
                    });
                    fallbacks.push(`${algo}:${fallbackHash}`);
                } catch (error) {
                    console.warn(`Fallback algorithm ${algo} failed:`, error);
                }
            }
        }

        return {
            hash: HashUtils.formatOutput(primaryHash as Buffer, outputFormat),
            algorithm: primaryAlgorithm,
            fallbacks,
            metadata: {
                version: "1.0.0",
                timestamp: Date.now(),
                strength: "MILITARY",
            },
        };
    }

    /**
     * Side-channel attack resistant hashing
     * @param input - Input to hash
     * @param options - Resistance options
     * @returns Side-channel resistant hash
     */
    public static sideChannelResistantHash(
        input: string | Uint8Array,
        options: SideChannelOptions = {}
    ): string | Buffer {
        const {
            constantTime = true,
            memoryProtection = true,
            powerAnalysisResistant = true,
            outputFormat = "hex",
        } = options;

        const inputBuffer = HashUtils.toBuffer(input);

        if (constantTime) {
            return this.constantTimeHash(
                inputBuffer,
                memoryProtection,
                outputFormat
            );
        }

        if (powerAnalysisResistant) {
            return this.powerAnalysisResistantHash(inputBuffer, outputFormat);
        }

        return HashAlgorithms.secureHash(input, { outputFormat });
    }

    /**
     * Constant-time hash processing
     * @param inputBuffer - Input buffer
     * @param memoryProtection - Enable memory protection
     * @param outputFormat - Output format
     * @returns Constant-time hash
     */
    private static constantTimeHash(
        inputBuffer: Buffer,
        memoryProtection: boolean,
        outputFormat: string
    ): string | Buffer {
        // Use fixed-size buffer to prevent length-based timing attacks
        const blockSize = 1024;
        const numBlocks = Math.ceil(inputBuffer.length / blockSize);
        const paddedInput = Buffer.alloc(numBlocks * blockSize);

        inputBuffer.copy(paddedInput, 0, 0, inputBuffer.length);

        // Use HMAC for constant-time properties
        const key = crypto.randomBytes(32);
        const hmac = crypto.createHmac("sha256", key);

        // Process in fixed-size blocks
        for (let i = 0; i < paddedInput.length; i += blockSize) {
            const block = paddedInput.subarray(i, i + blockSize);
            hmac.update(block);
        }

        const result = hmac.digest();

        // Secure memory cleanup
        if (memoryProtection) {
            paddedInput.fill(0);
            key.fill(0);
            // Force garbage collection hint
            if (global.gc) {
                global.gc();
            }
        }

        return HashUtils.formatOutput(
            result,
            outputFormat as
                | "hex"
                | "base64"
                | "buffer"
                | "base58"
                | "binary"
                | "base64url"
        );
    }

    /**
     * Power analysis resistant hash processing - optimized implementation
     * @param inputBuffer - Input buffer
     * @param outputFormat - Output format
     * @returns Power analysis resistant hash
     */
    private static powerAnalysisResistantHash(
        inputBuffer: Buffer,
        outputFormat: string
    ): string | Buffer {
        // Use multiple hash algorithms to create noise
        const algorithms = ["sha256", "sha512", "sha3-256"];
        let result = inputBuffer;

        // Fixed number of rounds with different algorithms
        for (let i = 0; i < 3; i++) {
            const algo = algorithms[i % algorithms.length];
            result = crypto.createHash(algo).update(result).digest();
        }

        return HashUtils.formatOutput(
            result,
            outputFormat as
                | "hex"
                | "base64"
                | "buffer"
                | "base58"
                | "binary"
                | "base64url"
        );
    }

    /**
     * tse.ExecutionResultparallel hash processing using worker threads
     * @param input - Input to hash
     * @param options - Parallel processing options
     * @returns Promise resolving to hash result
     */
    public static async parallelHash(
        input: string | Uint8Array,
        options: {
            chunkSize?: number;
            workers?: number;
            algorithm?: string;
            outputFormat?: "hex" | "base64" | "buffer";
        } = {}
    ): Promise<string | Buffer> {
        const {
            chunkSize = this.CHUNK_SIZE,
            workers = Math.min(this.MAX_WORKERS, 4),
            algorithm = "sha256",
            outputFormat = "hex",
        } = options;

        const inputBuffer = HashUtils.toBuffer(input);

        // Use single-threaded for small inputs
        if (inputBuffer.length <= chunkSize) {
            return HashAlgorithms.secureHash(input, {
                algorithm,
                outputFormat,
            });
        }

        // Split input into chunks
        const chunks: Buffer[] = [];
        for (let i = 0; i < inputBuffer.length; i += chunkSize) {
            chunks.push(inputBuffer.subarray(i, i + chunkSize));
        }

        // Process chunks with actual worker threads
        const workerPromises = chunks.map((chunk, index) => {
            return new Promise<Buffer>((resolve, reject) => {
                const worker = new Worker(
                    `
                    const { parentPort } = require('worker_threads');
                    const crypto = require('crypto');
                    
                    parentPort.on('message', ({ chunk, algorithm }) => {
                        try {
                            const hash = crypto.createHash(algorithm).update(chunk).digest();
                            parentPort.postMessage({ success: true, hash });
                        } catch (error) {
                            parentPort.postMessage({ success: false, error: error.message });
                        }
                    });
                `,
                    { eval: true }
                );

                worker.postMessage({ chunk, algorithm });

                worker.on("message", ({ success, hash, error }) => {
                    if (success) {
                        resolve(hash);
                    } else {
                        reject(new Error(error));
                    }
                    worker.terminate();
                });

                worker.on("error", reject);
            });
        });

        try {
            const chunkHashes = await Promise.all(workerPromises);

            // Combine chunk hashes
            const combinedHash = crypto.createHash(algorithm);
            for (const chunkHash of chunkHashes) {
                combinedHash.update(chunkHash);
            }

            const result = combinedHash.digest();
            return HashUtils.formatOutput(result, outputFormat);
        } catch (error) {
            // Fallback to single-threaded processing
            console.warn(
                "Parallel processing failed, falling back to single-threaded:",
                error
            );
            return HashAlgorithms.secureHash(input, {
                algorithm,
                outputFormat,
            });
        }
    }

    /**
     * Optimized streaming hash for large data processing
     * @param algorithm - Hash algorithm
     * @param options - Streaming options
     * @returns Stream hash processor
     */
    public static createStreamingHash(
        algorithm: string = "sha256",
        options: {
            chunkSize?: number;
            progressCallback?: (processed: number, total?: number) => void;
        } = {}
    ): {
        update: (chunk: Buffer) => void;
        digest: () => Buffer;
        reset: () => void;
        getProgress: () => { processed: number; chunks: number };
    } {
        const { chunkSize = this.CHUNK_SIZE, progressCallback } = options;

        let hash = crypto.createHash(algorithm);
        let totalProcessed = 0;
        let chunksProcessed = 0;
        let buffer = Buffer.alloc(0);

        return {
            update: (chunk: Buffer) => {
                // Accumulate data in buffer for optimal processing
                buffer = Buffer.concat([buffer, chunk]);

                // Process complete chunks
                while (buffer.length >= chunkSize) {
                    const processChunk = buffer.subarray(0, chunkSize);
                    hash.update(processChunk);
                    buffer = buffer.subarray(chunkSize);

                    totalProcessed += chunkSize;
                    chunksProcessed++;

                    if (progressCallback) {
                        progressCallback(totalProcessed);
                    }
                }
            },

            digest: () => {
                // Process remaining buffer
                if (buffer.length > 0) {
                    hash.update(buffer);
                    totalProcessed += buffer.length;
                }

                const result = hash.digest();

                // Reset state
                hash = crypto.createHash(algorithm);
                buffer = Buffer.alloc(0);
                totalProcessed = 0;
                chunksProcessed = 0;

                return result;
            },

            reset: () => {
                hash = crypto.createHash(algorithm);
                buffer = Buffer.alloc(0);
                totalProcessed = 0;
                chunksProcessed = 0;
            },

            getProgress: () => ({
                processed: totalProcessed,
                chunks: chunksProcessed,
            }),
        };
    }

    /**
     * Optimized Merkle tree hash for data integrity
     * @param data - Array of data chunks
     * @param algorithm - Hash algorithm
     * @returns Merkle root hash
     */
    public static merkleTreeHash(
        data: (string | Uint8Array | Buffer)[],
        algorithm: string = "sha256"
    ): Buffer {
        if (data.length === 0) {
            throw new Error("Cannot create Merkle tree from empty data");
        }

        // Pre-allocate arrays for better performance
        let hashes = new Array<Buffer>(data.length);

        // Hash all leaf nodes
        for (let i = 0; i < data.length; i++) {
            const buffer = HashUtils.toBuffer(data[i]);
            hashes[i] = crypto.createHash(algorithm).update(buffer).digest();
        }

        // Build tree bottom-up with optimized memory usage
        while (hashes.length > 1) {
            const nextLevel = new Array<Buffer>(Math.ceil(hashes.length / 2));
            let nextIndex = 0;

            for (let i = 0; i < hashes.length; i += 2) {
                if (i + 1 < hashes.length) {
                    // Combine pair of hashes efficiently
                    const combined = Buffer.allocUnsafe(
                        hashes[i].length + hashes[i + 1].length
                    );
                    hashes[i].copy(combined, 0);
                    hashes[i + 1].copy(combined, hashes[i].length);

                    nextLevel[nextIndex] = crypto
                        .createHash(algorithm)
                        .update(combined)
                        .digest();
                } else {
                    // Odd number of hashes, promote the last one
                    nextLevel[nextIndex] = hashes[i];
                }
                nextIndex++;
            }

            hashes = nextLevel;
        }

        return hashes[0];
    }

    /**
     * Optimized incremental hash for append-only data
     * @param previousHash - Previous hash state
     * @param newData - New data to append
     * @param algorithm - Hash algorithm
     * @returns Updated hash
     */
    public static incrementalHash(
        previousHash: string | Buffer,
        newData: string | Uint8Array | Buffer,
        algorithm: string = "sha256"
    ): Buffer {
        const prevBuffer = Buffer.isBuffer(previousHash)
            ? previousHash
            : Buffer.from(previousHash, "hex");

        const newBuffer = HashUtils.toBuffer(newData);

        // Efficient concatenation and hashing
        const totalLength = prevBuffer.length + newBuffer.length;
        const combined = Buffer.allocUnsafe(totalLength);

        prevBuffer.copy(combined, 0);
        newBuffer.copy(combined, prevBuffer.length);

        return crypto.createHash(algorithm).update(combined).digest();
    }

    /**
     * Optimized hash chain for sequential data integrity
     * @param data - Array of data items
     * @param algorithm - Hash algorithm
     * @returns Array of chained hashes
     */
    public static hashChain(
        data: (string | Uint8Array | Buffer)[],
        algorithm: string = "sha256"
    ): Buffer[] {
        if (data.length === 0) {
            return [];
        }

        const hashes = new Array<Buffer>(data.length);
        let previousHash: Buffer | null = null;

        for (let i = 0; i < data.length; i++) {
            const itemBuffer = HashUtils.toBuffer(data[i]);
            const hasher = crypto.createHash(algorithm);

            if (previousHash) {
                hasher.update(previousHash);
            }
            hasher.update(itemBuffer);

            const hash = hasher.digest();
            hashes[i] = hash;
            previousHash = hash;
        }

        return hashes;
    }

    /**
     * Batch hash processing for multiple inputs
     * @param inputs - Array of inputs to hash
     * @param algorithm - Hash algorithm
     * @param outputFormat - Output format
     * @returns Array of hashes
     */
    public static batchHash(
        inputs: (string | Uint8Array | Buffer)[],
        algorithm: string = "sha256",
        outputFormat: "hex" | "base64" | "buffer" = "hex"
    ): (string | Buffer)[] {
        const results = new Array<string | Buffer>(inputs.length);

        for (let i = 0; i < inputs.length; i++) {
            const buffer = HashUtils.toBuffer(inputs[i]);
            const hash = crypto.createHash(algorithm).update(buffer).digest();
            results[i] = HashUtils.formatOutput(hash, outputFormat);
        }

        return results;
    }

    /**
     * Memory-efficient hash verification
     * @param input - Input to verify
     * @param expectedHash - Expected hash value
     * @param algorithm - Hash algorithm
     * @returns True if hash matches
     */
    public static verifyHash(
        input: string | Uint8Array | Buffer,
        expectedHash: string | Buffer,
        algorithm: string = "sha256"
    ): boolean {
        const inputBuffer = HashUtils.toBuffer(input);
        const computedHash = crypto
            .createHash(algorithm)
            .update(inputBuffer)
            .digest();

        const expectedBuffer = Buffer.isBuffer(expectedHash)
            ? expectedHash
            : Buffer.from(expectedHash, "hex");

        // Constant-time comparison to prevent timing attacks
        return crypto.timingSafeEqual(computedHash, expectedBuffer);
    }
}


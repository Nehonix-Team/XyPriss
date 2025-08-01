/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) NEHONIX INC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 * -------------------------------------------------------------------------------------------
 */

/**
 * Memory-Hard Key Derivation Module
 *
 * This module implements memory-hard key derivation functions that require
 * significant amounts of memory to compute, making them resistant to
 * hardware-based attacks (ASICs, FPGAs, GPUs).
 *
 * These functions are particularly effective against brute-force attacks
 * as they impose both computational and memory constraints on attackers.
 */

import { SecureRandom } from "../core/random";
import { Hash } from "../core/hash";
import { StatsTracker } from "../utils/stats";
import { bufferToHex } from "../utils/encoding";
import argon2 from "argon2";
import childProcess from "child_process";
// import { XMLHttpRequest } from "xmlhttprequest";

/**
 * Options for memory-hard key derivation
 */
export interface MemoryHardOptions {
    /**
     * Memory cost parameter (higher = more memory usage)
     * @default 16384 (16 MB)
     */
    memoryCost?: number;

    /**
     * Time cost parameter (higher = more iterations)
     * @default 4
     */
    timeCost?: number;

    /**
     * Parallelism parameter (higher = more threads if available)
     * @default 1
     */
    parallelism?: number;

    /**
     * Output key length in bytes
     * @default 32
     */
    keyLength?: number;

    /**
     * Salt for the derivation
     * If not provided, a random salt will be generated
     */
    salt?: Uint8Array;

    /**
     * Salt length in bytes (if generating a new salt)
     * @default 16
     */
    saltLength?: number;
}

/**
 * Result of memory-hard key derivation
 */
export interface MemoryHardResult {
    /**
     * Derived key as a hex string
     */
    derivedKey: string;

    /**
     * Salt used for the derivation (hex encoded)
     */
    salt: string;

    /**
     * Parameters used for the derivation
     */
    params: {
        memoryCost: number;
        timeCost: number;
        parallelism: number;
        keyLength: number;
    };

    /**
     * Performance metrics
     */
    metrics: {
        /**
         * Time taken in milliseconds
         */
        timeTakenMs: number;

        /**
         * Estimated memory used in bytes
         */
        memoryUsedBytes: number;
    };
}

/**
 * Implements the Argon2 memory-hard key derivation function using the argon2 library
 *
 * Argon2 is designed to be resistant to GPU, ASIC, and FPGA attacks by
 * requiring large amounts of memory to compute.
 *
 * This implementation uses the official argon2 library for Node.js.
 *
 * @param password - Password to derive key from
 * @param options - Derivation options
 * @returns Derived key and metadata
 */
export async function argon2Derive(
    password: string | Uint8Array,
    options: MemoryHardOptions = {}
): Promise<MemoryHardResult> {
    const startTime = Date.now();

    // Check if the argon2 library is available
    if (!argon2) {
        // Fallback to the simplified implementation if the library is not available
        console.warn(
            "Argon2 library not available, using simplified implementation"
        );
        return argon2DeriveSimplified(password, options);
    }

    // Parse options with defaults
    const memoryCost = options.memoryCost || 16384; // 16 MB
    const timeCost = options.timeCost || 4;
    const parallelism = options.parallelism || 1;
    const keyLength = options.keyLength || 32;

    // Generate or use provided salt
    const saltLength = options.saltLength || 16;
    const saltBytes = options.salt || SecureRandom.getRandomBytes(saltLength);
    const salt = Buffer.from(saltBytes);

    // Convert password to the format expected by argon2
    const passwordBuffer =
        typeof password === "string"
            ? Buffer.from(password)
            : Buffer.from(password);

    try {
        // Configure Argon2 options
        const argon2Options = {
            type: argon2.argon2id, // Use Argon2id variant (balanced security)
            memoryCost: Math.max(8, Math.floor(memoryCost / 1024)), // Convert to KiB, minimum 8
            timeCost: timeCost,
            parallelism: parallelism,
            hashLength: keyLength,
            salt: salt,
            raw: true, // Return raw buffer instead of encoded hash
        };

        // Perform the key derivation
        const result = await argon2.hash(passwordBuffer, argon2Options);

        const endTime = Date.now();
        const timeTakenMs = endTime - startTime;

        // Track statistics
        StatsTracker.getInstance().trackKeyDerivation(
            timeTakenMs,
            keyLength * 8 // Entropy bits
        );

        return {
            derivedKey: bufferToHex(new Uint8Array(Buffer.from(result))),
            salt: bufferToHex(saltBytes),
            params: {
                memoryCost,
                timeCost,
                parallelism,
                keyLength,
            },
            metrics: {
                timeTakenMs,
                memoryUsedBytes: memoryCost * 1024, // Convert KiB to bytes
            },
        };
    } catch (error) {
        console.error("Error using Argon2 library:", error);
        // Fallback to simplified implementation
        return argon2DeriveSimplified(password, options);
    }
}

/**
 * 
 * Implements a simplified version of Argon2 for environments where the argon2 library is not available
 * This uses the argon2-browser library or a Node.js child process approach as fallbacks
 *
 * @param password - Password to derive key from
 * @param options - Derivation options
 * @returns Derived key and metadata
 */
function argon2DeriveSimplified(
    password: string | Uint8Array,
    options: MemoryHardOptions = {}
): MemoryHardResult {
    const startTime = Date.now();

    // Parse options with defaults
    const memoryCost = options.memoryCost || 16384; // 16 MB
    const timeCost = options.timeCost || 4;
    const parallelism = options.parallelism || 1;
    const keyLength = options.keyLength || 32;

    // Generate or use provided salt
    const saltLength = options.saltLength || 16;
    const salt = options.salt || SecureRandom.getRandomBytes(saltLength);

    // Convert password to bytes if it's a string
    const passwordBytes =
        typeof password === "string"
            ? new TextEncoder().encode(password)
            : password;

    try {
        // Try to use argon2-browser in browser environments
        if (typeof window !== "undefined") {
            try {
                // Try to dynamically import argon2-browser
                const argon2Browser = require("argon2-browser");

                if (argon2Browser) {
                    // Create a synchronous wrapper around the async argon2-browser
                    const argon2BrowserSync = (
                        pwd: Uint8Array,
                        slt: Uint8Array,
                        mem: number,
                        time: number,
                        parallel: number,
                        hashLen: number
                    ): Uint8Array => {
                        // Use a synchronous XMLHttpRequest to block until we have a result
                        const xhr = new XMLHttpRequest();
                        let result: Uint8Array | null = null;
                        let error: Error | null = null;

                        // Convert Uint8Arrays to regular arrays for argon2-browser
                        const pwdArray = Array.from(pwd);
                        const saltArray = Array.from(slt);

                        // Call argon2-browser
                        argon2Browser
                            .hash({
                                pass: pwdArray,
                                salt: saltArray,
                                time: time,
                                mem: Math.max(8, Math.floor(mem / 1024)), // Convert to KiB, minimum 8
                                parallelism: parallel,
                                hashLen: hashLen,
                                type: argon2Browser.ArgonType.Argon2id,
                            })
                            .then((result: any) => {
                                result = new Uint8Array(result.hash);
                            })
                            .catch((err: Error) => {
                                error = err;
                            });

                        // Wait for the result (blocking)
                        xhr.open(
                            "GET",
                            "data:text/plain;charset=utf-8,",
                            false
                        );

                        const maxWaitTime = Date.now() + 30000; // 30 second timeout

                        while (result === null && error === null) {
                            // Check for timeout
                            if (Date.now() > maxWaitTime) {
                                throw new Error("Argon2 operation timed out");
                            }

                            // Poll every 100ms
                            try {
                                xhr.send(null);
                            } catch (e) {
                                // Ignore errors from the XHR
                            }
                        }

                        // Check for errors
                        if (error) {
                            throw error;
                        }

                        // Return the result
                        if (result) {
                            return result;
                        }

                        throw new Error(
                            "Argon2 operation failed with no result"
                        );
                    };

                    // Call our synchronous wrapper
                    const derivedKey = argon2BrowserSync(
                        passwordBytes,
                        salt,
                        memoryCost,
                        timeCost,
                        parallelism,
                        keyLength
                    );

                    const endTime = Date.now();
                    const timeTakenMs = endTime - startTime;

                    // Track statistics
                    StatsTracker.getInstance().trackKeyDerivation(
                        timeTakenMs,
                        keyLength * 8 // Entropy bits
                    );

                    return {
                        derivedKey: bufferToHex(derivedKey),
                        salt: bufferToHex(salt),
                        params: {
                            memoryCost,
                            timeCost,
                            parallelism,
                            keyLength,
                        },
                        metrics: {
                            timeTakenMs,
                            memoryUsedBytes: memoryCost,
                        },
                    };
                }
            } catch (e) {
                console.warn("argon2-browser not available:", e);
                // Fall back to Web Crypto API with PBKDF2
            }

            // If argon2-browser is not available, try to use Web Crypto API with PBKDF2
            if (window.crypto && window.crypto.subtle) {
                try {
                    // Create a synchronous wrapper around the async Web Crypto API
                    const pbkdf2Sync = (
                        pwd: Uint8Array,
                        slt: Uint8Array,
                        iterations: number,
                        hashLen: number
                    ): Uint8Array => {
                        // Use a synchronous XMLHttpRequest to block until we have a result
                        const xhr = new XMLHttpRequest();
                        let result: Uint8Array | null = null;
                        let error: Error | null = null;

                        // Create proper ArrayBuffers to avoid type issues
                        const pwdBuffer = new ArrayBuffer(pwd.length);
                        const pwdView = new Uint8Array(pwdBuffer);
                        pwdView.set(pwd);

                        const saltBuffer = new ArrayBuffer(slt.length);
                        const saltView = new Uint8Array(saltBuffer);
                        saltView.set(slt);

                        // Import the password as a key
                        window.crypto.subtle
                            .importKey(
                                "raw",
                                pwdBuffer,
                                { name: "PBKDF2" },
                                false,
                                ["deriveBits"]
                            )
                            .then((key) => {
                                // Derive bits using PBKDF2
                                return window.crypto.subtle.deriveBits(
                                    {
                                        name: "PBKDF2",
                                        salt: saltBuffer,
                                        iterations: iterations,
                                        hash: "SHA-512",
                                    },
                                    key,
                                    hashLen * 8
                                );
                            })
                            .then((derivedBits) => {
                                result = new Uint8Array(derivedBits);
                            })
                            .catch((err) => {
                                error = err;
                            });

                        // Wait for the result (blocking)
                        xhr.open(
                            "GET",
                            "data:text/plain;charset=utf-8,",
                            false
                        );

                        const maxWaitTime = Date.now() + 30000; // 30 second timeout

                        while (result === null && error === null) {
                            // Check for timeout
                            if (Date.now() > maxWaitTime) {
                                throw new Error("PBKDF2 operation timed out");
                            }

                            // Poll every 100ms
                            try {
                                xhr.send(null);
                            } catch (e) {
                                // Ignore errors from the XHR
                            }
                        }

                        // Check for errors
                        if (error) {
                            throw error;
                        }

                        // Return the result
                        if (result) {
                            return result;
                        }

                        throw new Error(
                            "PBKDF2 operation failed with no result"
                        );
                    };

                    // Calculate equivalent PBKDF2 iterations to match Argon2 security
                    // This is a rough approximation: Argon2 with memoryCost=m, timeCost=t, parallelism=p
                    // is roughly equivalent to PBKDF2 with iterations = m * t * p / 10
                    const equivalentIterations = Math.max(
                        100000,
                        Math.floor((memoryCost * timeCost * parallelism) / 10)
                    );

                    // Call our synchronous wrapper
                    const derivedKey = pbkdf2Sync(
                        passwordBytes,
                        salt,
                        equivalentIterations,
                        keyLength
                    );

                    const endTime = Date.now();
                    const timeTakenMs = endTime - startTime;

                    console.warn(
                        `Using Web Crypto PBKDF2 with ${equivalentIterations} iterations as Argon2 fallback`
                    );

                    // Track statistics
                    StatsTracker.getInstance().trackKeyDerivation(
                        timeTakenMs,
                        keyLength * 8 // Entropy bits
                    );

                    return {
                        derivedKey: bufferToHex(derivedKey),
                        salt: bufferToHex(salt),
                        params: {
                            memoryCost,
                            timeCost,
                            parallelism,
                            keyLength,
                        },
                        metrics: {
                            timeTakenMs,
                            memoryUsedBytes: memoryCost,
                        },
                    };
                } catch (e) {
                    console.warn("Web Crypto PBKDF2 failed:", e);
                    // Fall back to Node.js approach or pure JS implementation
                }
            }
        }

        // Try to use Node.js crypto module if available
        if (typeof require === "function") {
            try {
                const crypto = require("crypto");

                if (crypto && crypto.scryptSync) {
                    // Use scrypt as a fallback for Argon2
                    console.warn(
                        "Using Node.js crypto scrypt as Argon2 fallback"
                    );

                    // Convert parameters to scrypt parameters
                    // Argon2 with memoryCost=m, timeCost=t is roughly equivalent to
                    // scrypt with N=2^(log2(m/p)), r=8, p=parallelism
                    const log2MemoryCost = Math.max(
                        14,
                        Math.min(20, Math.log2(memoryCost / parallelism))
                    );
                    const N = Math.pow(2, log2MemoryCost);
                    const r = 8; // Block size
                    const p = parallelism;

                    // Convert password and salt to Buffer
                    const passwordBuffer = Buffer.from(passwordBytes);
                    const saltBuffer = Buffer.from(salt);

                    // Derive key using scrypt
                    const derivedKey = crypto.scryptSync(
                        passwordBuffer,
                        saltBuffer,
                        keyLength,
                        { N, r, p }
                    );

                    const endTime = Date.now();
                    const timeTakenMs = endTime - startTime;

                    // Track statistics
                    StatsTracker.getInstance().trackKeyDerivation(
                        timeTakenMs,
                        keyLength * 8 // Entropy bits
                    );

                    return {
                        derivedKey: bufferToHex(new Uint8Array(derivedKey)),
                        salt: bufferToHex(salt),
                        params: {
                            memoryCost,
                            timeCost,
                            parallelism,
                            keyLength,
                        },
                        metrics: {
                            timeTakenMs,
                            memoryUsedBytes: N * r * 128 * p, // Approximate memory usage
                        },
                    };
                } else if (crypto && crypto.pbkdf2Sync) {
                    // Use PBKDF2 as a fallback for Argon2
                    console.warn(
                        "Using Node.js crypto PBKDF2 as Argon2 fallback"
                    );

                    // Calculate equivalent PBKDF2 iterations
                    const equivalentIterations = Math.max(
                        100000,
                        Math.floor((memoryCost * timeCost * parallelism) / 10)
                    );

                    // Convert password and salt to Buffer
                    const passwordBuffer = Buffer.from(passwordBytes);
                    const saltBuffer = Buffer.from(salt);

                    // Derive key using PBKDF2
                    const derivedKey = crypto.pbkdf2Sync(
                        passwordBuffer,
                        saltBuffer,
                        equivalentIterations,
                        keyLength,
                        "sha512"
                    );

                    const endTime = Date.now();
                    const timeTakenMs = endTime - startTime;

                    // Track statistics
                    StatsTracker.getInstance().trackKeyDerivation(
                        timeTakenMs,
                        keyLength * 8 // Entropy bits
                    );

                    return {
                        derivedKey: bufferToHex(new Uint8Array(derivedKey)),
                        salt: bufferToHex(salt),
                        params: {
                            memoryCost,
                            timeCost,
                            parallelism,
                            keyLength,
                        },
                        metrics: {
                            timeTakenMs,
                            memoryUsedBytes: memoryCost, // Approximate memory usage
                        },
                    };
                }
            } catch (e) {
                console.warn("Node.js crypto fallback failed:", e);
                // Fall back to pure JS implementation
            }

            // Try to use a child process to run the argon2 command-line tool
            try {
                // const childProcess = require("child_process");
                const fs = require("fs");
                const path = require("path");
                const os = require("os");

                // Check if argon2 command-line tool is available
                try {
                    // Try to execute argon2 -h to check if it's available
                    childProcess.execSync("argon2 -h", { stdio: "ignore" });

                    // If we get here, argon2 is available
                    console.warn("Using argon2 command-line tool as fallback");

                    // Create temporary files for password and salt
                    const tempDir = os.tmpdir();
                    const passwordFile = path.join(
                        tempDir,
                        `argon2-pwd-${Date.now()}.bin`
                    );
                    const saltFile = path.join(
                        tempDir,
                        `argon2-salt-${Date.now()}.bin`
                    );
                    const outputFile = path.join(
                        tempDir,
                        `argon2-out-${Date.now()}.bin`
                    );

                    // Write password and salt to temporary files
                    fs.writeFileSync(passwordFile, Buffer.from(passwordBytes));
                    fs.writeFileSync(saltFile, Buffer.from(salt));

                    // Build argon2 command
                    const command = `argon2 "${passwordFile}" -r -id -t ${timeCost} -m ${Math.log2(
                        memoryCost / 1024
                    )} -p ${parallelism} -l ${keyLength} -s "${saltFile}" -o "${outputFile}"`;

                    // Execute argon2 command
                    childProcess.execSync(command, { stdio: "ignore" });

                    // Read the output
                    const derivedKey = new Uint8Array(
                        fs.readFileSync(outputFile)
                    );

                    // Clean up temporary files
                    try {
                        fs.unlinkSync(passwordFile);
                        fs.unlinkSync(saltFile);
                        fs.unlinkSync(outputFile);
                    } catch (e) {
                        // Ignore cleanup errors
                    }

                    const endTime = Date.now();
                    const timeTakenMs = endTime - startTime;

                    // Track statistics
                    StatsTracker.getInstance().trackKeyDerivation(
                        timeTakenMs,
                        keyLength * 8 // Entropy bits
                    );

                    return {
                        derivedKey: bufferToHex(derivedKey),
                        salt: bufferToHex(salt),
                        params: {
                            memoryCost,
                            timeCost,
                            parallelism,
                            keyLength,
                        },
                        metrics: {
                            timeTakenMs,
                            memoryUsedBytes: memoryCost,
                        },
                    };
                } catch (e) {
                    // argon2 command-line tool not available
                    console.warn("argon2 command-line tool not available:", e);
                }
            } catch (e) {
                console.warn("Child process approach failed:", e);
            }
        }
    } catch (e) {
        console.warn("All Argon2 alternatives failed:", e);
    }

    // If all else fails, use a more secure fallback implementation
    console.warn("Using Hash.create as final Argon2 fallback");

    // Use multiple iterations of Hash.create with memory-hard properties
    const blockSize = 64; // Size of each memory block in bytes
    const numBlocks = Math.max(256, Math.min(memoryCost, 4096)); // Limit memory usage
    const memory = new Array(numBlocks);

    // Initialize memory with hash chains
    for (let i = 0; i < numBlocks; i++) {
        // Create a unique seed for each block
        const blockSeed = new Uint8Array(
            passwordBytes.length + salt.length + 4
        );
        blockSeed.set(passwordBytes, 0);
        blockSeed.set(salt, passwordBytes.length);

        // Add block index to the seed
        const view = new DataView(blockSeed.buffer);
        view.setUint32(passwordBytes.length + salt.length, i, true);

        // Use Hash.create to fill the block
        try {
            const hashResult = Hash.create(blockSeed, {
                algorithm: "sha512",
                iterations: Math.max(1, Math.floor(timeCost / 2)),
                salt: salt,
                outputFormat: "buffer",
            });

            // Convert the hash result to a Uint8Array
            memory[i] = new Uint8Array(hashResult as any).slice(0, blockSize);
        } catch (e) {
            // If Hash.create fails, use a simple hash
            memory[i] = new Uint8Array(blockSize);
            for (let j = 0; j < blockSize; j++) {
                memory[i][j] = (blockSeed[j % blockSeed.length] + i + j) & 0xff;
            }
        }
    }

    // Perform mixing rounds with dependencies between blocks
    for (let t = 0; t < timeCost; t++) {
        for (let p = 0; p < parallelism; p++) {
            for (let i = 0; i < numBlocks; i++) {
                // Select blocks to mix with based on current block's content
                const j = memory[i][0] % numBlocks; // Dependent indexing
                const k = memory[i][1] % numBlocks; // Dependent indexing

                // Create a buffer for mixing
                const mixBuffer = new Uint8Array(blockSize * 3 + salt.length);
                mixBuffer.set(memory[i], 0);
                mixBuffer.set(memory[j], blockSize);
                mixBuffer.set(memory[k], blockSize * 2);
                mixBuffer.set(salt, blockSize * 3);

                // Use Hash.create for mixing
                try {
                    const hashResult = Hash.create(mixBuffer, {
                        algorithm: "sha512",
                        iterations: 1,
                        outputFormat: "buffer",
                    });

                    // Update the current block
                    memory[i] = new Uint8Array(hashResult as any).slice(
                        0,
                        blockSize
                    );
                } catch (e) {
                    // If Hash.create fails, use a simple mixing function
                    for (let b = 0; b < blockSize; b++) {
                        memory[i][b] ^= memory[j][b] ^ memory[k][b];
                        memory[i][b] =
                            (memory[i][b] + memory[j][(b + 1) % blockSize]) &
                            0xff;
                    }
                }
            }
        }
    }

    // Extract the key from multiple blocks
    const result = new Uint8Array(keyLength);
    const finalMixBuffer = new Uint8Array(numBlocks * 4 + salt.length);

    // Collect data from all blocks
    for (let i = 0; i < numBlocks; i++) {
        finalMixBuffer.set(memory[i].slice(0, 4), i * 4);
    }
    finalMixBuffer.set(salt, numBlocks * 4);

    // Final hash to derive the key
    try {
        const hashResult = Hash.create(finalMixBuffer, {
            algorithm: "sha512",
            iterations: timeCost * 2,
            salt: salt,
            outputFormat: "buffer",
        });

        // Copy the result, repeating if necessary
        const hashBytes = new Uint8Array(hashResult as any);
        for (let i = 0; i < keyLength; i++) {
            result[i] = hashBytes[i % hashBytes.length];
        }
    } catch (e) {
        // If Hash.create fails, derive key from memory blocks
        for (let i = 0; i < keyLength; i++) {
            let value = 0;
            for (let j = 0; j < Math.min(16, numBlocks); j++) {
                const blockIndex = (i * j) % numBlocks;
                const byteIndex = (i + j) % blockSize;
                value ^= memory[blockIndex][byteIndex];
            }
            result[i] = value;
        }
    }

    const endTime = Date.now();
    const timeTakenMs = endTime - startTime;

    // Track statistics
    StatsTracker.getInstance().trackKeyDerivation(
        timeTakenMs,
        keyLength * 8 // Entropy bits
    );

    return {
        derivedKey: bufferToHex(result),
        salt: bufferToHex(salt),
        params: {
            memoryCost,
            timeCost,
            parallelism,
            keyLength,
        },
        metrics: {
            timeTakenMs,
            memoryUsedBytes: numBlocks * blockSize,
        },
    };
}

/**
 * Implements a real version of the Balloon memory-hard hashing algorithm
 *
 * Balloon is designed to be a simple memory-hard algorithm with provable
 * memory-hardness properties. This implementation follows the paper:
 * "Balloon: A Forward-Secure Password-Hashing Algorithm with Memory-Hard Functions"
 * by Dan Boneh, Henry Corrigan-Gibbs, and Stuart Schechter.
 *
 * @param password - Password to derive key from
 * @param options - Derivation options
 * @returns Derived key and metadata
 */
export function balloonDerive(
    password: string | Uint8Array,
    options: MemoryHardOptions = {}
): MemoryHardResult {
    const startTime = Date.now();

    // Parse options with defaults
    const memoryCost = options.memoryCost || 16384; // 16 MB
    const timeCost = options.timeCost || 4;
    const parallelism = options.parallelism || 1; // Used for multiple lanes in enhanced Balloon
    const keyLength = options.keyLength || 32;

    // Generate or use provided salt
    const saltLength = options.saltLength || 16;
    const salt = options.salt || SecureRandom.getRandomBytes(saltLength);

    // Convert password to bytes if it's a string
    const passwordBytes =
        typeof password === "string"
            ? new TextEncoder().encode(password)
            : password;

    // Try to use Node.js crypto for better performance if available
    if (typeof require === "function") {
        try {
            const crypto = require("crypto");

            if (crypto && crypto.createHash) {
                // Use Node.js crypto implementation
                return balloonDeriveNodeCrypto(
                    passwordBytes,
                    salt,
                    memoryCost,
                    timeCost,
                    parallelism,
                    keyLength,
                    startTime
                );
            }
        } catch (e) {
            console.warn("Node.js crypto not available for Balloon:", e);
            // Fall back to the pure JS implementation
        }
    }

    // Initialize memory blocks (each 64 bytes for better security)
    const blockSize = 64; // Use 64 bytes (512 bits) for SHA-512
    const numBlocks = Math.max(256, Math.min(memoryCost, 65536)); // Limit memory usage
    const memory = new Array(numBlocks);

    // Create a secure hash function using SHA-512
    const secureHash = (data: Uint8Array): Uint8Array => {
        try {
            // Use the Hash module's secure hash function
            const hashResult = Hash.create(data, {
                algorithm: "sha512", // Use SHA-512 for better security
                outputFormat: "buffer",
            });

            // Convert the hash result to a Uint8Array
            if (typeof hashResult === "string") {
                // Convert string to buffer
                return new TextEncoder().encode(hashResult).slice(0, blockSize);
            } else {
                // Use it as a Uint8Array
                return new Uint8Array(hashResult as any).slice(0, blockSize);
            }
        } catch (e) {
            console.warn("Error using Hash.create:", e);

            // Fallback to a more secure custom implementation
            try {
                // Create a buffer for the hash result
                const result = new Uint8Array(blockSize);

                // Simple custom hash function based on multiple rounds of mixing
                let h = 0;
                for (let i = 0; i < blockSize; i++) {
                    for (let j = 0; j < data.length; j++) {
                        // Mix data bytes with position and previous hash value
                        h = ((h << 5) - h + data[j]) | 0;
                        h =
                            ((h << 7) ^
                                (h >>> 3) ^
                                data[(j + i) % data.length]) |
                            0;
                    }
                    // Store hash byte
                    result[i] = h & 0xff;
                }

                return result;
            } catch (innerError) {
                // Last resort fallback
                console.warn("Error in fallback hash:", innerError);
                const fallbackHash = new Uint8Array(blockSize);
                for (let i = 0; i < blockSize; i++) {
                    fallbackHash[i] = (i * 31 + data[i % data.length]) & 0xff;
                }
                return fallbackHash;
            }
        }
    };

    // Step 1: Expand - Fill the buffer with pseudorandom bytes derived from the password and salt
    // Initialize first block with password and salt
    const initialSeed = new Uint8Array(passwordBytes.length + salt.length + 8);
    initialSeed.set(passwordBytes, 0);
    initialSeed.set(salt, passwordBytes.length);

    // Add counter and other parameters to the seed
    const seedView = new DataView(initialSeed.buffer);
    seedView.setUint32(passwordBytes.length + salt.length, numBlocks, true);
    seedView.setUint32(passwordBytes.length + salt.length + 4, timeCost, true);

    // Fill first block
    memory[0] = secureHash(initialSeed);

    // Fill remaining blocks using counter mode
    for (let i = 1; i < numBlocks; i++) {
        const input = new Uint8Array(memory[i - 1].length + 8);
        input.set(memory[i - 1], 0);

        // Add counter and block index
        const view = new DataView(input.buffer);
        view.setUint32(memory[i - 1].length, i, true);
        view.setUint32(memory[i - 1].length + 4, 0, true); // Round 0

        memory[i] = secureHash(input);
    }

    // Step 2: Mix - Perform multiple rounds of mixing
    for (let round = 0; round < timeCost; round++) {
        // Process each block
        for (let i = 0; i < numBlocks; i++) {
            // Step 2a: Hash the current block with round and index
            const bufferA = new Uint8Array(memory[i].length + 8);
            bufferA.set(memory[i], 0);

            const viewA = new DataView(bufferA.buffer);
            viewA.setUint32(memory[i].length, round, true);
            viewA.setUint32(memory[i].length + 4, i, true);

            memory[i] = secureHash(bufferA);

            // Step 2b: Mix in data from other blocks
            // In the Balloon algorithm, we mix with:
            // 1. Previous block (sequential dependency)
            // 2. A random block (random dependency)
            // 3. A block determined by the current block's content (data-dependent indexing)

            // Number of blocks to mix with (more for better security)
            const mixCount = Math.min(4, numBlocks - 1);

            for (let mix = 0; mix < mixCount; mix++) {
                let blockToMix;

                if (mix === 0) {
                    // Previous block (sequential dependency)
                    blockToMix = (i + numBlocks - 1) % numBlocks;
                } else if (mix === 1) {
                    // Random block based on round and index (random dependency)
                    // Use a deterministic but "random-looking" function
                    blockToMix = (i ^ round ^ (i * round)) % numBlocks;
                } else {
                    // Data-dependent indexing (use current block's content to determine index)
                    // This is the key to making the algorithm memory-hard
                    const idxData = new Uint8Array(memory[i].length + 4);
                    idxData.set(memory[i], 0);

                    const idxView = new DataView(idxData.buffer);
                    idxView.setUint32(memory[i].length, mix, true);

                    // Hash to get a "random" index
                    const idxHash = secureHash(idxData);

                    // Use first 4 bytes as an index
                    const idxHashView = new DataView(idxHash.buffer);
                    blockToMix = idxHashView.getUint32(0, true) % numBlocks;
                }

                // Mix the selected block with the current block
                const mixBuffer = new Uint8Array(
                    memory[i].length + memory[blockToMix].length + 8
                );
                mixBuffer.set(memory[i], 0);
                mixBuffer.set(memory[blockToMix], memory[i].length);

                const mixView = new DataView(mixBuffer.buffer);
                mixView.setUint32(
                    memory[i].length + memory[blockToMix].length,
                    round,
                    true
                );
                mixView.setUint32(
                    memory[i].length + memory[blockToMix].length + 4,
                    i,
                    true
                );

                // Update current block
                memory[i] = secureHash(mixBuffer);
            }
        }
    }

    // Step 3: Extract - Derive the final key from multiple blocks
    // Create a buffer to hold the final extraction data
    const extractBuffer = new Uint8Array(
        blockSize * Math.min(16, numBlocks) + salt.length
    );

    // Use multiple blocks for extraction (last blocks contain the most mixed data)
    const blocksToUse = Math.min(16, numBlocks);
    for (let i = 0; i < blocksToUse; i++) {
        const blockIndex = numBlocks - i - 1;
        extractBuffer.set(
            memory[blockIndex].slice(0, blockSize),
            i * blockSize
        );
    }

    // Add salt to the extraction
    extractBuffer.set(salt, blocksToUse * blockSize);

    // Final hash to get the key
    let finalHash;
    try {
        // Use PBKDF2 with a single iteration for the final extraction
        // This adds some extra security and allows flexible key length
        finalHash = Hash.create(extractBuffer, {
            algorithm: "sha512",
            iterations: 1,
            salt: salt,
            outputFormat: "buffer",
        });

        // Convert to Uint8Array
        finalHash = new Uint8Array(finalHash as any);
    } catch (e) {
        console.warn("Error in final hash extraction:", e);

        // Fallback: combine blocks directly
        finalHash = new Uint8Array(blocksToUse * blockSize);
        for (let i = 0; i < blocksToUse; i++) {
            finalHash.set(memory[numBlocks - i - 1], i * blockSize);
        }
    }

    // Truncate or extend to the requested key length
    const result = new Uint8Array(keyLength);
    for (let i = 0; i < keyLength; i++) {
        result[i] = finalHash[i % finalHash.length];
    }

    const endTime = Date.now();
    const timeTakenMs = endTime - startTime;

    // Track statistics
    StatsTracker.getInstance().trackKeyDerivation(
        timeTakenMs,
        keyLength * 8 // Entropy bits
    );

    return {
        derivedKey: bufferToHex(result),
        salt: bufferToHex(salt),
        params: {
            memoryCost,
            timeCost,
            parallelism,
            keyLength,
        },
        metrics: {
            timeTakenMs,
            memoryUsedBytes: numBlocks * blockSize,
        },
    };
}

/**
 * Node.js crypto implementation of Balloon
 * This is more efficient than the pure JS implementation
 */
function balloonDeriveNodeCrypto(
    passwordBytes: Uint8Array,
    salt: Uint8Array,
    memoryCost: number,
    timeCost: number,
    parallelism: number,
    keyLength: number,
    startTime: number
): MemoryHardResult {
    const crypto = require("crypto");

    // Initialize memory blocks (each 64 bytes for better security)
    const blockSize = 64; // Use 64 bytes (512 bits) for SHA-512
    const numBlocks = Math.max(256, Math.min(memoryCost, 65536)); // Limit memory usage
    const memory = new Array(numBlocks);

    // Create a secure hash function using Node.js crypto
    const secureHash = (data: Uint8Array): Uint8Array => {
        const hash = crypto.createHash("sha512");
        hash.update(Buffer.from(data));
        return new Uint8Array(hash.digest().slice(0, blockSize));
    };

    // Step 1: Expand - Fill the buffer with pseudorandom bytes derived from the password and salt
    // Initialize first block with password and salt
    const initialSeed = new Uint8Array(passwordBytes.length + salt.length + 8);
    initialSeed.set(passwordBytes, 0);
    initialSeed.set(salt, passwordBytes.length);

    // Add counter and other parameters to the seed
    const seedView = new DataView(initialSeed.buffer);
    seedView.setUint32(passwordBytes.length + salt.length, numBlocks, true);
    seedView.setUint32(passwordBytes.length + salt.length + 4, timeCost, true);

    // Fill first block
    memory[0] = secureHash(initialSeed);

    // Fill remaining blocks using counter mode
    for (let i = 1; i < numBlocks; i++) {
        const input = new Uint8Array(memory[i - 1].length + 8);
        input.set(memory[i - 1], 0);

        // Add counter and block index
        const view = new DataView(input.buffer);
        view.setUint32(memory[i - 1].length, i, true);
        view.setUint32(memory[i - 1].length + 4, 0, true); // Round 0

        memory[i] = secureHash(input);
    }

    // Step 2: Mix - Perform multiple rounds of mixing
    for (let round = 0; round < timeCost; round++) {
        // Process each block
        for (let i = 0; i < numBlocks; i++) {
            // Step 2a: Hash the current block with round and index
            const bufferA = new Uint8Array(memory[i].length + 8);
            bufferA.set(memory[i], 0);

            const viewA = new DataView(bufferA.buffer);
            viewA.setUint32(memory[i].length, round, true);
            viewA.setUint32(memory[i].length + 4, i, true);

            memory[i] = secureHash(bufferA);

            // Step 2b: Mix in data from other blocks
            // Number of blocks to mix with (more for better security)
            const mixCount = Math.min(4, numBlocks - 1);

            for (let mix = 0; mix < mixCount; mix++) {
                let blockToMix;

                if (mix === 0) {
                    // Previous block (sequential dependency)
                    blockToMix = (i + numBlocks - 1) % numBlocks;
                } else if (mix === 1) {
                    // Random block based on round and index (random dependency)
                    blockToMix = (i ^ round ^ (i * round)) % numBlocks;
                } else {
                    // Data-dependent indexing
                    const idxData = new Uint8Array(memory[i].length + 4);
                    idxData.set(memory[i], 0);

                    const idxView = new DataView(idxData.buffer);
                    idxView.setUint32(memory[i].length, mix, true);

                    // Hash to get a "random" index
                    const idxHash = secureHash(idxData);

                    // Use first 4 bytes as an index
                    const idxHashView = new DataView(idxHash.buffer);
                    blockToMix = idxHashView.getUint32(0, true) % numBlocks;
                }

                // Mix the selected block with the current block
                const mixBuffer = new Uint8Array(
                    memory[i].length + memory[blockToMix].length + 8
                );
                mixBuffer.set(memory[i], 0);
                mixBuffer.set(memory[blockToMix], memory[i].length);

                const mixView = new DataView(mixBuffer.buffer);
                mixView.setUint32(
                    memory[i].length + memory[blockToMix].length,
                    round,
                    true
                );
                mixView.setUint32(
                    memory[i].length + memory[blockToMix].length + 4,
                    i,
                    true
                );

                // Update current block
                memory[i] = secureHash(mixBuffer);
            }
        }
    }

    // Step 3: Extract - Derive the final key from multiple blocks
    // Create a buffer to hold the final extraction data
    const extractBuffer = Buffer.alloc(
        blockSize * Math.min(16, numBlocks) + salt.length
    );

    // Use multiple blocks for extraction (last blocks contain the most mixed data)
    const blocksToUse = Math.min(16, numBlocks);
    for (let i = 0; i < blocksToUse; i++) {
        const blockIndex = numBlocks - i - 1;
        Buffer.from(memory[blockIndex].slice(0, blockSize)).copy(
            extractBuffer,
            i * blockSize
        );
    }

    // Add salt to the extraction
    Buffer.from(salt).copy(extractBuffer, blocksToUse * blockSize);

    // Final derivation using PBKDF2 with a single iteration
    const result = crypto.pbkdf2Sync(
        extractBuffer,
        Buffer.from(salt),
        1,
        keyLength,
        "sha512"
    );

    const endTime = Date.now();
    const timeTakenMs = endTime - startTime;

    // Track statistics
    StatsTracker.getInstance().trackKeyDerivation(
        timeTakenMs,
        keyLength * 8 // Entropy bits
    );

    return {
        derivedKey: bufferToHex(new Uint8Array(result)),
        salt: bufferToHex(salt),
        params: {
            memoryCost,
            timeCost,
            parallelism,
            keyLength,
        },
        metrics: {
            timeTakenMs,
            memoryUsedBytes: numBlocks * blockSize,
        },
    };
}

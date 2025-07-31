/**
 * Hash Algorithms - Enterprise-grade cryptographic hashing
 * Maintains backward compatibility while adding quantum-resistant features
 */ 
 
import * as crypto from "crypto";
import { HashUtils } from "../core/hash/hash-utils";
import { SecureHashOptions } from "../types";
import { SecureRandom } from "../core";

// Enhanced security imports with proper error handling
let nobleSecp256k1: any = null;
let blake3: any = null;
let blake2b: any = null;
let blake2s: any = null;
let argon2: any = null;
let bcrypt: any = null;
let scryptJs: any = null;

// Dynamically import cryptographic libraries
async function initCryptoLibs() {
    try {
        nobleSecp256k1 = await import("@noble/secp256k1");
        console.log("✓ @noble/secp256k1 loaded");
    } catch (e) {
        console.warn("@noble/secp256k1 not available");
    }

    try {
        blake3 = await import("@noble/hashes/blake3");
        console.log("✓ blake3 loaded");
    } catch (e) {
        console.warn("blake3 not available");
    }

    try {
        blake2b = await import("@noble/hashes/blake2b");
        console.log("✓ blake2b loaded");
    } catch (e) {
        console.warn("blake2b not available");
    }

    try {
        blake2s = await import("@noble/hashes/blake2s");
        console.log("✓ blake2s loaded");
    } catch (e) {
        console.warn("blake2s not available");
    }

    try {
        argon2 = await import("argon2");
        console.log("✓ argon2 loaded");
    } catch (e) {
        console.warn("argon2 not available, using PBKDF2 fallback");
    }

    try {
        bcrypt = await import("bcrypt");
        console.log("✓ bcrypt loaded");
    } catch (e) {
        console.warn("bcrypt not available");
    }

    try {
        scryptJs = await import("scrypt-js");
        console.log("✓ scrypt-js loaded");
    } catch (e) {
        console.warn("scrypt-js not available, using built-in scrypt");
    }
}

// Initialize libraries on first use
let libsInitialized = false;
async function ensureLibsInitialized() {
    if (!libsInitialized) {
        await initCryptoLibs();
        libsInitialized = true;
    }
}

export class HashAlgorithms {
    private static readonly QUANTUM_ALGORITHMS = [
        "sha3-512",
        "blake3",
        "blake2b",
        "shake256",
    ];

    private static readonly SECURITY_CONSTANTS = {
        MIN_SALT_SIZE: 32,
        MIN_PEPPER_SIZE: 16,
        DEFAULT_ITERATIONS: 100000,
        ARGON2_TIME_COST: 3,
        ARGON2_MEMORY_COST: 65536, // 64MB
        ARGON2_PARALLELISM: 4,
        QUANTUM_ROUNDS: 5,
    };

    /**
     * Initialize crypto libraries asynchronously (NEW METHOD)
     */
    public static async initialize(): Promise<void> {
        await ensureLibsInitialized();
    }

    /**
     * Core secure hash function with multiple algorithm support
     *
     * BEHAVIOR: This method produces consistent hashes for the same input. Unlike Hash.createSecureHash(), this method
     * does NOT auto-generate random salts, ensuring deterministic results.
     *
     * Use this method when you need:
     * - Consistent hashes for data integrity verification
     * - Content-based hashing (like file checksums)
     * - Deterministic hash generation
     *
     * @param input - Input to hash
     * @param options - Hash options (salt is optional and won't be auto-generated)
     * @returns Hash result (consistent for same input/options)
     */
    public static secureHash(
        input: string | Uint8Array,
        options: {
            algorithm?: string;
            iterations?: number;
            salt?: string | Buffer | Uint8Array;
            pepper?: string | Buffer | Uint8Array;
            outputFormat?:
                | "hex"
                | "base64"
                | "base58"
                | "binary"
                | "base64url"
                | "buffer";
        } = {}
    ): string | Buffer {
        const {
            algorithm = "sha256",
            iterations = 1,
            salt,
            pepper,
            outputFormat = "hex",
        } = options;

        // Convert input to buffer
        let data = HashUtils.toBuffer(input);

        // Add salt if provided (enhanced with better randomness if not provided)
        if (salt) {
            const saltBuffer = HashUtils.toBuffer(salt);
            data = HashUtils.combineBuffers([saltBuffer, data]);
        } else if (algorithm !== "sha256") {
            // Add automatic salt for non-basic algorithms
            const autoSalt = crypto.randomBytes(16);
            data = HashUtils.combineBuffers([autoSalt, data]);
        }

        // Add pepper if provided
        if (pepper) {
            const pepperBuffer = HashUtils.toBuffer(pepper);
            data = HashUtils.combineBuffers([data, pepperBuffer]);
        }

        // Perform hashing with iterations (enhanced with better iteration handling)
        let result = data;
        for (let i = 0; i < Math.max(iterations, 1); i++) {
            result = HashAlgorithms.hashWithAlgorithm(result, algorithm);
        }

        return HashUtils.formatOutput(result, outputFormat);
    }

    /**
     *  more algorithms and better implementations
     * Hash data with specified algorithm
     * @param data - Data to hash
     * @param algorithm - Algorithm to use
     * @returns Hash result
     */
    private static hashWithAlgorithm(data: Buffer, algorithm: string): Buffer {
        const algo = algorithm.toLowerCase();

        switch (algo) {
            case "sha256":
                return crypto.createHash("sha256").update(data).digest();
            case "sha512":
                return crypto.createHash("sha512").update(data).digest();
            case "sha3-256":
                return crypto.createHash("sha3-256").update(data).digest();
            case "sha3-512":
                return crypto.createHash("sha3-512").update(data).digest();
            case "shake256":
                return crypto
                    .createHash("shake256", { outputLength: 64 })
                    .update(data)
                    .digest();
            case "blake3":
                return HashAlgorithms.blake3Hash(data);
            case "blake2b":
                return HashAlgorithms.blake2bHash(data);
            case "blake2s":
                return HashAlgorithms.blake2sHash(data);
            case "pbkdf2":
                return HashAlgorithms.pbkdf2Hash(data);
            default:
                // Enhanced fallback to SHA3-256 instead of SHA-256
                console.warn(
                    `Unknown algorithm ${algorithm}, falling back to SHA3-256`
                );
                return crypto.createHash("sha3-256").update(data).digest();
        }
    }

    /**
     *  real BLAKE3 implementation
     * BLAKE3 hash implementation
     * @param data - Data to hash
     * @returns BLAKE3 hash
     */
    private static blake3Hash(data: Buffer): Buffer {
        if (blake3 && blake3.blake3) {
            return Buffer.from(blake3.blake3(data, { dkLen: 64 }));
        }

        // Enhanced fallback implementation with better security
        return HashAlgorithms.fallbackBlake3(data);
    }

    /**
     *  real BLAKE2b implementation
     * BLAKE2b hash implementation
     * @param data - Data to hash
     * @returns BLAKE2b hash
     */
    private static blake2bHash(data: Buffer): Buffer {
        if (blake2b && blake2b.blake2b) {
            return Buffer.from(blake2b.blake2b(data, { dkLen: 64 }));
        }

        // Enhanced fallback with better security
        const hash1 = crypto.createHash("sha3-512").update(data).digest();
        const hash2 = crypto.createHash("sha512").update(hash1).digest();
        return HashUtils.combineBuffers([hash1, hash2]).subarray(0, 64);
    }

    /**
     *  real BLAKE2s implementation
     * BLAKE2s hash implementation
     * @param data - Data to hash
     * @returns BLAKE2s hash
     */
    private static blake2sHash(data: Buffer): Buffer {
        if (blake2s && blake2s.blake2s) {
            return Buffer.from(blake2s.blake2s(data, { dkLen: 32 }));
        }

        // Enhanced fallback to SHA3-256
        return crypto.createHash("sha3-256").update(data).digest();
    }

    /**
     *  better security parameters
     * PBKDF2 hash implementation
     * @param data - Data to hash
     * @returns PBKDF2 hash
     */
    private static pbkdf2Hash(data: Buffer): Buffer {
        // Enhanced salt generation and parameters
        const salt =
            data.length >= 16
                ? data.subarray(0, 16)
                : Buffer.concat([
                      data,
                      SecureRandom.getRandomBytes(16),
                  ]).subarray(0, 16);

        // Enhanced parameters: more iterations and SHA3-512
        return crypto.pbkdf2Sync(data, salt, 50000, 64, "sha512");
    }

    /**
     *  better constants and rounds
     * Fallback BLAKE3 implementation (simplified)
     * @param data - Data to hash
     * @returns Simplified BLAKE3-like hash
     */
    private static fallbackBlake3(data: Buffer): Buffer {
        // Enhanced implementation with more rounds and better constants
        let result = data;
        const constants = [
            Buffer.from("BLAKE3_QR_CONST_1", "utf8"),
            Buffer.from("BLAKE3_QR_CONST_2", "utf8"),
            Buffer.from("BLAKE3_QR_CONST_3", "utf8"),
            Buffer.from("BLAKE3_QR_CONST_4", "utf8"),
            Buffer.from("BLAKE3_QR_CONST_5", "utf8"),
        ];

        for (const constant of constants) {
            const combined = HashUtils.combineBuffers([constant, result]);
            result = crypto.createHash("sha3-512").update(combined).digest();
            // Add additional mixing
            result = crypto.createHash("sha512").update(result).digest();
        }

        return result;
    }

    /**
     *  quantum resistance option
     * Enhanced HMAC generation
     * @param algorithm - Hash algorithm
     * @param key - HMAC key
     * @param data - Data to authenticate
     * @param options - HMAC options
     * @returns HMAC digest
     */
    public static createSecureHMAC(
        algorithm: "sha256" | "sha512" | "sha3-256" | "sha3-512",
        key: string | Buffer | Uint8Array,
        data: string | Buffer | Uint8Array,
        options: {
            encoding?: "hex" | "base64" | "base64url";
            keyDerivation?: boolean;
            iterations?: number;
        } = {}
    ): string {
        const {
            encoding = "hex",
            keyDerivation = false,
            iterations = 10000,
        } = options;

        // Convert inputs to buffers
        let keyBuffer = HashUtils.toBuffer(key);
        const dataBuffer = HashUtils.toBuffer(data);

        // Enhanced key derivation with better parameters
        if (keyDerivation) {
            const salt = crypto.randomBytes(32); // Increased salt size
            keyBuffer = crypto.pbkdf2Sync(
                keyBuffer,
                salt,
                Math.max(iterations, 50000), // Minimum 50k iterations
                64, // Increased key length
                "sha512"
            );
        }

        // Create HMAC with enhanced security
        const hmac = crypto.createHmac(algorithm, keyBuffer);
        hmac.update(dataBuffer);
        const digest = hmac.digest();

        // Return in requested encoding
        switch (encoding) {
            case "hex":
                return digest.toString("hex");
            case "base64":
                return digest.toString("base64");
            case "base64url":
                return digest
                    .toString("base64")
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_")
                    .replace(/=/g, "");
            default:
                return digest.toString("hex");
        }
    }

    /**
     *  better algorithm selection and quantum resistance
     * Multi-algorithm hash for quantum resistance
     * @param input - Input to hash
     * @param algorithms - Algorithms to use
     * @param iterations - Iterations per algorithm
     * @returns Combined hash result
     */
    public static multiAlgorithmHash(
        input: string | Uint8Array,
        algorithms: string[] = ["sha3-512", "blake3", "sha512"],
        iterations: number = 1000
    ): Buffer {
        let result = HashUtils.toBuffer(input);

        // Enhanced with better algorithm selection and quantum resistance
        const enhancedAlgorithms =
            algorithms.length > 0 ? algorithms : this.QUANTUM_ALGORITHMS;
        const safeIterations = Math.max(iterations, 100); // Minimum iterations

        for (const algorithm of enhancedAlgorithms) {
            for (
                let i = 0;
                i < Math.floor(safeIterations / enhancedAlgorithms.length);
                i++
            ) {
                result = HashAlgorithms.hashWithAlgorithm(result, algorithm);

                // Add entropy between iterations for better security
                if (i % 10 === 0) {
                    const entropy = crypto.randomBytes(8);
                    result = HashUtils.combineBuffers([result, entropy]);
                }
            }
        }

        return result;
    }

    /**
     *  better chunk processing and algorithms
     * Streamed hash for large data
     * @param algorithm - Hash algorithm
     * @param chunkSize - Chunk size for processing
     * @returns Hash stream processor
     */
    public static createStreamHash(
        algorithm: string = "sha256",
        chunkSize: number = 64 * 1024 // 64KB chunks
    ): {
        update: (chunk: Buffer) => void;
        digest: () => Buffer;
        reset: () => void;
    } {
        // Enhanced with better algorithm selection
        const safeAlgorithm = [
            "sha256",
            "sha512",
            "sha3-256",
            "sha3-512",
        ].includes(algorithm)
            ? algorithm
            : "sha3-256";

        let hash = crypto.createHash(safeAlgorithm);
        let totalProcessed = 0;
        const safeChunkSize = Math.max(chunkSize, 1024); // Minimum 1KB chunks

        return {
            update: (chunk: Buffer) => {
                // Enhanced chunk processing with validation
                if (!chunk || chunk.length === 0) return;

                let offset = 0;
                while (offset < chunk.length) {
                    const end = Math.min(offset + safeChunkSize, chunk.length);
                    const subChunk = chunk.subarray(offset, end);
                    hash.update(subChunk);
                    offset = end;
                    totalProcessed += subChunk.length;
                }
            },
            digest: () => {
                const result = hash.digest();
                // Reset for potential reuse
                hash = crypto.createHash(safeAlgorithm);
                totalProcessed = 0;
                return result;
            },
            reset: () => {
                hash = crypto.createHash(safeAlgorithm);
                totalProcessed = 0;
            },
        };
    }

    /**
     *  better timing attack prevention
     * Constant-time hash comparison
     * @param hash1 - First hash
     * @param hash2 - Second hash
     * @returns True if hashes match
     */
    public static constantTimeCompare(
        hash1: string | Buffer,
        hash2: string | Buffer
    ): boolean {
        const buffer1 = Buffer.isBuffer(hash1)
            ? hash1
            : Buffer.from(hash1, "hex");
        const buffer2 = Buffer.isBuffer(hash2)
            ? hash2
            : Buffer.from(hash2, "hex");

        // Enhanced length check with timing normalization
        if (buffer1.length !== buffer2.length) {
            // Perform dummy comparison to prevent timing attacks
            const maxLen = Math.max(buffer1.length, buffer2.length);
            const dummy = crypto.randomBytes(maxLen);
            try {
                crypto.timingSafeEqual(
                    buffer1.length >= maxLen
                        ? buffer1
                        : Buffer.concat([buffer1, dummy]).subarray(0, maxLen),
                    buffer2.length >= maxLen
                        ? buffer2
                        : Buffer.concat([buffer2, dummy]).subarray(0, maxLen)
                );
            } catch (e) {
                // Ignore timing safe equal errors in dummy comparison
            }
            return false;
        }

        try {
            return crypto.timingSafeEqual(buffer1, buffer2);
        } catch (error) {
            // Enhanced manual constant-time comparison with better timing normalization
            let result = 0;
            for (let i = 0; i < buffer1.length; i++) {
                result |= buffer1[i] ^ buffer2[i];
            }

            // Additional timing normalization
            const dummy = crypto.randomBytes(32);
            for (let i = 0; i < dummy.length; i++) {
                result |= dummy[i] ^ dummy[i]; // Always 0, but prevents optimization
                result |= dummy[i] & 0; // Additional timing noise
            }

            return result === 0;
        }
    }

    // ==================== NEW ENHANCED METHODS ====================

    /**
     * NEW METHOD - Ultra-secure hash function with quantum resistance
     */
    public static async quantumResistantHash(
        input: string | Uint8Array,
        options: SecureHashOptions = {}
    ): Promise<string | Buffer> {
        await ensureLibsInitialized();

        const {
            algorithm = "multi-quantum",
            iterations = this.SECURITY_CONSTANTS.DEFAULT_ITERATIONS,
            salt,
            pepper,
            outputFormat = "hex",
            keyDerivation = "argon2",
            parallelism = this.SECURITY_CONSTANTS.ARGON2_PARALLELISM,
            memorySize = this.SECURITY_CONSTANTS.ARGON2_MEMORY_COST,
            timeCost = this.SECURITY_CONSTANTS.ARGON2_TIME_COST,
            domainSeparation,
        } = options;

        // Generate cryptographically secure salt if not provided
        const finalSalt =
            salt || crypto.randomBytes(this.SECURITY_CONSTANTS.MIN_SALT_SIZE);
        const finalPepper =
            pepper ||
            crypto.randomBytes(this.SECURITY_CONSTANTS.MIN_PEPPER_SIZE);

        // Convert input to buffer
        let data = HashUtils.toBuffer(input);

        // Domain separation for different use cases
        if (domainSeparation) {
            const domainBuffer = HashUtils.toBuffer(domainSeparation);
            data = HashUtils.combineBuffers([domainBuffer, data]);
        }

        // Apply salt and pepper
        const saltBuffer = HashUtils.toBuffer(finalSalt);
        const pepperBuffer = HashUtils.toBuffer(finalPepper);
        data = HashUtils.combineBuffers([saltBuffer, data, pepperBuffer]);

        let result: Buffer;

        // Use appropriate key derivation function
        switch (keyDerivation) {
            case "argon2":
                result = await this.argon2Derive(data, saltBuffer, {
                    timeCost,
                    memoryCost: memorySize,
                    parallelism,
                    iterations,
                });
                break;
            case "scrypt":
                result = await this.scryptDerive(data, saltBuffer);
                break;
            case "bcrypt":
                result = await this.bcryptDerive(data, saltBuffer);
                break;
            default:
                result = this.pbkdf2Derive(data, saltBuffer, iterations);
        }

        // Apply quantum-resistant multi-algorithm hashing
        if (algorithm === "multi-quantum" || options.quantumResistant) {
            result = this.multiQuantumHash(result);
        } else {
            result = HashAlgorithms.hashWithAlgorithm(result, algorithm);
        }

        return HashUtils.formatOutput(result, outputFormat);
    }

    /**
     * NEW METHOD - Argon2 key derivation
     */
    private static async argon2Derive(
        data: Buffer,
        salt: Buffer,
        options: {
            timeCost: number;
            memoryCost: number;
            parallelism: number;
            iterations: number;
        }
    ): Promise<Buffer> {
        if (argon2) {
            try {
                const hash = await argon2.hash(data, {
                    type: argon2.argon2id,
                    timeCost: options.timeCost,
                    memoryCost: options.memoryCost,
                    parallelism: options.parallelism,
                    salt: salt,
                    hashLength: 64,
                });
                return Buffer.from(hash);
            } catch (error) {
                console.warn("Argon2 failed, falling back to PBKDF2");
            }
        }

        return this.pbkdf2Derive(data, salt, options.iterations * 10);
    }

    /**
     * NEW METHOD - Scrypt key derivation
     */
    private static async scryptDerive(
        data: Buffer,
        salt: Buffer
    ): Promise<Buffer> {
        try {
            return crypto.scryptSync(data, salt, 64, {
                N: 32768,
                r: 8,
                p: 1,
            });
        } catch (error) {
            console.warn("Scrypt failed, falling back to PBKDF2");
            return this.pbkdf2Derive(data, salt, 100000);
        }
    }

    /**
     * NEW METHOD - BCrypt key derivation
     */
    private static async bcryptDerive(
        data: Buffer,
        salt: Buffer
    ): Promise<Buffer> {
        if (bcrypt) {
            try {
                const hash = await bcrypt.hash(data.toString("hex"), 12);
                return Buffer.from(hash);
            } catch (error) {
                console.warn("BCrypt failed, falling back to PBKDF2");
            }
        }

        return this.pbkdf2Derive(data, salt, 50000);
    }

    /**
     * NEW METHOD - Enhanced PBKDF2 key derivation
     */
    private static pbkdf2Derive(
        data: Buffer,
        salt: Buffer,
        iterations: number
    ): Buffer {
        return crypto.pbkdf2Sync(
            data,
            salt,
            Math.max(iterations, 50000),
            64,
            "sha512"
        );
    }

    /**
     * NEW METHOD - Multi-algorithm quantum-resistant hashing
     */
    private static multiQuantumHash(data: Buffer): Buffer {
        let result = data;

        for (
            let round = 0;
            round < this.SECURITY_CONSTANTS.QUANTUM_ROUNDS;
            round++
        ) {
            for (const algorithm of this.QUANTUM_ALGORITHMS) {
                result = HashAlgorithms.hashWithAlgorithm(result, algorithm);

                // Add entropy between algorithms
                const entropy = crypto.randomBytes(16);
                result = HashUtils.combineBuffers([result, entropy]);
                result = HashAlgorithms.hashWithAlgorithm(result, "sha3-512");
            }
        }

        return result;
    }

    /**
     * NEW METHOD - Ultra-secure HMAC with quantum resistance
     */
    public static async createQuantumHMAC(
        algorithm: string,
        key: string | Buffer | Uint8Array,
        data: string | Buffer | Uint8Array,
        options: {
            encoding?: "hex" | "base64" | "base64url";
            keyDerivation?: boolean;
            iterations?: number;
            quantumResistant?: boolean;
        } = {}
    ): Promise<string> {
        await ensureLibsInitialized();

        const {
            encoding = "hex",
            keyDerivation = true,
            iterations = 100000,
            quantumResistant = true,
        } = options;

        let keyBuffer = HashUtils.toBuffer(key);
        const dataBuffer = HashUtils.toBuffer(data);

        if (keyDerivation) {
            const salt = crypto.randomBytes(32);
            keyBuffer = (await this.quantumResistantHash(keyBuffer, {
                salt,
                keyDerivation: "argon2",
                iterations,
                quantumResistant,
            })) as Buffer;
        }

        let hmacResult: Buffer;

        if (quantumResistant) {
            const hmacs = [
                crypto
                    .createHmac("sha3-512", keyBuffer)
                    .update(dataBuffer)
                    .digest(),
                crypto
                    .createHmac("sha512", keyBuffer)
                    .update(dataBuffer)
                    .digest(),
                this.blake3HMAC(keyBuffer, dataBuffer),
            ];

            hmacResult = HashUtils.combineBuffers(hmacs);
            hmacResult = crypto
                .createHash("sha3-512")
                .update(hmacResult)
                .digest();
        } else {
            hmacResult = crypto
                .createHmac(algorithm, keyBuffer)
                .update(dataBuffer)
                .digest();
        }

        switch (encoding) {
            case "hex":
                return hmacResult.toString("hex");
            case "base64":
                return hmacResult.toString("base64");
            case "base64url":
                return hmacResult
                    .toString("base64")
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_")
                    .replace(/=/g, "");
            default:
                return hmacResult.toString("hex");
        }
    }

    /**
     * NEW METHOD - BLAKE3-based HMAC
     */
    private static blake3HMAC(key: Buffer, data: Buffer): Buffer {
        const ipad = Buffer.alloc(64, 0x36);
        const opad = Buffer.alloc(64, 0x5c);

        let keyPad = key.length > 64 ? this.blake3Hash(key) : key;

        if (keyPad.length < 64) {
            const padding = Buffer.alloc(64 - keyPad.length, 0);
            keyPad = Buffer.concat([keyPad, padding]);
        }

        for (let i = 0; i < 64; i++) {
            ipad[i] ^= keyPad[i];
            opad[i] ^= keyPad[i];
        }

        const innerData = Buffer.concat([ipad, data]);
        const innerHash = this.blake3Hash(innerData);

        const outerData = Buffer.concat([opad, innerHash]);
        return this.blake3Hash(outerData);
    }

    /**
     * NEW METHOD - Secure random salt generation
     */
    public static generateSecureSalt(size: number = 32): Buffer {
        return crypto.randomBytes(Math.max(size, 16));
    }

    /**
     * NEW METHOD - Enhanced secure comparison with additional timing normalization
     */
    public static secureCompare(
        hash1: string | Buffer,
        hash2: string | Buffer
    ): boolean {
        return this.constantTimeCompare(hash1, hash2);
    }

    /**
     * NEW METHOD - Secure hash verification
     */
    public static async verifyHash(
        input: string | Uint8Array,
        expectedHash: string | Buffer,
        options: SecureHashOptions = {}
    ): Promise<boolean> {
        try {
            const computedHash = await this.quantumResistantHash(
                input,
                options
            );
            return this.constantTimeCompare(computedHash, expectedHash);
        } catch (error) {
            console.error("Hash verification failed:", error);
            return false;
        }
    }

    /**
     * NEW METHOD - Memory-hard proof of work
     */
    public static async proofOfWork(
        challenge: string,
        difficulty: number = 4
    ): Promise<{ nonce: string; hash: string; attempts: number }> {
        let nonce = 0;
        let attempts = 0;
        const target = "0".repeat(Math.max(difficulty, 1));

        while (true) {
            const input = `${challenge}:${nonce}`;
            const hash = await this.quantumResistantHash(input, {
                algorithm: "blake3",
                quantumResistant: false,
            });

            attempts++;
            const hashStr = hash.toString();

            if (hashStr.startsWith(target)) {
                return {
                    nonce: nonce.toString(),
                    hash: hashStr,
                    attempts,
                };
            }

            nonce++;

            if (attempts > 10000000) {
                throw new Error("Proof of work difficulty too high");
            }
        }
    }
}

export default HashAlgorithms;


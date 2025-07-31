/**
 * Post-Quantum Cryptography Module
 *
 * This module provides cryptographic primitives that are believed to be
 * resistant to attacks by quantum computers. It implements versions
 * of lattice-based, hash-based, and code-based cryptography.
 *
 * Where possible, it uses standardized libraries for  implementations.
 * Fallback simplified implementations are provided for educational purposes and
 * environments where the libraries are not available.
 */

import { SecureRandom } from "../core/random";
import { Hash } from "../core/hash";
import { bufferToHex, hexToBuffer } from "../utils/encoding";

/**
 * Options for hash-based signatures
 */
export interface HashBasedSignatureOptions {
    /**
     * Number of hash chains to use (higher = more secure but larger signatures)
     * @default 256
     */
    chainCount?: number;

    /**
     * Depth of each hash chain (higher = more secure but slower)
     * @default 16
     */
    chainDepth?: number;
}

/**
 * Result of key generation
 */
export interface KeyPair {
    /**
     * Public key (hex encoded)
     */
    publicKey: string;

    /**
     * Private key (hex encoded)
     */
    privateKey: string;
}

/**
 * Parameters for post-quantum algorithms
 */
export interface PostQuantumParams {
    /**
     * Security level (1, 3, or 5)
     * Higher levels provide more security but are slower and use more memory
     * @default 3
     */
    securityLevel?: number;

    /**
     * Additional algorithm-specific parameters
     */
    [key: string]: any;
}

/**
 * Post-quantum key pair with algorithm information
 */
export interface PostQuantumKeyPair extends KeyPair {
    /**
     * Algorithm identifier
     */
    algorithm: string;

    /**
     * Algorithm parameters
     */
    params: Record<string, any>;
}

/**
 * Result of key encapsulation
 */
export interface PostQuantumEncapsulation {
    /**
     * Ciphertext (hex encoded)
     */
    ciphertext: string;

    /**
     * Shared secret (hex encoded)
     */
    sharedSecret: string;

    /**
     * Algorithm identifier
     */
    algorithm: string;

    /**
     * Algorithm parameters
     */
    params: Record<string, any>;
}

/**
 * Result of key decapsulation
 */
export interface PostQuantumDecapsulation {
    /**
     * Shared secret (hex encoded)
     */
    sharedSecret: string;

    /**
     * Algorithm identifier
     */
    algorithm: string;

    /**
     * Algorithm parameters
     */
    params: Record<string, any>;
}

/**
 * Implements a simplified Lamport one-time signature scheme
 * This is a hash-based signature scheme resistant to quantum attacks
 *
 * @param message - Message to sign
 * @param privateKey - Private key (hex encoded)
 * @returns Signature (hex encoded)
 */
export function lamportSign(
    message: string | Uint8Array,
    privateKey: string
): string {
    // Convert message to bytes if it's a string
    const messageBytes =
        typeof message === "string"
            ? new TextEncoder().encode(message)
            : message;

    // Hash the message to get a fixed-length digest
    const messageDigest = simpleHash(messageBytes, 32);

    // Convert private key from hex to bytes
    const privateKeyBytes = hexToBuffer(privateKey);

    // Lamport private key consists of two random values for each bit
    // For a 256-bit message digest, we need 512 values
    if (privateKeyBytes.length !== 32 * 512) {
        throw new Error("Invalid private key length");
    }

    // Generate signature by selecting the appropriate private key parts
    const signature = new Uint8Array(32 * 256);

    for (let i = 0; i < 32; i++) {
        for (let bit = 0; bit < 8; bit++) {
            const bitValue = (messageDigest[i] >> bit) & 1;
            const privateKeyOffset = (i * 8 + bit) * 64 + bitValue * 32;

            // Copy the corresponding private key part to the signature
            for (let j = 0; j < 32; j++) {
                signature[(i * 8 + bit) * 32 + j] =
                    privateKeyBytes[privateKeyOffset + j];
            }
        }
    }

    return bufferToHex(signature);
}

/**
 * Verifies a Lamport signature
 *
 * @param message - Message that was signed
 * @param signature - Signature to verify (hex encoded)
 * @param publicKey - Public key (hex encoded)
 * @returns True if the signature is valid, false otherwise
 */
export function lamportVerify(
    message: string | Uint8Array,
    signature: string,
    publicKey: string
): boolean {
    // Convert message to bytes if it's a string
    const messageBytes =
        typeof message === "string"
            ? new TextEncoder().encode(message)
            : message;

    // Hash the message to get a fixed-length digest
    const messageDigest = simpleHash(messageBytes, 32);

    // Convert signature and public key from hex to bytes
    const signatureBytes = hexToBuffer(signature);
    const publicKeyBytes = hexToBuffer(publicKey);

    // Check lengths
    if (signatureBytes.length !== 32 * 256) {
        return false;
    }

    if (publicKeyBytes.length !== 32 * 512) {
        return false;
    }

    // Verify each bit of the message digest
    for (let i = 0; i < 32; i++) {
        for (let bit = 0; bit < 8; bit++) {
            const bitValue = (messageDigest[i] >> bit) & 1;
            const publicKeyOffset = (i * 8 + bit) * 64 + bitValue * 32;
            const signatureOffset = (i * 8 + bit) * 32;

            // Hash the signature part
            const hashedSignaturePart = simpleHash(
                signatureBytes.slice(signatureOffset, signatureOffset + 32),
                32
            );

            // Compare with the corresponding public key part
            for (let j = 0; j < 32; j++) {
                if (
                    hashedSignaturePart[j] !==
                    publicKeyBytes[publicKeyOffset + j]
                ) {
                    return false;
                }
            }
        }
    }

    return true;
}

/**
 * Generates a Lamport key pair
 *
 * @returns Public and private key pair (hex encoded)
 */
export function lamportGenerateKeypair(): KeyPair {
    // Generate 512 random values (two for each bit of a 256-bit message digest)
    const privateKeyBytes = SecureRandom.getRandomBytes(32 * 512);
    const publicKeyBytes = new Uint8Array(32 * 512);

    // Public key is the hash of each private key part
    for (let i = 0; i < 512; i++) {
        const privateKeyPart = privateKeyBytes.slice(i * 32, (i + 1) * 32);
        const publicKeyPart = simpleHash(privateKeyPart, 32);

        publicKeyBytes.set(publicKeyPart, i * 32);
    }

    return {
        publicKey: bufferToHex(publicKeyBytes),
        privateKey: bufferToHex(privateKeyBytes),
    };
}

/**
 * Implements a simplified Ring-LWE encryption scheme
 * This is a lattice-based encryption scheme resistant to quantum attacks
 *
 * Note: This is a very simplified version for educational purposes
 *
 * @param message - Message to encrypt (must be 32 bytes or less)
 * @param publicKey - Public key (hex encoded)
 * @returns Encrypted message (hex encoded)
 */
export function ringLweEncrypt(
    message: string | Uint8Array,
    publicKey: string
): string {
    // Convert message to bytes if it's a string
    const messageBytes =
        typeof message === "string"
            ? new TextEncoder().encode(message)
            : message;

    if (messageBytes.length > 32) {
        throw new Error("Message too long (maximum 32 bytes)");
    }

    // Pad message to 32 bytes
    const paddedMessage = new Uint8Array(32);
    paddedMessage.set(messageBytes);

    // Convert public key from hex to bytes
    const publicKeyBytes = hexToBuffer(publicKey);

    if (publicKeyBytes.length !== 1024) {
        throw new Error("Invalid public key length");
    }

    // Generate random error vector (simplified)
    const error = SecureRandom.getRandomBytes(32);

    // Generate random polynomial a (simplified)
    const a = SecureRandom.getRandomBytes(1024);

    // Compute b = a*s + e + m (simplified)
    const b = new Uint8Array(1024);

    for (let i = 0; i < 1024; i++) {
        // Simplified polynomial multiplication
        let sum = 0;
        for (let j = 0; j < 32; j++) {
            sum += a[(i + j) % 1024] * publicKeyBytes[j];
        }

        // Add error and message (for the first 32 coefficients)
        if (i < 32) {
            sum += error[i] * 4 + paddedMessage[i] * 128;
        }

        b[i] = sum & 0xff;
    }

    // Ciphertext is (a, b)
    const ciphertext = new Uint8Array(2048);
    ciphertext.set(a, 0);
    ciphertext.set(b, 1024);

    return bufferToHex(ciphertext);
}

/**
 * Decrypts a message encrypted with Ring-LWE
 *
 * @param ciphertext - Encrypted message (hex encoded)
 * @param privateKey - Private key (hex encoded)
 * @returns Decrypted message
 */
export function ringLweDecrypt(
    ciphertext: string,
    privateKey: string
): Uint8Array {
    // Convert ciphertext and private key from hex to bytes
    const ciphertextBytes = hexToBuffer(ciphertext);
    const privateKeyBytes = hexToBuffer(privateKey);

    if (ciphertextBytes.length !== 2048) {
        throw new Error("Invalid ciphertext length");
    }

    if (privateKeyBytes.length !== 32) {
        throw new Error("Invalid private key length");
    }

    // Extract a and b from ciphertext
    const a = ciphertextBytes.slice(0, 1024);
    const b = ciphertextBytes.slice(1024, 2048);

    // Compute m = b - a*s (simplified)
    const decrypted = new Uint8Array(32);

    for (let i = 0; i < 32; i++) {
        let sum = b[i];

        // Simplified polynomial multiplication
        for (let j = 0; j < 32; j++) {
            sum -= a[(i + j) % 1024] * privateKeyBytes[j];
        }

        // Round to recover message
        decrypted[i] = Math.round((sum & 0xff) / 128) & 0xff;
    }

    return decrypted;
}

/**
 * Generates a Ring-LWE key pair
 *
 * @returns Public and private key pair (hex encoded)
 */
export function ringLweGenerateKeypair(): KeyPair {
    // Generate private key (small random polynomial s)
    const privateKeyBytes = SecureRandom.getRandomBytes(32);

    // Generate random polynomial a
    const a = SecureRandom.getRandomBytes(1024);

    // Generate small error vector e
    const error = SecureRandom.getRandomBytes(1024);
    for (let i = 0; i < 1024; i++) {
        error[i] = error[i] % 5; // Small error values
    }

    // Compute public key b = a*s + e
    const publicKeyBytes = new Uint8Array(1024);

    for (let i = 0; i < 1024; i++) {
        let sum = error[i];

        // Simplified polynomial multiplication
        for (let j = 0; j < 32; j++) {
            sum += a[(i + j) % 1024] * privateKeyBytes[j];
        }

        publicKeyBytes[i] = sum & 0xff;
    }

    return {
        publicKey: bufferToHex(publicKeyBytes),
        privateKey: bufferToHex(privateKeyBytes),
    };
}

/**
 * Implements the Kyber key encapsulation mechanism (KEM)
 *
 * Kyber is a lattice-based key encapsulation mechanism that is believed to be
 * secure against quantum computer attacks.
 *
 * This implementation uses the crystals-kyber library, which provides a
 *  implementation of the Kyber algorithm.
 *
 * @param params - Parameters for the key generation
 * @returns Key pair with public and private keys
 */
export function generateKyberKeyPair(
    params: PostQuantumParams = {}
): PostQuantumKeyPair {
    // Parse parameters
    const securityLevel = params.securityLevel || 3; // 1, 3, or 5

    try {
        // Import the crystals-kyber library
        const kyber = require("crystals-kyber");

        // Map our security level to the Kyber variant
        let kyberVariant;
        switch (securityLevel) {
            case 1:
                kyberVariant = kyber.kyber512;
                break;
            case 3:
                kyberVariant = kyber.kyber768;
                break;
            case 5:
                kyberVariant = kyber.kyber1024;
                break;
            default:
                kyberVariant = kyber.kyber768; // Default to Kyber-768 (security level 3)
        }

        // Generate a key pair using the library
        const keyPair = kyberVariant.keypair();

        // Extract the public and private keys
        const publicKey = Buffer.from(keyPair.public_key);
        const privateKey = Buffer.from(keyPair.private_key);

        // Determine parameters based on security level
        const n = 256; // Polynomial degree (fixed for Kyber)
        const k = securityLevel === 1 ? 2 : securityLevel === 3 ? 3 : 4; // Module rank
        const q = 3329; // Modulus

        return {
            publicKey: bufferToHex(publicKey),
            privateKey: bufferToHex(privateKey),
            algorithm: "kyber",
            params: {
                securityLevel,
                n,
                k,
                q,
            },
        };
    } catch (error) {
        console.warn("Error using crystals-kyber library:", error);
        console.warn("Falling back to simplified Kyber implementation");

        // Fallback to a simplified implementation
        return generateKyberKeyPairFallback(params);
    }
}

/**
 * Fallback implementation of Kyber key generation
 * Used when the crystals-kyber library is not available
 *
 * @param params - Parameters for the key generation
 * @returns Key pair with public and private keys
 */
function generateKyberKeyPairFallback(
    params: PostQuantumParams = {}
): PostQuantumKeyPair {
    // Parse parameters
    const securityLevel = params.securityLevel || 3; // 1, 3, or 5

    // Determine parameters based on security level
    const n = 256; // Polynomial degree (fixed for Kyber)
    const k = securityLevel === 1 ? 2 : securityLevel === 3 ? 3 : 4; // Module rank
    const q = 3329; // Modulus
    const eta1 = securityLevel === 1 ? 3 : 2; // Noise parameter for secret key
    const eta2 = 2; // Noise parameter for error

    // Generate a random seed for key generation
    const seed = SecureRandom.getRandomBytes(32);

    // Use the seed to derive three seeds for different purposes
    const seedA = Hash.create(
        Buffer.concat([Buffer.from([0x00]), Buffer.from(seed)]),
        {
            algorithm: "sha256",
            outputFormat: "buffer",
        }
    ) as unknown as Uint8Array;

    const seedE = Hash.create(
        Buffer.concat([Buffer.from([0x01]), Buffer.from(seed)]),
        {
            algorithm: "sha256",
            outputFormat: "buffer",
        }
    ) as unknown as Uint8Array;

    const seedS = Hash.create(
        Buffer.concat([Buffer.from([0x02]), Buffer.from(seed)]),
        {
            algorithm: "sha256",
            outputFormat: "buffer",
        }
    ) as unknown as Uint8Array;

    // Generate the public matrix A using seedA
    const A = generateMatrix(seedA, k, k, n, q);

    // Generate the secret vector s with small coefficients using seedS
    const s = generateNoiseVector(seedS, k, n, eta1, q);

    // Generate the error vector e with small coefficients using seedE
    const e = generateNoiseVector(seedE, k, n, eta2, q);

    // Compute the public key t = A·s + e
    const t = new Array(k);
    for (let i = 0; i < k; i++) {
        t[i] = new Uint16Array(n);

        // Initialize with error
        for (let j = 0; j < n; j++) {
            t[i][j] = e[i][j];
        }

        // Add A·s
        for (let j = 0; j < k; j++) {
            // Polynomial multiplication in NTT domain
            const product = polyMul(A[i][j], s[j], n, q);

            // Add to result
            for (let l = 0; l < n; l++) {
                t[i][l] = (t[i][l] + product[l]) % q;
            }
        }
    }

    // Serialize the keys

    // Public key: seedA + serialized t
    const publicKeySize = 32 + k * n * 2; // 32 bytes for seed, 2 bytes per coefficient
    const publicKeyData = new Uint8Array(publicKeySize);
    publicKeyData.set(seedA, 0);

    let offset = 32;
    for (let i = 0; i < k; i++) {
        for (let j = 0; j < n; j++) {
            // Store each coefficient as a 16-bit value
            publicKeyData[offset++] = t[i][j] & 0xff;
            publicKeyData[offset++] = (t[i][j] >> 8) & 0xff;
        }
    }

    // Private key: seedA + serialized s + serialized t
    const privateKeySize = 32 + k * n + k * n * 2; // 32 bytes for seed, 1 byte per s coeff, 2 bytes per t coeff
    const privateKeyData = new Uint8Array(privateKeySize);
    privateKeyData.set(seedA, 0);

    offset = 32;
    for (let i = 0; i < k; i++) {
        for (let j = 0; j < n; j++) {
            // Store each coefficient as a byte (small values)
            privateKeyData[offset++] = s[i][j] & 0xff;
        }
    }

    for (let i = 0; i < k; i++) {
        for (let j = 0; j < n; j++) {
            // Store each coefficient as a 16-bit value
            privateKeyData[offset++] = t[i][j] & 0xff;
            privateKeyData[offset++] = (t[i][j] >> 8) & 0xff;
        }
    }

    return {
        publicKey: bufferToHex(publicKeyData),
        privateKey: bufferToHex(privateKeyData),
        algorithm: "kyber",
        params: {
            securityLevel,
            n,
            k,
            q,
            eta1,
            eta2,
        },
    };
}

/**
 * Generate a matrix of polynomials using a seed
 *
 * @param seed - Seed for generation
 * @param rows - Number of rows
 * @param cols - Number of columns
 * @param n - Polynomial degree
 * @param q - Modulus
 * @returns Matrix of polynomials
 */
function generateMatrix(
    seed: Uint8Array,
    rows: number,
    cols: number,
    n: number,
    q: number
): any[][][] {
    const matrix = new Array(rows);

    for (let i = 0; i < rows; i++) {
        matrix[i] = new Array(cols);

        for (let j = 0; j < cols; j++) {
            // Generate a unique seed for each position
            const positionSeed = Hash.create(
                Buffer.concat([seed, Buffer.from([i, j])]),
                { algorithm: "sha256", outputFormat: "buffer" }
            ) as unknown as Uint8Array;

            // Generate a polynomial with coefficients in [0, q-1]
            matrix[i][j] = new Uint16Array(n);

            // Use the seed to generate coefficients
            let byteCounter = 0;
            let seedIndex = 0;
            let currentSeed = positionSeed;

            while (byteCounter < n) {
                // Generate more bytes if needed
                if (seedIndex >= currentSeed.length) {
                    currentSeed = Hash.create(currentSeed, {
                        algorithm: "sha256",
                        outputFormat: "buffer",
                    }) as unknown as Uint8Array;
                    seedIndex = 0;
                }

                // Extract a 16-bit value
                const val =
                    currentSeed[seedIndex++] | (currentSeed[seedIndex++] << 8);

                // Only use values less than q
                if (val < q) {
                    matrix[i][j][byteCounter++] = val;
                }
            }
        }
    }

    return matrix;
}

/**
 * Generate a vector of polynomials with small coefficients
 *
 * @param seed - Seed for generation
 * @param size - Vector size
 * @param n - Polynomial degree
 * @param eta - Noise parameter
 * @param q - Modulus
 * @returns Vector of polynomials
 */
function generateNoiseVector(
    seed: Uint8Array,
    size: number,
    n: number,
    eta: number,
    q: number
): any[][] {
    const vector = new Array(size);

    for (let i = 0; i < size; i++) {
        // Generate a unique seed for each position
        const positionSeed = Hash.create(
            Buffer.concat([seed, Buffer.from([i])]),
            { algorithm: "sha256", outputFormat: "buffer" }
        ) as unknown as Uint8Array;

        // Generate a polynomial with small coefficients in [-eta, eta]
        vector[i] = new Uint16Array(n);

        // Use the seed to generate coefficients
        let byteCounter = 0;
        let seedIndex = 0;
        let currentSeed = positionSeed;

        while (byteCounter < n) {
            // Generate more bytes if needed
            if (seedIndex >= currentSeed.length) {
                currentSeed = Hash.create(currentSeed, {
                    algorithm: "sha256",
                    outputFormat: "buffer",
                }) as unknown as Uint8Array;
                seedIndex = 0;
            }

            // Extract a value in the range [0, 2*eta]
            const val = currentSeed[seedIndex++] % (2 * eta + 1);

            // Center around zero and ensure it's positive modulo q
            vector[i][byteCounter++] = (val <= eta ? val : q - (val - eta)) % q;
        }
    }

    return vector;
}

/**
 * Multiply two polynomials modulo x^n + 1 and coefficient-wise modulo q
 *
 * @param a - First polynomial
 * @param b - Second polynomial
 * @param n - Polynomial degree
 * @param q - Modulus
 * @returns Product polynomial
 */
function polyMul(a: any, b: any, n: number, q: number): Uint16Array {
    const result = new Uint16Array(n);

    // Naive polynomial multiplication
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            // Calculate the target index with reduction modulo x^n + 1
            const idx = (i + j) % n;

            // If i+j >= n, we need to negate the coefficient due to x^n = -1
            const coef =
                i + j >= n ? q - ((a[i] * b[j]) % q) : (a[i] * b[j]) % q;

            // Add to the result
            result[idx] = (result[idx] + coef) % q;
        }
    }

    return result;
}

/**
 * Encapsulates a shared secret using a Kyber public key
 *
 * @param publicKey - Recipient's public key (hex encoded)
 * @param params - Optional parameters
 * @returns Encapsulated shared secret and ciphertext
 */
export function kyberEncapsulate(
    publicKey: string,
    params: PostQuantumParams = {}
): PostQuantumEncapsulation {
    // Parse parameters
    const securityLevel = params.securityLevel || 3; // 1, 3, or 5

    try {
        // Try to import the kyber-crystals library
        const kyber = require("kyber-crystals");

        // Map our security level to the Kyber variant
        let kyberVariant;
        switch (securityLevel) {
            case 1:
                kyberVariant = kyber.kyber512;
                break;
            case 3:
                kyberVariant = kyber.kyber768;
                break;
            case 5:
                kyberVariant = kyber.kyber1024;
                break;
            default:
                kyberVariant = kyber.kyber768; // Default to Kyber-768 (security level 3)
        }

        // Parse the public key
        const publicKeyBuffer = hexToBuffer(publicKey);

        // Encapsulate using the library
        const encapsulation = kyberVariant.encap(publicKeyBuffer);

        // Extract the ciphertext and shared secret
        const ciphertext = Buffer.from(encapsulation.ciphertext);
        const sharedSecret = Buffer.from(encapsulation.shared_secret);

        // Determine parameters based on security level
        const n = 256; // Polynomial degree (fixed for Kyber)
        const k = securityLevel === 1 ? 2 : securityLevel === 3 ? 3 : 4; // Module rank
        const q = 3329; // Modulus

        return {
            ciphertext: bufferToHex(ciphertext),
            sharedSecret: bufferToHex(sharedSecret),
            algorithm: "kyber",
            params: {
                securityLevel,
                n,
                k,
                q,
            },
        };
    } catch (error) {
        console.warn("Error using crystals-kyber library:", error);
        console.warn("Falling back to simplified Kyber implementation");

        // Fallback to a simplified implementation
        return kyberEncapsulateFallback(publicKey, params);
    }
}

/**
 * Fallback implementation of Kyber encapsulation
 * Used when the kyber-crystals library is not available
 *
 * @param publicKey - Recipient's public key (hex encoded)
 * @param params - Optional parameters
 * @returns Encapsulated shared secret and ciphertext
 */
function kyberEncapsulateFallback(
    publicKey: string,
    params: PostQuantumParams = {}
): PostQuantumEncapsulation {
    // Parse parameters
    const securityLevel = params.securityLevel || 3; // 1, 3, or 5

    // Determine parameters based on security level
    const n = 256; // Polynomial degree (fixed for Kyber)
    const k = securityLevel === 1 ? 2 : securityLevel === 3 ? 3 : 4; // Module rank
    const q = 3329; // Modulus
    const eta1 = securityLevel === 1 ? 3 : 2; // Noise parameter for secret key
    const eta2 = 2; // Noise parameter for error

    try {
        // Try to use the pqc-kyber library as an alternative
        const pqcKyber = require("pqc-kyber");

        // Parse the public key
        const publicKeyBuffer = hexToBuffer(publicKey);

        // Map our security level to the Kyber variant
        let kyberVariant;
        switch (securityLevel) {
            case 1:
                kyberVariant = pqcKyber.kyber512;
                break;
            case 3:
                kyberVariant = pqcKyber.kyber768;
                break;
            case 5:
                kyberVariant = pqcKyber.kyber1024;
                break;
            default:
                kyberVariant = pqcKyber.kyber768; // Default to Kyber-768 (security level 3)
        }

        // Encapsulate using the library
        const result = kyberVariant.encap(publicKeyBuffer);

        return {
            ciphertext: bufferToHex(result.ciphertext),
            sharedSecret: bufferToHex(result.sharedSecret),
            algorithm: "kyber",
            params: {
                securityLevel,
                n,
                k,
                q,
                eta1,
                eta2,
            },
        };
    } catch (error) {
        console.warn("Error using pqc-kyber library:", error);
        console.warn("Using our own Kyber implementation");
    }

    // Parse public key
    const publicKeyData = hexToBuffer(publicKey);

    // Extract seed and public polynomials from the public key
    const seed = publicKeyData.slice(0, 32);
    const t = new Array(k);

    let offset = 32;
    for (let i = 0; i < k; i++) {
        t[i] = new Uint16Array(n);
        for (let j = 0; j < n; j++) {
            t[i][j] = publicKeyData[offset++] | (publicKeyData[offset++] << 8);
        }
    }

    // Generate the public matrix A using the seed
    const A = generateMatrix(seed, k, k, n, q);

    // Generate a random message m
    const m = SecureRandom.getRandomBytes(32);

    // Hash the message to get noise seeds
    const noiseHash = Hash.create(m, {
        algorithm: "sha512", // Using SHA-512 instead of SHA3-512
        outputFormat: "buffer",
    }) as unknown as Uint8Array;

    const r_seed = noiseHash.slice(0, 32);
    const e1_seed = noiseHash.slice(32, 64);

    // Generate the noise vector r with small coefficients
    const r = generateNoiseVector(r_seed, k, n, eta1, q);

    // Generate the error vector e1 with small coefficients
    const e1 = generateNoiseVector(e1_seed, k, n, eta2, q);

    // Compute u = A^T·r + e1
    const u = new Array(k);
    for (let i = 0; i < k; i++) {
        u[i] = new Uint16Array(n);

        // Initialize with error
        for (let j = 0; j < n; j++) {
            u[i][j] = e1[i][j];
        }

        // Add A^T·r
        for (let j = 0; j < k; j++) {
            // Polynomial multiplication in NTT domain
            const product = polyMul(A[j][i], r[j], n, q);

            // Add to result
            for (let l = 0; l < n; l++) {
                u[i][l] = (u[i][l] + product[l]) % q;
            }
        }
    }

    // Generate another error e2
    const e2_seed = Hash.create(
        Buffer.concat([Buffer.from(m), Buffer.from(seed)]),
        {
            algorithm: "sha256",
            outputFormat: "buffer",
        }
    ) as unknown as Uint8Array;

    const e2 = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
        e2[i] = e2_seed[i % e2_seed.length] % (2 * eta2 + 1);
        e2[i] = (e2[i] <= eta2 ? e2[i] : q - (e2[i] - eta2)) % q;
    }

    // Compute v = t^T·r + e2 + encode(m)
    const v = new Uint16Array(n);

    // Initialize with error e2
    for (let i = 0; i < n; i++) {
        v[i] = e2[i];
    }

    // Add t^T·r
    for (let i = 0; i < k; i++) {
        const product = polyMul(t[i], r[i], n, q);

        for (let j = 0; j < n; j++) {
            v[j] = (v[j] + product[j]) % q;
        }
    }

    // Encode the message m into the polynomial
    for (let i = 0; i < n; i++) {
        if (i < m.length * 8) {
            const bytePos = Math.floor(i / 8);
            const bitPos = i % 8;
            const bit = (m[bytePos] >> bitPos) & 1;

            // Add q/2 if the bit is 1
            if (bit === 1) {
                v[i] = (v[i] + Math.floor(q / 2)) % q;
            }
        }
    }

    // Serialize the ciphertext (u, v)
    const ciphertextSize = k * n * 2 + n * 2; // 2 bytes per coefficient
    const ciphertextData = new Uint8Array(ciphertextSize);

    offset = 0;
    // Serialize u
    for (let i = 0; i < k; i++) {
        for (let j = 0; j < n; j++) {
            ciphertextData[offset++] = u[i][j] & 0xff;
            ciphertextData[offset++] = (u[i][j] >> 8) & 0xff;
        }
    }

    // Serialize v
    for (let i = 0; i < n; i++) {
        ciphertextData[offset++] = v[i] & 0xff;
        ciphertextData[offset++] = (v[i] >> 8) & 0xff;
    }

    // Derive the shared secret from the message
    const sharedSecret = Hash.create(m, {
        algorithm: "sha256", // Using SHA-256 instead of SHA3-256
        outputFormat: "buffer",
    }) as unknown as Uint8Array;

    return {
        ciphertext: bufferToHex(ciphertextData),
        sharedSecret: bufferToHex(sharedSecret),
        algorithm: "kyber",
        params: {
            securityLevel,
            n,
            k,
            q,
            eta1,
            eta2,
        },
    };
}

/**
 * Decapsulates a shared secret using a Kyber private key and ciphertext
 *
 * @param privateKey - Recipient's private key (hex encoded)
 * @param ciphertext - Ciphertext from encapsulation (hex encoded)
 * @param params - Optional parameters
 * @returns Decapsulated shared secret
 */
export function kyberDecapsulate(
    privateKey: string,
    ciphertext: string,
    params: PostQuantumParams = {}
): PostQuantumDecapsulation {
    // Parse parameters
    const securityLevel = params.securityLevel || 3; // 1, 3, or 5

    try {
        // Try to import the kyber-crystals library
        const kyber = require("kyber-crystals");

        // Map our security level to the Kyber variant
        let kyberVariant;
        switch (securityLevel) {
            case 1:
                kyberVariant = kyber.kyber512;
                break;
            case 3:
                kyberVariant = kyber.kyber768;
                break;
            case 5:
                kyberVariant = kyber.kyber1024;
                break;
            default:
                kyberVariant = kyber.kyber768; // Default to Kyber-768 (security level 3)
        }

        // Parse the private key and ciphertext
        const privateKeyBuffer = hexToBuffer(privateKey);
        const ciphertextBuffer = hexToBuffer(ciphertext);

        // Decapsulate using the library
        const sharedSecret = kyberVariant.decap(
            privateKeyBuffer,
            ciphertextBuffer
        );

        // Determine parameters based on security level
        const n = 256; // Polynomial degree (fixed for Kyber)
        const k = securityLevel === 1 ? 2 : securityLevel === 3 ? 3 : 4; // Module rank
        const q = 3329; // Modulus

        return {
            sharedSecret: bufferToHex(Buffer.from(sharedSecret)),
            algorithm: "kyber",
            params: {
                securityLevel,
                n,
                k,
                q,
            },
        };
    } catch (error) {
        console.warn("Error using crystals-kyber library:", error);
        console.warn("Falling back to simplified Kyber implementation");

        // Fallback to a simplified implementation
        return kyberDecapsulateFallback(privateKey, ciphertext, params);
    }
}

/**
 * Fallback implementation of Kyber decapsulation
 * Used when the kyber-crystals library is not available
 *
 * @param privateKey - Recipient's private key (hex encoded)
 * @param ciphertext - Ciphertext from encapsulation (hex encoded)
 * @param params - Optional parameters
 * @returns Decapsulated shared secret
 */
function kyberDecapsulateFallback(
    privateKey: string,
    ciphertext: string,
    params: PostQuantumParams = {}
): PostQuantumDecapsulation {
    // Parse parameters
    const securityLevel = params.securityLevel || 3; // 1, 3, or 5

    // Determine parameters based on security level
    const n = 256; // Polynomial degree (fixed for Kyber)
    const k = securityLevel === 1 ? 2 : securityLevel === 3 ? 3 : 4; // Module rank
    const q = 3329; // Modulus
    const eta1 = securityLevel === 1 ? 3 : 2; // Noise parameter for secret key
    const eta2 = 2; // Noise parameter for error

    try {
        // Try to use the pqc-kyber library as an alternative
        const pqcKyber = require("pqc-kyber");

        // Parse the private key and ciphertext
        const privateKeyBuffer = hexToBuffer(privateKey);
        const ciphertextBuffer = hexToBuffer(ciphertext);

        // Map our security level to the Kyber variant
        let kyberVariant;
        switch (securityLevel) {
            case 1:
                kyberVariant = pqcKyber.kyber512;
                break;
            case 3:
                kyberVariant = pqcKyber.kyber768;
                break;
            case 5:
                kyberVariant = pqcKyber.kyber1024;
                break;
            default:
                kyberVariant = pqcKyber.kyber768; // Default to Kyber-768 (security level 3)
        }

        // Decapsulate using the library
        const sharedSecret = kyberVariant.decap(
            privateKeyBuffer,
            ciphertextBuffer
        );

        return {
            sharedSecret: bufferToHex(sharedSecret),
            algorithm: "kyber",
            params: {
                securityLevel,
                n,
                k,
                q,
                eta1,
                eta2,
            },
        };
    } catch (error) {
        console.warn("Error using pqc-kyber library:", error);
        console.warn("Using our own Kyber implementation");
    }

    // Parse private key
    const privateKeyData = hexToBuffer(privateKey);

    // Extract secret key s and public key t (seed is at the beginning but not needed for decapsulation)
    privateKeyData.slice(0, 32); // Skip the seed
    const s = new Array(k);
    const t = new Array(k);

    // Parse the secret key s
    let offset = 32;
    for (let i = 0; i < k; i++) {
        s[i] = new Uint16Array(n);
        for (let j = 0; j < n; j++) {
            s[i][j] = privateKeyData[offset++];
        }
    }

    // Parse the public key t
    for (let i = 0; i < k; i++) {
        t[i] = new Uint16Array(n);
        for (let j = 0; j < n; j++) {
            t[i][j] =
                privateKeyData[offset++] | (privateKeyData[offset++] << 8);
        }
    }

    // Parse ciphertext
    const ciphertextData = hexToBuffer(ciphertext);

    // Extract ciphertext components u and v
    const u = new Array(k);
    offset = 0;

    // Parse u
    for (let i = 0; i < k; i++) {
        u[i] = new Uint16Array(n);
        for (let j = 0; j < n; j++) {
            u[i][j] =
                ciphertextData[offset++] | (ciphertextData[offset++] << 8);
        }
    }

    // Parse v
    const v = new Uint16Array(n);
    for (let i = 0; i < n; i++) {
        v[i] = ciphertextData[offset++] | (ciphertextData[offset++] << 8);
    }

    // Compute v - s^T·u
    const mp = new Uint16Array(n);

    // Initialize with v
    for (let i = 0; i < n; i++) {
        mp[i] = v[i];
    }

    // Subtract s^T·u
    for (let i = 0; i < k; i++) {
        const product = polyMul(s[i], u[i], n, q);

        for (let j = 0; j < n; j++) {
            mp[j] = (mp[j] + q - product[j]) % q; // Subtract in modular arithmetic
        }
    }

    // Decode the message from mp
    const m = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
        m[i] = 0;
    }

    for (let i = 0; i < Math.min(n, 32 * 8); i++) {
        const bytePos = Math.floor(i / 8);
        const bitPos = i % 8;

        // Check if the coefficient is closer to q/2 (bit = 1) or 0 (bit = 0)
        if (mp[i] > q / 4 && mp[i] < (3 * q) / 4) {
            m[bytePos] |= 1 << bitPos;
        }
    }

    // Derive the shared secret from the message
    const sharedSecret = Hash.create(m, {
        algorithm: "sha256",
        outputFormat: "buffer",
    }) as unknown as Uint8Array;

    return {
        sharedSecret: bufferToHex(sharedSecret),
        algorithm: "kyber",
        params: {
            securityLevel,
            n,
            k,
            q,
            eta1,
            eta2,
        },
    };
}

/**
 * Real cryptographic hash function using SHA-256
 *
 * @param data - Data to hash
 * @param outputLength - Desired output length
 * @returns Hash value
 */
function simpleHash(data: Uint8Array, outputLength: number): Uint8Array {
    // Use the secure hash function from the Hash module
    const hashResult = Hash.create(data, {
        algorithm: "sha256",
        outputFormat: "buffer",
    });

    // Convert the result to Uint8Array
    let hashBuffer: Uint8Array;
    if (typeof hashResult === "string") {
        // If the result is a string (shouldn't happen with outputFormat: "buffer")
        // Convert it to a buffer
        const encoder = new TextEncoder();
        hashBuffer = encoder.encode(hashResult);
    } else {
        // It's already a Uint8Array
        hashBuffer = hashResult;
    }

    // If the requested output length matches the hash length, return it directly
    if (outputLength === hashBuffer.length) {
        return hashBuffer;
    }

    // Otherwise, truncate or extend as needed
    const result = new Uint8Array(outputLength);

    if (outputLength < hashBuffer.length) {
        // Truncate
        result.set(hashBuffer.subarray(0, outputLength));
    } else {
        // Extend by hashing repeatedly
        result.set(hashBuffer);

        let offset = hashBuffer.length;
        let counter = 1;

        while (offset < outputLength) {
            // Create a new buffer with the original hash and a counter
            const counterBuffer = new Uint8Array(4);
            counterBuffer[0] = (counter >> 24) & 0xff;
            counterBuffer[1] = (counter >> 16) & 0xff;
            counterBuffer[2] = (counter >> 8) & 0xff;
            counterBuffer[3] = counter & 0xff;

            // Concatenate the hash and counter
            const extendBuffer = new Uint8Array(hashBuffer.length + 4);
            extendBuffer.set(hashBuffer);
            extendBuffer.set(counterBuffer, hashBuffer.length);

            // Hash the extended buffer
            const extendedHashResult = Hash.create(extendBuffer, {
                algorithm: "sha256",
                outputFormat: "buffer",
            });

            // Convert the result to Uint8Array
            let extendedHash: Uint8Array;
            if (typeof extendedHashResult === "string") {
                const encoder = new TextEncoder();
                extendedHash = encoder.encode(extendedHashResult);
            } else {
                extendedHash = extendedHashResult;
            }

            // Copy as much as needed to the result
            const bytesToCopy = Math.min(
                extendedHash.length,
                outputLength - offset
            );
            result.set(extendedHash.subarray(0, bytesToCopy), offset);

            offset += bytesToCopy;
            counter++;
        }
    }

    return result;
}

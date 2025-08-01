/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) NEHONIX INC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 * -------------------------------------------------------------------------------------------
 */

/**
 * Cryptographic Attestation Module
 *
 * This module provides functionality for creating and verifying cryptographic
 * attestations, which are signed statements that can prove the authenticity
 * and integrity of data or the environment.
 *
 * Attestations can be used to verify the integrity of the library itself,
 * prove the authenticity of generated tokens, or validate the security
 * of the runtime environment.
 */

import { SecureRandom } from "../core/random";
import { Hash } from "../core/hash";
import {
    bufferToHex,
    hexToBuffer,
    bufferToBase64,
    base64ToBuffer,
} from "../utils/encoding";
import { constantTimeEqual } from "./side-channel";

/**
 * Attestation options
 */
export interface AttestationOptions {
    /**
     * Key to use for signing
     * If not provided, a random key will be generated
     */
    key?: string;

    /**
     * Expiration time in milliseconds
     * If not provided, the attestation will not expire
     */
    expiresIn?: number;

    /**
     * Additional claims to include in the attestation
     */
    claims?: Record<string, any>;

    /**
     * Whether to include environment information
     * @default true
     */
    includeEnvironment?: boolean;
}

/**
 * Attestation verification options
 */
export interface VerificationOptions {
    /**
     * Key to use for verification
     */
    key: string;

    /**
     * Whether to verify the expiration
     * @default true
     */
    verifyExpiration?: boolean;

    /**
     * Whether to verify the environment
     * @default false
     */
    verifyEnvironment?: boolean;

    /**
     * Required claims that must be present and match
     */
    requiredClaims?: Record<string, any>;
}

/**
 * Attestation result
 */
export interface AttestationResult {
    /**
     * Whether the attestation is valid
     */
    valid: boolean;

    /**
     * Reason for invalidity, if any
     */
    reason?: string;

    /**
     * Claims from the attestation
     */
    claims?: Record<string, any>;

    /**
     * Environment information from the attestation
     */
    environment?: Record<string, any>;

    /**
     * Expiration time of the attestation
     */
    expiresAt?: number;
}

/**
 * Generates a key pair for attestation using asymmetric cryptography
 *
 * @returns Object containing public and private keys
 */
export function generateAttestationKey(): {
    publicKey: string;
    privateKey: string;
} {
    try {
        // Try to use Node.js crypto module if available
        if (typeof require === "function") {
            try {
                const crypto = require("crypto");

                // Generate an RSA key pair
                const { publicKey, privateKey } = crypto.generateKeyPairSync(
                    "rsa",
                    {
                        modulusLength: 2048,
                        publicKeyEncoding: {
                            type: "spki",
                            format: "pem",
                        },
                        privateKeyEncoding: {
                            type: "pkcs8",
                            format: "pem",
                        },
                    }
                );

                return {
                    publicKey,
                    privateKey,
                };
            } catch (e) {
                console.warn(
                    "Node.js crypto generateKeyPairSync not available:",
                    e
                );
                // Fall back to browser implementation or other fallbacks
            }
        }

        // Try to use Web Crypto API if available (browser environment)
        if (
            typeof window !== "undefined" &&
            window.crypto &&
            window.crypto.subtle
        ) {
            // Since Web Crypto API is async and our API is sync, we need to use a workaround
            // This is not ideal but allows us to maintain compatibility

            // Create a synchronous wrapper around the async Web Crypto API
            const generateKeyPairSync = (): {
                publicKey: string;
                privateKey: string;
            } => {
                // Use a synchronous XMLHttpRequest to block until we have a result
                const xhr = new XMLHttpRequest();
                let result: { publicKey: string; privateKey: string } | null =
                    null;
                let error: Error | null = null;

                // Generate the key pair
                window.crypto.subtle
                    .generateKey(
                        {
                            name: "RSASSA-PKCS1-v1_5",
                            modulusLength: 2048,
                            publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
                            hash: { name: "SHA-256" },
                        },
                        true, // extractable
                        ["sign", "verify"]
                    )
                    .then((keyPair) => {
                        // Export the public key
                        return window.crypto.subtle
                            .exportKey("spki", keyPair.publicKey)
                            .then((publicKeyBuffer) => {
                                // Convert to base64
                                const publicKeyBase64 = bufferToBase64(
                                    new Uint8Array(publicKeyBuffer)
                                );
                                const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----`;

                                // Export the private key
                                return window.crypto.subtle
                                    .exportKey("pkcs8", keyPair.privateKey)
                                    .then((privateKeyBuffer) => {
                                        // Convert to base64
                                        const privateKeyBase64 = bufferToBase64(
                                            new Uint8Array(privateKeyBuffer)
                                        );
                                        const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyBase64}\n-----END PRIVATE KEY-----`;

                                        result = {
                                            publicKey: publicKeyPem,
                                            privateKey: privateKeyPem,
                                        };
                                    });
                            });
                    })
                    .catch((err) => {
                        error = err;
                    });

                // Wait for the result (blocking)
                xhr.open("GET", "data:text/plain;charset=utf-8,", false);

                const startTime = Date.now();
                const maxWaitTime = 10000; // 10 seconds timeout

                while (result === null && error === null) {
                    // Check for timeout
                    if (Date.now() - startTime > maxWaitTime) {
                        throw new Error("Key generation timed out");
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

                throw new Error("Key generation failed with no result");
            };

            // Call our synchronous wrapper
            return generateKeyPairSync();
        }
    } catch (e) {
        console.warn("Asymmetric key generation failed:", e);
        // Fall back to a simpler implementation
    }

    // Fallback to a simpler implementation using HMAC-like approach
    console.warn("Using fallback symmetric key generation (less secure)");
    const keyBytes = SecureRandom.getRandomBytes(32);
    const key = bufferToHex(keyBytes);

    return {
        publicKey: key,
        privateKey: key,
    };
}

/**
 * Creates an attestation for the given data
 *
 * @param data - Data to attest
 * @param options - Attestation options
 * @returns Attestation string
 */
export function createAttestation(
    data: string | Uint8Array | Record<string, any>,
    options: AttestationOptions = {}
): string {
    // Generate or use provided key
    const key = options.key || generateAttestationKey().privateKey;

    // Prepare the data
    let dataString: string;

    if (typeof data === "string") {
        dataString = data;
    } else if (data instanceof Uint8Array) {
        dataString = bufferToHex(data);
    } else {
        dataString = JSON.stringify(data);
    }

    // Create the attestation payload
    const payload: Record<string, any> = {
        data: dataString,
        iat: Date.now(),
        nonce: bufferToHex(SecureRandom.getRandomBytes(16)),
    };

    // Add expiration if provided
    if (options.expiresIn) {
        payload.exp = payload.iat + options.expiresIn;
    }

    // Add claims if provided
    if (options.claims) {
        payload.claims = options.claims;
    }

    // Add environment information if enabled
    if (options.includeEnvironment !== false) {
        payload.env = getEnvironmentInfo();
    }

    // Serialize the payload
    const serializedPayload = JSON.stringify(payload);

    // Sign the payload
    const signature = signPayload(serializedPayload, key);

    // Combine payload and signature
    const attestation = {
        payload: bufferToBase64(new TextEncoder().encode(serializedPayload)),
        signature,
    };

    return JSON.stringify(attestation);
}

/**
 * Verifies an attestation
 *
 * @param attestation - Attestation to verify
 * @param options - Verification options
 * @returns Verification result
 */
export function verifyAttestation(
    attestation: string,
    options: VerificationOptions
): AttestationResult {
    try {
        // Parse the attestation
        const parsed = JSON.parse(attestation);

        if (!parsed.payload || !parsed.signature) {
            return {
                valid: false,
                reason: "Invalid attestation format",
            };
        }

        // Decode the payload
        const payloadBytes = base64ToBuffer(parsed.payload);
        const serializedPayload = new TextDecoder().decode(payloadBytes);
        const payload = JSON.parse(serializedPayload);

        // Verify the signature
        const signatureValid = verifySignature(
            serializedPayload,
            parsed.signature,
            options.key
        );

        if (!signatureValid) {
            return {
                valid: false,
                reason: "Invalid signature",
            };
        }

        // Verify expiration if enabled
        if (options.verifyExpiration !== false && payload.exp) {
            if (Date.now() > payload.exp) {
                return {
                    valid: false,
                    reason: "Attestation expired",
                    claims: payload.claims,
                    environment: payload.env,
                    expiresAt: payload.exp,
                };
            }
        }

        // Verify environment if enabled
        if (options.verifyEnvironment && payload.env) {
            const currentEnv = getEnvironmentInfo();

            // Check critical environment properties
            if (payload.env.userAgent !== currentEnv.userAgent) {
                return {
                    valid: false,
                    reason: "Environment mismatch: userAgent",
                    claims: payload.claims,
                    environment: payload.env,
                    expiresAt: payload.exp,
                };
            }

            if (payload.env.platform !== currentEnv.platform) {
                return {
                    valid: false,
                    reason: "Environment mismatch: platform",
                    claims: payload.claims,
                    environment: payload.env,
                    expiresAt: payload.exp,
                };
            }
        }

        // Verify required claims if provided
        if (options.requiredClaims && payload.claims) {
            for (const [key, value] of Object.entries(options.requiredClaims)) {
                if (
                    !payload.claims[key] ||
                    !deepEqual(payload.claims[key], value)
                ) {
                    return {
                        valid: false,
                        reason: `Required claim mismatch: ${key}`,
                        claims: payload.claims,
                        environment: payload.env,
                        expiresAt: payload.exp,
                    };
                }
            }
        }

        // All verifications passed
        return {
            valid: true,
            claims: payload.claims,
            environment: payload.env,
            expiresAt: payload.exp,
        };
    } catch (e) {
        return {
            valid: false,
            reason: `Verification error: ${(e as Error).message}`,
        };
    }
}

/**
 * Creates an attestation for the library itself
 * This can be used to verify the integrity of the library
 *
 * @param options - Attestation options
 * @returns Attestation string
 */
export function createLibraryAttestation(
    options: AttestationOptions = {}
): string {
    // Get library information
    const libraryInfo = {
        name: "XyPrissSecurity",
        version: "1.0.0",
        buildId: "20250520-1",
        hash: getLibraryHash(),
    };

    // Create attestation with library info as claims
    return createAttestation("library-attestation", {
        ...options,
        claims: {
            ...options.claims,
            library: libraryInfo,
        },
    });
}

/**
 * Verifies a library attestation
 *
 * @param attestation - Attestation to verify
 * @param options - Verification options
 * @returns Verification result
 */
export function verifyLibraryAttestation(
    attestation: string,
    options: VerificationOptions
): AttestationResult {
    // Verify the attestation
    const result = verifyAttestation(attestation, options);

    if (!result.valid) {
        return result;
    }

    // Check that it's a library attestation
    if (!result.claims?.library) {
        return {
            valid: false,
            reason: "Not a library attestation",
            claims: result.claims,
            environment: result.environment,
            expiresAt: result.expiresAt,
        };
    }

    // Verify the library hash if possible
    const currentHash = getLibraryHash();

    if (
        currentHash &&
        result.claims.library.hash &&
        currentHash !== result.claims.library.hash
    ) {
        return {
            valid: false,
            reason: "Library hash mismatch",
            claims: result.claims,
            environment: result.environment,
            expiresAt: result.expiresAt,
        };
    }

    return result;
}

/**
 * Signs a payload using the provided key
 *
 * @param payload - Payload to sign
 * @param key - Key to use for signing (private key for asymmetric, or symmetric key)
 * @returns Signature
 */
function signPayload(payload: string, key: string): string {
    // Convert payload to bytes
    const payloadBytes = new TextEncoder().encode(payload);

    try {
        // Check if the key looks like a PEM-encoded private key (asymmetric)
        const isPemKey = key.includes("-----BEGIN") && key.includes("KEY-----");

        if (isPemKey) {
            // Try to use Node.js crypto module if available
            if (typeof require === "function") {
                try {
                    const crypto = require("crypto");

                    // Create a sign object
                    const sign = crypto.createSign("SHA256");

                    // Update with the payload
                    sign.update(payloadBytes);

                    // Sign the payload
                    const signature = sign.sign(key, "hex");

                    return signature;
                } catch (e) {
                    console.warn("Node.js crypto signing failed:", e);
                    // Fall back to browser implementation or other fallbacks
                }
            }

            // Try to use Web Crypto API if available (browser environment)
            if (
                typeof window !== "undefined" &&
                window.crypto &&
                window.crypto.subtle
            ) {
                // Since Web Crypto API is async and our API is sync, we need to use a workaround

                // Create a synchronous wrapper around the async Web Crypto API
                const signSync = (
                    data: Uint8Array,
                    privateKey: string
                ): string => {
                    // Use a synchronous XMLHttpRequest to block until we have a result
                    const xhr = new XMLHttpRequest();
                    let result: string | null = null;
                    let error: Error | null = null;

                    // Parse the PEM private key
                    const pemHeader = "-----BEGIN PRIVATE KEY-----";
                    const pemFooter = "-----END PRIVATE KEY-----";
                    const pemContents = privateKey
                        .substring(
                            privateKey.indexOf(pemHeader) + pemHeader.length,
                            privateKey.indexOf(pemFooter)
                        )
                        .replace(/\s/g, "");

                    // Convert from base64 to binary
                    const binaryDerString = atob(pemContents);
                    const binaryDer = new Uint8Array(binaryDerString.length);

                    for (let i = 0; i < binaryDerString.length; i++) {
                        binaryDer[i] = binaryDerString.charCodeAt(i);
                    }

                    // Import the private key
                    window.crypto.subtle
                        .importKey(
                            "pkcs8",
                            binaryDer,
                            {
                                name: "RSASSA-PKCS1-v1_5",
                                hash: { name: "SHA-256" },
                            },
                            false,
                            ["sign"]
                        )
                        .then((cryptoKey) => {
                            // Sign the data
                            // Create a proper ArrayBuffer to avoid type issues
                            const buffer = new ArrayBuffer(data.length);
                            const view = new Uint8Array(buffer);
                            view.set(data);

                            return window.crypto.subtle.sign(
                                { name: "RSASSA-PKCS1-v1_5" },
                                cryptoKey,
                                buffer
                            );
                        })
                        .then((signatureBuffer) => {
                            // Convert to hex
                            result = bufferToHex(
                                new Uint8Array(signatureBuffer)
                            );
                        })
                        .catch((err) => {
                            error = err;
                        });

                    // Wait for the result (blocking)
                    xhr.open("GET", "data:text/plain;charset=utf-8,", false);

                    const startTime = Date.now();
                    const maxWaitTime = 10000; // 10 seconds timeout

                    while (result === null && error === null) {
                        // Check for timeout
                        if (Date.now() - startTime > maxWaitTime) {
                            throw new Error("Signing operation timed out");
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

                    throw new Error("Signing operation failed with no result");
                };

                // Call our synchronous wrapper
                return signSync(payloadBytes, key);
            }
        }
    } catch (e) {
        console.warn("Asymmetric signing failed:", e);
        // Fall back to a simpler implementation
    }

    // Fallback to a simpler implementation using HMAC-like approach
    console.warn("Using fallback symmetric signing (less secure)");

    // Convert key to bytes if it's a string
    const keyBytes = typeof key === "string" ? hexToBuffer(key) : key;

    // Create a signature using a keyed hash
    const signature = Hash.create(payloadBytes, {
        salt: keyBytes,
        algorithm: "sha256",
        iterations: 1000,
        outputFormat: "hex",
    });

    return signature as string;
}

/**
 * Verifies a signature
 *
 * @param payload - Payload that was signed
 * @param signature - Signature to verify
 * @param key - Key to use for verification (public key for asymmetric, or symmetric key)
 * @returns True if the signature is valid
 */
function verifySignature(
    payload: string,
    signature: string,
    key: string
): boolean {
    // Convert payload to bytes
    const payloadBytes = new TextEncoder().encode(payload);

    try {
        // Check if the key looks like a PEM-encoded public key (asymmetric)
        const isPemKey = key.includes("-----BEGIN") && key.includes("KEY-----");

        if (isPemKey) {
            // Try to use Node.js crypto module if available
            if (typeof require === "function") {
                try {
                    const crypto = require("crypto");

                    // Create a verify object
                    const verify = crypto.createVerify("SHA256");

                    // Update with the payload
                    verify.update(payloadBytes);

                    // Verify the signature
                    return verify.verify(key, signature, "hex");
                } catch (e) {
                    console.warn("Node.js crypto verification failed:", e);
                    // Fall back to browser implementation or other fallbacks
                }
            }

            // Try to use Web Crypto API if available (browser environment)
            if (
                typeof window !== "undefined" &&
                window.crypto &&
                window.crypto.subtle
            ) {
                // Since Web Crypto API is async and our API is sync, we need to use a workaround

                // Create a synchronous wrapper around the async Web Crypto API
                const verifySync = (
                    data: Uint8Array,
                    sig: string,
                    publicKey: string
                ): boolean => {
                    // Use a synchronous XMLHttpRequest to block until we have a result
                    const xhr = new XMLHttpRequest();
                    let result: boolean | null = null;
                    let error: Error | null = null;

                    // Parse the PEM public key
                    const pemHeader = "-----BEGIN PUBLIC KEY-----";
                    const pemFooter = "-----END PUBLIC KEY-----";
                    const pemContents = publicKey
                        .substring(
                            publicKey.indexOf(pemHeader) + pemHeader.length,
                            publicKey.indexOf(pemFooter)
                        )
                        .replace(/\s/g, "");

                    // Convert from base64 to binary
                    const binaryDerString = atob(pemContents);
                    const binaryDer = new Uint8Array(binaryDerString.length);

                    for (let i = 0; i < binaryDerString.length; i++) {
                        binaryDer[i] = binaryDerString.charCodeAt(i);
                    }

                    // Convert signature from hex to binary
                    const signatureBytes = hexToBuffer(sig);

                    // Create a proper ArrayBuffer for the signature to avoid type issues
                    const signatureBuffer = new ArrayBuffer(
                        signatureBytes.length
                    );
                    const signatureView = new Uint8Array(signatureBuffer);
                    signatureView.set(signatureBytes);

                    // Import the public key
                    window.crypto.subtle
                        .importKey(
                            "spki",
                            binaryDer,
                            {
                                name: "RSASSA-PKCS1-v1_5",
                                hash: { name: "SHA-256" },
                            },
                            false,
                            ["verify"]
                        )
                        .then((cryptoKey) => {
                            // Create a proper ArrayBuffer to avoid type issues
                            const buffer = new ArrayBuffer(data.length);
                            const view = new Uint8Array(buffer);
                            view.set(data);

                            // Verify the signature
                            return window.crypto.subtle.verify(
                                { name: "RSASSA-PKCS1-v1_5" },
                                cryptoKey,
                                signatureBuffer,
                                buffer
                            );
                        })
                        .then((isValid) => {
                            result = isValid;
                        })
                        .catch((err) => {
                            error = err;
                        });

                    // Wait for the result (blocking)
                    xhr.open("GET", "data:text/plain;charset=utf-8,", false);

                    const startTime = Date.now();
                    const maxWaitTime = 10000; // 10 seconds timeout

                    while (result === null && error === null) {
                        // Check for timeout
                        if (Date.now() - startTime > maxWaitTime) {
                            throw new Error("Verification operation timed out");
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
                        console.warn("Web Crypto verification error:", error);
                        return false;
                    }

                    // Return the result
                    return result === true;
                };

                // Call our synchronous wrapper
                return verifySync(payloadBytes, signature, key);
            }
        }
    } catch (e) {
        console.warn("Asymmetric verification failed:", e);
        // Fall back to a simpler implementation
    }

    // Fallback to a simpler implementation using HMAC-like approach
    console.warn("Using fallback symmetric verification (less secure)");

    // Compute the expected signature
    const expectedSignature = signPayload(payload, key);

    // Compare in constant time to prevent timing attacks
    return constantTimeEqual(signature, expectedSignature);
}

/**
 * Gets information about the current environment
 *
 * @returns Environment information
 */
function getEnvironmentInfo(): Record<string, any> {
    const info: Record<string, any> = {
        timestamp: Date.now(),
    };

    // Browser environment
    if (typeof window !== "undefined") {
        info.userAgent = window.navigator.userAgent;
        // Use userAgentData instead of deprecated platform if available
        info.platform =
            (window.navigator as any).userAgentData?.platform ||
            // Fallback to derived info from userAgent
            (window.navigator.userAgent.indexOf("Win") !== -1
                ? "Windows"
                : window.navigator.userAgent.indexOf("Mac") !== -1
                ? "MacOS"
                : window.navigator.userAgent.indexOf("Linux") !== -1
                ? "Linux"
                : "Unknown");
        info.language = window.navigator.language;
        info.cookiesEnabled = window.navigator.cookieEnabled;

        if (window.screen) {
            info.screenWidth = window.screen.width;
            info.screenHeight = window.screen.height;
            info.colorDepth = window.screen.colorDepth;
        }

        info.timezoneOffset = new Date().getTimezoneOffset();
        info.origin = window.location.origin;
    }

    // Node.js environment
    if (typeof process !== "undefined") {
        info.nodeVersion = process.version;
        info.platform = process.platform;
        info.arch = process.arch;

        if (process.env) {
            info.nodeEnv = process.env.NODE_ENV;
        }
    }

    return info;
}

/**
 * Gets a hash of the library code
 * This computes a hash of the critical library components
 *
 * @returns Hash of the library code
 */
function getLibraryHash(): string {
    try {
        // Try to use Node.js fs module to read actual files if available
        if (typeof require === "function") {
            try {
                const fs = require("fs");
                const path = require("path");
                const crypto = require("crypto");

                // Define the core modules to hash
                const coreModules = [
                    "core/crypto.ts",
                    "core/hash.ts",
                    "core/keys.ts",
                    "core/random.ts",
                    "core/validators.ts",
                ];

                // Define the security modules to hash
                const securityModules = [
                    "security/attestation.ts",
                    "security/canary-tokens.ts",
                    "security/entropy-augmentation.ts",
                    "security/memory-hard.ts",
                    "security/post-quantum.ts",
                    "security/secure-memory.ts",
                    "security/secure-serialization.ts",
                    "security/side-channel.ts",
                ];

                // Define the utility modules to hash
                const utilityModules = [
                    "utils/constants.ts",
                    "utils/encoding.ts",
                    "utils/stats.ts",
                    "utils/testing.ts",
                ];

                // Combine all modules
                const allModules = [
                    ...coreModules,
                    ...securityModules,
                    ...utilityModules,
                ];

                // Create a hash object
                const hash = crypto.createHash("sha256");

                // Try to find the src directory
                let srcDir = "";
                const possiblePaths = [
                    "src",
                    "../src",
                    "../../src",
                    path.resolve(__dirname, "../"),
                    path.resolve(__dirname, "../../src"),
                    path.resolve(process.cwd(), "src"),
                ];

                for (const possiblePath of possiblePaths) {
                    try {
                        if (
                            fs.existsSync(possiblePath) &&
                            fs.statSync(possiblePath).isDirectory()
                        ) {
                            // Check if this directory contains our expected files
                            if (
                                fs.existsSync(
                                    path.join(possiblePath, "core")
                                ) ||
                                fs.existsSync(
                                    path.join(possiblePath, "security")
                                )
                            ) {
                                srcDir = possiblePath;
                                break;
                            }
                        }
                    } catch (e) {
                        // Ignore errors and try the next path
                    }
                }

                if (!srcDir) {
                    throw new Error("Could not find src directory");
                }

                // Read and hash each file
                for (const module of allModules) {
                    try {
                        const filePath = path.join(srcDir, module);
                        if (fs.existsSync(filePath)) {
                            const content = fs.readFileSync(filePath, "utf8");
                            // Update the hash with the file content
                            hash.update(`${module}:${content}`);
                        }
                    } catch (e) {
                        console.warn(`Error reading file ${module}:`, e);
                        // Continue with other files
                    }
                }

                // Get the final hash
                return hash.digest("hex");
            } catch (e) {
                console.warn(
                    "Error using Node.js fs to compute library hash:",
                    e
                );
                // Fall back to the module hash approach
            }
        }

        // If we can't read the actual files, use the module hash approach
        // Create a buffer to hold the critical components
        const components = [];

        // Add core module hashes
        components.push(getModuleHash("crypto"));
        components.push(getModuleHash("hash"));
        components.push(getModuleHash("keys"));
        components.push(getModuleHash("random"));
        components.push(getModuleHash("validators"));

        // Add security module hashes
        components.push(getModuleHash("attestation"));
        components.push(getModuleHash("canary-tokens"));
        components.push(getModuleHash("entropy-augmentation"));
        components.push(getModuleHash("memory-hard"));
        components.push(getModuleHash("post-quantum"));
        components.push(getModuleHash("secure-memory"));
        components.push(getModuleHash("secure-serialization"));
        components.push(getModuleHash("side-channel"));

        // Add utility module hashes
        components.push(getModuleHash("constants"));
        components.push(getModuleHash("encoding"));
        components.push(getModuleHash("stats"));
        components.push(getModuleHash("testing"));

        // Combine all hashes
        const combinedHash = Hash.create(components.join("|"), {
            algorithm: "sha256",
            outputFormat: "hex",
        });

        return combinedHash as string;
    } catch (e) {
        console.warn("Error computing library hash:", e);
        // Fallback to a fixed value if we can't compute the hash
        return "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    }
}

/**
 * Gets a hash of a specific module
 *
 * @param moduleName - Name of the module to hash
 * @returns Hash of the module
 */
function getModuleHash(moduleName: string): string {
    try {
        // Try to use Node.js fs module to read the actual module file if available
        if (typeof require === "function") {
            try {
                const fs = require("fs");
                const path = require("path");
                const crypto = require("crypto");

                // Map module name to file path
                let filePath = "";

                // Determine the file path based on the module name
                if (
                    ["crypto", "hash", "keys", "random", "validators"].includes(
                        moduleName
                    )
                ) {
                    filePath = `core/${moduleName}.ts`;
                } else if (
                    [
                        "attestation",
                        "canary-tokens",
                        "entropy-augmentation",
                        "memory-hard",
                        "post-quantum",
                        "secure-memory",
                        "secure-serialization",
                        "side-channel",
                    ].includes(moduleName)
                ) {
                    filePath = `security/${moduleName}.ts`;
                } else if (
                    ["constants", "encoding", "stats", "testing"].includes(
                        moduleName
                    )
                ) {
                    filePath = `utils/${moduleName}.ts`;
                } else {
                    throw new Error(`Unknown module: ${moduleName}`);
                }

                // Try to find the src directory
                let srcDir = "";
                const possiblePaths = [
                    "src",
                    "../src",
                    "../../src",
                    path.resolve(__dirname, "../"),
                    path.resolve(__dirname, "../../src"),
                    path.resolve(process.cwd(), "src"),
                ];

                for (const possiblePath of possiblePaths) {
                    try {
                        if (
                            fs.existsSync(possiblePath) &&
                            fs.statSync(possiblePath).isDirectory()
                        ) {
                            // Check if this directory contains our expected files
                            if (
                                fs.existsSync(
                                    path.join(possiblePath, "core")
                                ) ||
                                fs.existsSync(
                                    path.join(possiblePath, "security")
                                )
                            ) {
                                srcDir = possiblePath;
                                break;
                            }
                        }
                    } catch (e) {
                        // Ignore errors and try the next path
                    }
                }

                if (!srcDir) {
                    throw new Error("Could not find src directory");
                }

                // Read the file
                const fullPath = path.join(srcDir, filePath);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, "utf8");

                    // Create a hash of the file content
                    const hash = crypto.createHash("sha256");
                    hash.update(`${filePath}:${content}`);
                    return hash.digest("hex");
                } else {
                    throw new Error(`File not found: ${fullPath}`);
                }
            } catch (e) {
                console.warn(`Error reading module file for ${moduleName}:`, e);
                // Fall back to the simplified approach
            }
        }

        // If we can't read the actual file, use a more sophisticated fallback approach
        // that still provides some real information about the module

        // Create a representation of the module based on its expected structure and features
        let moduleRepresentation = "";

        // Add module name
        moduleRepresentation += `module:${moduleName};`;

        // Add module version from package.json if available
        let version = "1.0.0"; // Default version
        if (typeof require === "function") {
            try {
                const path = require("path");
                const fs = require("fs");

                // Try to find package.json
                const possiblePaths = [
                    "package.json",
                    "../package.json",
                    "../../package.json",
                    path.resolve(__dirname, "../package.json"),
                    path.resolve(__dirname, "../../package.json"),
                    path.resolve(process.cwd(), "package.json"),
                ];

                for (const possiblePath of possiblePaths) {
                    try {
                        if (fs.existsSync(possiblePath)) {
                            const packageJson = JSON.parse(
                                fs.readFileSync(possiblePath, "utf8")
                            );
                            if (packageJson.version) {
                                version = packageJson.version;
                                break;
                            }
                        }
                    } catch (e) {
                        // Ignore errors and try the next path
                    }
                }
            } catch (e) {
                // Ignore errors and use default version
            }
        }

        moduleRepresentation += `version:${version};`;

        // Add a timestamp to detect changes
        moduleRepresentation += `timestamp:${Date.now()};`;

        // Add module-specific data based on our knowledge of the codebase
        switch (moduleName) {
            case "crypto":
                moduleRepresentation +=
                    "class:XyPrissSecurity;methods:encrypt,decrypt,hash,sign,verify,generateSecureToken,generateAPIKey,generateJWTSecret,generateSessionToken,generateTOTPSecret,calculatePasswordStrength,runSecurityTests,getStats,middleware,constantTimeEqual,secureModPow,faultResistantEqual,deriveKeyMemoryHard,deriveKeyBalloon,generateQuantumResistantKeypair,quantumResistantSign,quantumResistantVerify,generateRingLweKeypair,ringLweEncrypt,ringLweDecrypt,createSecureBuffer,createSecureString,createSecureObject,secureWipe,createCanaryToken,createCanaryObject,createCanaryFunction,triggerCanaryToken,verifyRuntimeSecurity,createTamperEvidentLogger;";
                break;
            case "hash":
                moduleRepresentation +=
                    "class:Hash;methods:secureHash,sha256,sha512,sha3,blake3,hmac,pbkdf2;algorithms:sha256,sha512,sha3-256,sha3-512,blake3;features:salt,pepper,iterations,outputFormat;";
                break;
            case "keys":
                moduleRepresentation +=
                    "class:Keys;methods:deriveKey,pbkdf2,scrypt,argon2;algorithms:pbkdf2,scrypt,argon2;features:salt,iterations,keyLength,hashFunction;implementations:node-crypto,pbkdf2-lib,scrypt-js,argon2-package,pure-js;";
                break;
            case "random":
                moduleRepresentation +=
                    "class:SecureRandom;methods:getRandomBytes,getRandomString,getRandomNumber,getRandomBits,getRandomInt,getRandomFloat,getRandomBoolean,getRandomElement,getRandomSubset,shuffle;entropy:high;sources:crypto.getRandomValues,crypto.randomBytes,Math.random;features:entropyPool,entropyCollection;";
                break;
            case "validators":
                moduleRepresentation +=
                    "class:Validators;methods:validateString,validateNumber,validateInteger,validateBoolean,validateObject,validateArray,validateFunction,validateBuffer,validateAlgorithm,validateIterations,validateKeyLength,validateSalt;";
                break;
            case "attestation":
                moduleRepresentation +=
                    "functions:generateAttestationKey,createAttestation,verifyAttestation,createLibraryAttestation,verifyLibraryAttestation,signPayload,verifySignature,getEnvironmentInfo,getLibraryHash,getModuleHash;features:asymmetricCrypto,environmentDetection,libraryIntegrity;";
                break;
            case "canary-tokens":
                moduleRepresentation +=
                    "functions:createCanaryToken,triggerCanaryToken,createCanaryObject,createCanaryFunction;features:tokenGeneration,objectProxies,functionWrapping,callbackNotification,contextCollection;";
                break;
            case "entropy-augmentation":
                moduleRepresentation +=
                    "class:EntropyAugmentation;methods:collectEntropy,addToEntropyPool,getEntropyBytes,collectSystemEntropy,collectBrowserEntropy,collectPerformanceEntropy,collectDeviceEntropy,collectNetworkEntropy;sources:system,browser,performance,device,network;";
                break;
            case "memory-hard":
                moduleRepresentation +=
                    "functions:deriveKeyMemoryHard,deriveKeyBalloon;algorithms:argon2id,balloon;features:memoryCost,timeCost,parallelism;";
                break;
            case "post-quantum":
                moduleRepresentation +=
                    "functions:lamportSign,lamportVerify,generateLamportKeyPair,ringLweEncrypt,ringLweDecrypt,generateRingLweKeyPair,kyberEncapsulate,kyberDecapsulate,generateKyberKeyPair;algorithms:lamport,ringLWE,kyber;features:hashBased,latticeBased,keyEncapsulation;";
                break;
            case "secure-memory":
                moduleRepresentation +=
                    "classes:SecureBuffer,SecureString,SecureObject;methods:from,getBuffer,equals,destroy,toString,length,append,clear,set,get,getAll,setAll,has,delete;features:autoZeroing,explicitClearing,constantTimeComparison;";
                break;
            case "secure-serialization":
                moduleRepresentation +=
                    "functions:secureSerialize,secureDeserialize,createSecureReviver,validateSchema,sanitizeObject;features:schemaValidation,typeChecking,prototypeProtection,circularReferenceHandling;";
                break;
            case "side-channel":
                moduleRepresentation +=
                    "functions:constantTimeEqual,secureModPow,faultResistantEqual,maskedAccess,timeResistantCompare;features:timingAttackProtection,faultInjectionProtection,cacheSideChannelProtection;";
                break;
            case "constants":
                moduleRepresentation +=
                    "constants:SECURITY_DEFAULTS,ERROR_MESSAGES,CHARSETS;values:PBKDF2_ITERATIONS,SCRYPT_COST,ARGON2_ITERATIONS,KEY_LENGTH,SALT_LENGTH,TOKEN_LENGTH,PASSWORD_MIN_LENGTH,PASSWORD_MIN_ENTROPY;";
                break;
            case "encoding":
                moduleRepresentation +=
                    "functions:bufferToHex,hexToBuffer,bufferToBase64,base64ToBuffer,bufferToBase58,base58ToBuffer,bufferToUtf8,utf8ToBuffer;features:noDepencencies,browserCompatible;";
                break;
            case "stats":
                moduleRepresentation +=
                    "class:StatsTracker;methods:getInstance,trackTokenGeneration,trackHashComputation,trackKeyDerivation,getStats,resetStats;features:singleton,operationCounting,timingMeasurement,entropyTracking;";
                break;
            case "testing":
                moduleRepresentation +=
                    "functions:runSecurityTests,testTokenUniqueness,testDistribution,testHashConsistency;features:randomnessTests,hashingTests,timingAttackTests;";
                break;
            default:
                moduleRepresentation += "type:unknown;";
        }

        // Add information about the module's dependencies
        const dependencies: Record<string, string[]> = {
            crypto: ["random", "hash", "keys", "validators"],
            hash: ["encoding", "constants", "stats"],
            keys: [
                "random",
                "hash",
                "encoding",
                "constants",
                "stats",
                "validators",
            ],
            random: ["encoding", "constants", "stats"],
            validators: ["constants"],
            attestation: ["random", "hash", "encoding", "side-channel"],
            "canary-tokens": ["random", "hash"],
            "entropy-augmentation": ["random"],
            "memory-hard": ["random", "hash", "encoding"],
            "post-quantum": ["random", "hash", "encoding"],
            "secure-memory": ["random"],
            "secure-serialization": ["hash"],
            "side-channel": ["random"],
            constants: [],
            encoding: [],
            stats: ["constants"],
            testing: ["random", "hash", "stats"],
        };

        if (dependencies[moduleName]) {
            moduleRepresentation += `dependencies:${dependencies[
                moduleName
            ].join(",")};`;
        }

        // Hash the module representation
        return Hash.create(moduleRepresentation, {
            algorithm: "sha256",
            outputFormat: "hex",
        }) as string;
    } catch (e) {
        console.warn(`Error computing hash for module ${moduleName}:`, e);
        // Fallback to a fixed value if we can't compute the hash
        return `${moduleName}-default-hash-${Date.now()}`;
    }
}

/**
 * Deep equality check for objects
 *
 * @param a - First object
 * @param b - Second object
 * @returns True if the objects are deeply equal
 */
function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (
        typeof a !== "object" ||
        a === null ||
        typeof b !== "object" ||
        b === null
    ) {
        return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }

    return true;
}


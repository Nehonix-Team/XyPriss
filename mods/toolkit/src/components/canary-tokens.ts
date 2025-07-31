/**
 * Canary Tokens Module
 *
 * This module provides functionality for creating and managing canary tokens,
 * which are special tokens that can detect unauthorized access or data breaches.
 *
 * Canary tokens can be embedded in sensitive data or systems, and when accessed,
 * they trigger alerts or other actions to notify of potential security breaches.
 */ 

import { SecureRandom } from "../core/random";
import { Hash } from "../core/hash";
import { bufferToHex, hexToBuffer } from "../utils/encoding";
import https from "https";

/**
 * Canary token options
 */
export interface CanaryOptions {
    /**
     * Callback function to execute when the canary is triggered
     */
    callback?: (context: any) => void;

    /**
     * URL to notify when the canary is triggered
     */
    notifyUrl?: string;

    /**
     * Context information to include with the canary
     */
    context?: any;

    /**
     * Secret key for the canary
     * If not provided, a random key will be generated
     */
    key?: string;

    /**
     * Expiration time in milliseconds
     * If not provided, the canary will not expire
     */
    expiresIn?: number;
}

/**
 * Canary token data
 */
interface CanaryData {
    /**
     * Unique identifier for the canary
     */
    id: string;

    /**
     * Creation timestamp
     */
    created: number;

    /**
     * Expiration timestamp
     */
    expires?: number;

    /**
     * Context information
     */
    context?: any;

    /**
     * Notification URL
     */
    notifyUrl?: string;
}

// Store for registered canaries
const canaries: Map<string, CanaryData> = new Map();

// Store for canary callbacks
const callbacks: Map<string, (context: any) => void> = new Map();

/**
 * Creates a canary token
 *
 * @param options - Canary options
 * @returns Canary token
 */
export function createCanary(options: CanaryOptions = {}): string {
    // Generate a unique ID
    const id = bufferToHex(SecureRandom.getRandomBytes(16));

    // Generate a key if not provided
    const key = options.key || bufferToHex(SecureRandom.getRandomBytes(32));

    // Create canary data
    const canaryData: CanaryData = {
        id,
        created: Date.now(),
    };

    // Add expiration if provided
    if (options.expiresIn) {
        canaryData.expires = canaryData.created + options.expiresIn;
    }

    // Add context if provided
    if (options.context) {
        canaryData.context = options.context;
    }

    // Add notify URL if provided
    if (options.notifyUrl) {
        canaryData.notifyUrl = options.notifyUrl;
    }

    // Register the canary
    canaries.set(id, canaryData);

    // Register the callback if provided
    if (options.callback) {
        callbacks.set(id, options.callback);
    }

    // Create the token
    const tokenData = JSON.stringify({
        id,
        key,
    });

    // Encrypt the token
    return encryptCanary(tokenData, key);
}

/**
 * Triggers a canary token
 *
 * @param token - Canary token to trigger
 * @param context - Additional context for the trigger
 * @returns True if the canary was triggered successfully
 */
export function triggerCanary(token: string, context: any = {}): boolean {
    try {
        // Decrypt the token
        const tokenData = decryptCanary(token, "");

        if (!tokenData) {
            return false;
        }

        // Parse the token data
        const { id, key } = JSON.parse(tokenData);

        // Verify with the correct key
        const verifiedData = decryptCanary(token, key);

        if (!verifiedData) {
            return false;
        }

        // Get the canary data
        const canaryData = canaries.get(id);

        if (!canaryData) {
            return false;
        }

        // Check if expired
        if (canaryData.expires && Date.now() > canaryData.expires) {
            return false;
        }

        // Combine contexts
        const triggerContext = {
            ...canaryData.context,
            ...context,
            triggeredAt: Date.now(),
            canaryId: id,
        };

        // Execute the callback if registered
        const callback = callbacks.get(id);
        if (callback) {
            callback(triggerContext);
        }

        // Send notification if URL is provided
        if (canaryData.notifyUrl) {
            // Send an actual HTTP request to notify about the triggered canary
            try {
                const notificationData = JSON.stringify({
                    canaryId: id,
                    triggeredAt: Date.now(),
                    context: triggerContext,
                });

                // Use fetch API if available (browser environment)
                if (typeof fetch === "function") {
                    fetch(canaryData.notifyUrl, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-Canary-Alert": "true",
                        },
                        body: notificationData,
                    }).catch((err) => {
                        console.error(
                            "Failed to send canary notification:",
                            err
                        );
                    });
                } else if (typeof XMLHttpRequest === "function") {
                    // Fallback to XMLHttpRequest
                    const xhr = new XMLHttpRequest();
                    xhr.open("POST", canaryData.notifyUrl, true);
                    xhr.setRequestHeader("Content-Type", "application/json");
                    xhr.setRequestHeader("X-Canary-Alert", "true");
                    xhr.send(notificationData);
                } else if (typeof require === "function") {
                    // Node.js environment
                    try {
                        // const https = ("https");
                        const url = new URL(canaryData.notifyUrl);

                        const options = {
                            hostname: url.hostname,
                            port: url.port || 443,
                            path: url.pathname + url.search,
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Content-Length":
                                    Buffer.byteLength(notificationData),
                                "X-Canary-Alert": "true",
                            },
                        };

                        const req = https.request(options);
                        req.write(notificationData);
                        req.end();
                    } catch (e) {
                        console.error(
                            "Failed to send canary notification in Node.js:",
                            e
                        );
                    }
                } else if (
                    typeof window !== "undefined" &&
                    typeof window.XMLHttpRequest === "function"
                ) {
                    // Fallback to XMLHttpRequest in browser environments
                    const xhr = new window.XMLHttpRequest();
                    xhr.open("POST", canaryData.notifyUrl, true);
                    xhr.setRequestHeader("Content-Type", "application/json");
                    xhr.setRequestHeader("X-Canary-Alert", "true");
                    xhr.onerror = () => {
                        console.error(
                            "Failed to send canary notification via XMLHttpRequest"
                        );
                    };
                    xhr.send(notificationData);
                } else {
                    // Use Node.js https module as a last resort
                    try {
                        const url = new URL(canaryData.notifyUrl);
                        const options = {
                            hostname: url.hostname,
                            port:
                                url.port ||
                                (url.protocol === "https:" ? 443 : 80),
                            path: url.pathname + url.search,
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Content-Length":
                                    Buffer.byteLength(notificationData),
                                "X-Canary-Alert": "true",
                            },
                        };

                        const req = https.request(options);
                        req.write(notificationData);
                        req.end();
                    } catch (e) {
                        console.error(
                            "Failed to send canary notification in Node.js:",
                            e
                        );
                    }
                }
            } catch (e) {
                console.error("Error sending canary notification:", e);
            }
        }

        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Creates a canary object that triggers when accessed
 *
 * @param target - Object to wrap with a canary
 * @param options - Canary options
 * @returns Proxy object that triggers the canary when accessed
 */
export function createCanaryObject<T extends object>(
    target: T,
    options: CanaryOptions = {}
): T {
    // Create a canary token
    const canaryToken = createCanary(options);

    // Create a proxy that triggers the canary when accessed
    return new Proxy(target, {
        get(obj, prop) {
            // Trigger the canary
            triggerCanary(canaryToken, {
                action: "get",
                property: String(prop),
                timestamp: Date.now(),
            });

            // Return the property
            return (obj as any)[prop];
        },
        set(obj, prop, value) {
            // Trigger the canary
            triggerCanary(canaryToken, {
                action: "set",
                property: String(prop),
                timestamp: Date.now(),
            });

            // Set the property
            (obj as any)[prop] = value;
            return true;
        },
    });
}

/**
 * Creates a canary function that triggers when called
 *
 * @param fn - Function to wrap with a canary
 * @param options - Canary options
 * @returns Function that triggers the canary when called
 */
export function createCanaryFunction<T extends Function>(
    fn: T,
    options: CanaryOptions = {}
): T {
    // Create a canary token
    const canaryToken = createCanary(options);

    // Create a wrapper function that triggers the canary when called
    const wrapper = function (this: any, ...args: any[]) {
        // Trigger the canary
        triggerCanary(canaryToken, {
            action: "call",
            arguments: args,
            timestamp: Date.now(),
        });

        // Call the original function
        return fn.apply(this, args);
    };

    // Copy properties from the original function
    Object.defineProperties(wrapper, Object.getOwnPropertyDescriptors(fn));

    return wrapper as unknown as T;
}

/**
 * Simple encryption function for canary tokens
 *
 * @param data - Data to encrypt
 * @param key - Encryption key
 * @returns Encrypted data
 */
function encryptCanary(data: string, key: string): string {
    // Convert data to bytes
    const dataBytes = new TextEncoder().encode(data);

    // Create a key stream by hashing the key repeatedly
    const keyStream = new Uint8Array(dataBytes.length);
    let hashResult = Hash.create(key, { outputFormat: "hex" }) as string;
    let keyBlock = hexToBuffer(hashResult);

    for (let i = 0; i < keyStream.length; i += keyBlock.length) {
        // Copy as much of the key block as needed
        const bytesToCopy = Math.min(keyBlock.length, keyStream.length - i);
        keyStream.set(keyBlock.subarray(0, bytesToCopy), i);

        // Generate the next key block
        hashResult = Hash.create(bufferToHex(keyBlock), {
            outputFormat: "hex",
        }) as string;
        keyBlock = hexToBuffer(hashResult);
    }

    // XOR the data with the key stream
    const encrypted = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
        encrypted[i] = dataBytes[i] ^ keyStream[i];
    }

    return bufferToHex(encrypted);
}

/**
 * Simple decryption function for canary tokens
 *
 * @param encrypted - Encrypted data
 * @param key - Decryption key
 * @returns Decrypted data, or null if decryption fails
 */
function decryptCanary(encrypted: string, key: string): string | null {
    try {
        // Convert encrypted data to bytes
        const encryptedBytes = hexToBuffer(encrypted);

        // Create a key stream by hashing the key repeatedly
        const keyStream = new Uint8Array(encryptedBytes.length);
        let hashResult = Hash.create(key, {
            outputFormat: "hex",
        }) as string;
        let keyBlock = hexToBuffer(hashResult);

        for (let i = 0; i < keyStream.length; i += keyBlock.length) {
            // Copy as much of the key block as needed
            const bytesToCopy = Math.min(keyBlock.length, keyStream.length - i);
            keyStream.set(keyBlock.subarray(0, bytesToCopy), i);

            // Generate the next key block
            hashResult = Hash.create(bufferToHex(keyBlock), {
                outputFormat: "hex",
            }) as string;
            keyBlock = hexToBuffer(hashResult);
        }

        // XOR the encrypted data with the key stream
        const decrypted = new Uint8Array(encryptedBytes.length);
        for (let i = 0; i < encryptedBytes.length; i++) {
            decrypted[i] = encryptedBytes[i] ^ keyStream[i];
        }

        // Convert back to string
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        return null;
    }
}

/***************************************************************************
 * XyPrissSecurity - Secure Array Types
 *
 * This file contains type definitions for the SecureArray modular architecture
 *
 * @author Nehonix
 *
 * @license MIT
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ***************************************************************************** */

/**
 * Main export file for SecureObject
 */

// Import the main SecureObject class first
import { SecureObject } from "./core/secure-object-core";

// Export the main SecureObject class
export { SecureObject } from "./core/secure-object-core";

// Export types and interfaces
export type {
    SecureValue,
    SerializationOptions,
    ValueMetadata,
    SecureObjectEvent,
    EventListener,
    SecureObjectOptions,
    SecureObjectData,
} from "./types";

// Export modular components for advanced usage
export {
    SensitiveKeysManager,
    DEFAULT_SENSITIVE_KEYS,
} from "./encryption/sensitive-keys";
export { CryptoHandler } from "./encryption/crypto-handler";
export { MetadataManager } from "./metadata/metadata-manager";
export { EventManager } from "./events/event-manager";
export { SerializationHandler } from "./serialization/serialization-handler";

// Export utilities
export { IdGenerator } from "./utils/id-generator";
export { ValidationUtils } from "./utils/validation";

/**
 * Re-export for backward compatibility
 * This allows existing code to continue working with:
 * import { SecureObject } from "path/to/security/secureOb"
 */
export { SecureObject as default } from "./core/secure-object-core";

/**
 * Factory functions for common use cases
 */

/**
 * Creates a new SecureObject with default settings
 */
export function createSecureObject<T extends Record<string, any>>(
    ...args: ConstructorParameters<typeof SecureObject<T>>
): SecureObject<T> {
    return new SecureObject<T>(...args);
}

/**
 * Creates a read-only SecureObject
 */
export function createReadOnlySecureObject<T extends Record<string, any>>(
    data: Partial<T>
): SecureObject<T> {
    return SecureObject.readOnly<T>(data);
}

/**
 * Creates a SecureObject with custom sensitive keys
 */
export function createSecureObjectWithSensitiveKeys<
    T extends Record<string, any>
>(
    initialData: Partial<T>,
    sensitiveKeys: string[],
    options?: { readOnly?: boolean; encryptionKey?: string }
): SecureObject<T> {
    const obj = new SecureObject<T>(initialData, options);
    obj.setSensitiveKeys(sensitiveKeys);
    return obj;
}

/**
 * Creates a SecureObject from another SecureObject (deep copy)
 */
export function cloneSecureObject<T extends Record<string, any>>(
    source: SecureObject<T>
): SecureObject<T> {
    return SecureObject.from(source);
}

/**
 * Version information
 */
export const SECURE_OBJECT_VERSION = "2.0.0-modular";

/**
 * Module information for debugging
 */
export const MODULE_INFO = {
    version: SECURE_OBJECT_VERSION,
    architecture: "modular",
    components: [
        "core/secure-object-core",
        "encryption/sensitive-keys",
        "encryption/crypto-handler",
        "metadata/metadata-manager",
        "events/event-manager",
        "serialization/serialization-handler",
        "utils/id-generator",
        "utils/validation",
    ],
    features: [
        "Modular architecture",
        "Type-safe operations",
        "Event system",
        "Metadata tracking",
        "Encryption support",
        "Serialization options",
        "Memory management",
        "Validation utilities",
    ],
} as const;


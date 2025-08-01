/***************************************************************************
 * XyPrissSecurity - Secure Array Main Export
 *
 * This file contains the main exports for the SecureArray module
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
 * Main export file for SecureArray
 */

// Import the main SecureArray class
import { SecureArray } from "./core/secure-array-core";
import {
    DEFAULT_SECURE_ARRAY_OPTIONS,
    SecureArrayOptions,
    SecureArrayValue,
} from "./types";
import { ArrayValidationUtils } from "./utils/validation";

// Export the main SecureArray class
export { SecureArray } from "./core/secure-array-core";

// Export types and interfaces
export type {
    SecureArrayValue,
    SecureArraySerializationOptions,
    ElementMetadata,
    SecureArrayEvent,
    SecureArrayEventListener,
    SecureArrayOptions,
    SearchOptions,
    SortOptions,
    FilterOptions,
    AggregationOptions,
    ChunkOptions,
    SecureArrayData,
    SecureArrayStats,
    ValidationResult,
    FlexibleSecureArray,
} from "./types";

export {
    DEFAULT_SECURE_ARRAY_OPTIONS,
    DEFAULT_SEARCH_OPTIONS,
    DEFAULT_FILTER_OPTIONS,
    isSecureArrayValue,
    isSecureArray,
} from "./types";

// Export modular components for advanced usage
export { ArrayMetadataManager } from "./metadata/metadata-manager";
export { ArrayValidationUtils } from "./utils/validation";
export { ArrayIdGenerator } from "./utils/id-generator";

/**
 * Re-export for backward compatibility
 */
export { SecureArray as default } from "./core/secure-array-core";

// Helper type to widen literal types to their base types
type WidenLiterals<T> = T extends string
    ? string
    : T extends number
    ? number
    : T extends boolean
    ? boolean
    : T;

/**
 * Creates a SecureArray with initial data
 */
export function createSecureArray<
    T extends SecureArrayValue = SecureArrayValue
>(
    initialData?: WidenLiterals<T>[],
    options?: SecureArrayOptions
): SecureArray<WidenLiterals<T>> {
    return new SecureArray<WidenLiterals<T>>(
        initialData as WidenLiterals<T>[],
        options
    );
}

/**
 * Creates a SecureArray with maximum security settings
 */
export function createMaximumSecureArray<
    T extends SecureArrayValue = SecureArrayValue
>(
    initialData?: T[],
    customOptions?: Partial<SecureArrayOptions>
): SecureArray<T> {
    const maximumOptions: SecureArrayOptions = {
        readOnly: false,
        autoDestroy: false,
        encryptionKey: undefined,
        maxMemory: 50 * 1024 * 1024, // 50MB
        gcThreshold: 0.7,
        enableMemoryTracking: true,
        autoCleanup: true,
        maxLength: 100000,
        enableIndexValidation: true,
        enableTypeValidation: true,
        ...customOptions,
    };
    return new SecureArray<T>(initialData, maximumOptions);
}

/**
 * Creates a read-only SecureArray
 */
export function createReadOnlySecureArray<
    T extends SecureArrayValue = SecureArrayValue
>(initialData: T[], options?: Partial<SecureArrayOptions>): SecureArray<T> {
    const readOnlyOptions: SecureArrayOptions = {
        readOnly: true,
        enableMemoryTracking: true,
        enableIndexValidation: true,
        enableTypeValidation: true,
        ...options,
    };
    return new SecureArray<T>(initialData, readOnlyOptions);
}

/**
 * Creates a SecureArray from another array (deep copy)
 */
export function cloneSecureArray<T extends SecureArrayValue = SecureArrayValue>(
    source: SecureArray<T>
): SecureArray<T> {
    const newArray = new SecureArray<T>();
    for (let i = 0; i < source.length; i++) {
        const value = source.get(i);
        if (value !== undefined) {
            newArray.push(value);
        }
    }
    return newArray;
}

/**
 * Creates a SecureArray from a regular array
 */
export function fromArray<T extends SecureArrayValue = SecureArrayValue>(
    array: T[],
    options?: SecureArrayOptions
): SecureArray<T> {
    return new SecureArray<T>(array, options);
}

/**
 * Converts a SecureArray to a regular array
 */
export function toArray<T extends SecureArrayValue = SecureArrayValue>(
    secureArray: SecureArray<T>
): T[] {
    const result: T[] = [];
    for (let i = 0; i < secureArray.length; i++) {
        const value = secureArray.get(i);
        if (value !== undefined) {
            result.push(value);
        }
    }
    return result;
}

/**
 * Merges multiple SecureArrays into one
 */
export function mergeSecureArrays<
    T extends SecureArrayValue = SecureArrayValue
>(...arrays: SecureArray<T>[]): SecureArray<T> {
    const result = new SecureArray<T>();

    for (const array of arrays) {
        for (let i = 0; i < array.length; i++) {
            const value = array.get(i);
            if (value !== undefined) {
                result.push(value);
            }
        }
    }

    return result;
}

/**
 * Creates a SecureArray with a specific size and fill value
 */
export function createFilledSecureArray<
    T extends SecureArrayValue = SecureArrayValue
>(size: number, fillValue: T, options?: SecureArrayOptions): SecureArray<T> {
    const array = new SecureArray<T>([], options);
    for (let i = 0; i < size; i++) {
        array.push(fillValue);
    }
    return array;
}

/**
 * Creates a SecureArray from a range of numbers
 */
export function createRangeSecureArray(
    start: number,
    end: number,
    step: number = 1,
    options?: SecureArrayOptions
): SecureArray<number> {
    const array = new SecureArray<number>([], options);
    for (let i = start; i < end; i += step) {
        array.push(i);
    }
    return array;
}

/**
 * Version information
 */
export const SECURE_ARRAY_VERSION = "2.0.0-beta";

/**
 * Module information for debugging
 */
export const MODULE_INFO = {
    version: SECURE_ARRAY_VERSION,
    architecture: "modular",
    components: [
        "core/secure-array-core",
        "metadata/metadata-manager",
        "utils/id-generator",
        "utils/validation",
        "types/index",
    ],
    features: [
        "Modular architecture",
        "Type-safe operations",
        "Event system",
        "Metadata tracking",
        "Memory management",
        "Validation utilities",
        "Secure storage",
        "Array operations",
    ],
} as const;

/**
 * Gets information about the SecureArray module
 */
export function getModuleInfo() {
    return MODULE_INFO;
}

/**
 * Validates if a value can be used in SecureArray
 */
export function validateSecureArrayValue(value: any): boolean {
    try {
        ArrayValidationUtils.validateSecureArrayValue(value);
        return true;
    } catch {
        return false;
    }
}

/**
 * Gets the default options for SecureArray
 */
export function getDefaultOptions(): SecureArrayOptions {
    return { ...DEFAULT_SECURE_ARRAY_OPTIONS };
}


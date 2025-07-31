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
 * Type definitions for SecureArray modular architecture
 */

import SecureString from "../../secure-string";
import { SecureObject } from "../../secure-object";
import { SecureArray } from "../core/secure-array-core";

/**
 * Types that can be stored securely in arrays
 */
export type SecureArrayValue =
    | string
    | number
    | boolean
    | Uint8Array
    | SecureString
    | SecureObject<any>
    | null
    | undefined
    | object;

/**
 * Serialization options for SecureArray
 */
export interface SecureArraySerializationOptions {
    includeMetadata?: boolean;
    encryptSensitive?: boolean;
    format?: "json" | "binary" | "compact" | "base64";
    preserveOrder?: boolean;
    compression?: boolean;
    includeChecksum?: boolean;
}

/**
 * Metadata for tracking secure array elements
 */
export interface ElementMetadata {
    type: string;
    isSecure: boolean;
    created: Date;
    lastAccessed: Date;
    accessCount: number;
    index: number;
}

/**
 * Event types for SecureArray
 */
export type SecureArrayEvent =
    | "created"
    | "push"
    | "pop"
    | "shift"
    | "unshift"
    | "splice"
    | "sort"
    | "reverse"
    | "get"
    | "set"
    | "clear"
    | "destroy"
    | "filtered"
    | "mapped"
    | "reduced"
    | "gc"
    | "encrypt_all"
    | "slice"
    | "snapshot_created"
    | "snapshot_restored"
    | "freeze"
    | "unfreeze"
    | "readonly"
    | "writable"
    | "destroyed"
    | "compact"
    | "unique"
    | "shuffle";

/**
 * Event listener callback for SecureArray
 */
export type SecureArrayEventListener = (
    event: SecureArrayEvent,
    index?: number,
    value?: any,
    metadata?: any
) => void | Promise<void>;

/**
 * Configuration options for SecureArray
 */
export interface SecureArrayOptions {
    readOnly?: boolean;
    autoDestroy?: boolean;
    encryptionKey?: string;
    maxMemory?: number;
    gcThreshold?: number;
    enableMemoryTracking?: boolean;
    autoCleanup?: boolean;
    maxLength?: number;
    maxSize?: number;
    enableIndexValidation?: boolean;
    enableTypeValidation?: boolean;
}

/**
 * Search options for array operations
 */
export interface SearchOptions {
    caseSensitive?: boolean;
    exactMatch?: boolean;
    startIndex?: number;
    endIndex?: number;
}

/**
 * Sort options for array operations
 */
export interface SortOptions<T> {
    compareFn?: (a: T, b: T) => number;
    stable?: boolean;
    reverse?: boolean;
    caseSensitive?: boolean;
}

/**
 * Filter options for array operations
 */
export interface FilterOptions {
    preserveIndices?: boolean;
    includeMetadata?: boolean;
    maxResults?: number;
}

/**
 * Aggregation options for reduce operations
 */
export interface AggregationOptions {
    skipNulls?: boolean;
    skipUndefined?: boolean;
    parallel?: boolean;
}

/**
 * Chunk options for array splitting
 */
export interface ChunkOptions {
    size?: number;
    overlap?: number;
    preserveOrder?: boolean;
}

/**
 * Internal data structure for storing array elements
 */
export interface SecureArrayData {
    elements: any[];
    secureBuffers: Map<number, any>; // SecureBuffer type
    metadata: Map<number, ElementMetadata>;
}

/**
 * Statistics for SecureArray performance monitoring
 */
export interface SecureArrayStats {
    length: number;
    secureElements: number;
    totalAccesses: number;
    memoryUsage: number;
    lastModified: number;
    version: number;
    createdAt: number;
    isReadOnly: boolean;
    isFrozen: boolean;
    typeDistribution: Record<string, number>;
    secureElementCount: number;
    estimatedMemoryUsage: number;
    snapshotCount: number;
    encryptionEnabled: boolean;
}

/**
 * Validation result for array operations
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Default options for SecureArray
 */
export const DEFAULT_SECURE_ARRAY_OPTIONS: Required<SecureArrayOptions> = {
    readOnly: false,
    autoDestroy: false,
    encryptionKey: "",
    maxMemory: 100 * 1024 * 1024, // 100MB
    gcThreshold: 0.8,
    enableMemoryTracking: true,
    autoCleanup: true,
    maxLength: Number.MAX_SAFE_INTEGER,
    maxSize: Number.MAX_SAFE_INTEGER,
    enableIndexValidation: true,
    enableTypeValidation: true,
} as const;

/**
 * Default search options
 */
export const DEFAULT_SEARCH_OPTIONS: Required<SearchOptions> = {
    caseSensitive: true,
    exactMatch: true,
    startIndex: 0,
    endIndex: -1,
} as const;

/**
 * Default filter options
 */
export const DEFAULT_FILTER_OPTIONS: Required<FilterOptions> = {
    preserveIndices: false,
    includeMetadata: false,
    maxResults: -1,
} as const;

/**
 * Helper type for creating flexible SecureArray instances
 */
export type FlexibleSecureArray<T = SecureArrayValue> = T[] & {
    [key: string]: any;
};

/**
 * Type guard for SecureArray values
 */
export function isSecureArrayValue(value: any): value is SecureArrayValue {
    return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value instanceof Uint8Array ||
        value instanceof SecureString ||
        value instanceof SecureObject ||
        value === null ||
        value === undefined ||
        (typeof value === "object" && value !== null)
    );
}

/**
 * Type guard for SecureArray instances
 */
export function isSecureArray(value: any): value is any {
    return (
        value &&
        typeof value === "object" &&
        value.constructor?.name === "SecureArray"
    );
}

///

/**
 * Predicate function type for filtering and searching
 */
export type PredicateFn<T extends SecureArrayValue> = (
    value: T,
    index: number,
    array: SecureArray<T>
) => boolean;

/**
 * Comparator function type for sorting
 */
export type ComparatorFn<T extends SecureArrayValue> = (a: T, b: T) => number;

/**
 * Mapper function type for transformations
 */
export type MapperFn<T extends SecureArrayValue, U> = (
    value: T,
    index: number,
    array: SecureArray<T>
) => U;

/**
 * Reducer function type for aggregations
 */
export type ReducerFn<T extends SecureArrayValue, U> = (
    accumulator: U,
    currentValue: T,
    currentIndex: number,
    array: SecureArray<T>
) => U;


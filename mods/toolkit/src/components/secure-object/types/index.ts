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
 * Type definitions for SecureObject modular architecture
 */

import SecureString from "../../secure-string";

/**
 * Types that can be stored securely
 */
export type SecureValue =
    | string
    | number
    | boolean
    | Uint8Array
    | SecureString
    | any // SecureObject<any> - will be properly typed after refactoring
    | null
    | undefined;

/**
 * Serialization options for SecureObject
 */
export interface SerializationOptions {
    includeMetadata?: boolean;
    encryptSensitive?: boolean;
    format?: "json" | "binary";
}

/**
 * Metadata for tracking secure values
 */
export interface ValueMetadata {
    type: string;
    isSecure: boolean;
    created: Date;
    lastAccessed: Date;
    accessCount: number;
}

/**
 * Event types for SecureObject
 */
export type SecureObjectEvent =
    | "set"
    | "get"
    | "delete"
    | "clear"
    | "destroy"
    | "filtered"
    | "gc";

/**
 * Event listener callback
 */
export type EventListener = (
    event: SecureObjectEvent,
    key?: string,
    value?: any
) => void | Promise<void>;

/**
 * Configuration options for SecureObject
 */
export interface SecureObjectOptions {
    readOnly?: boolean;
    autoDestroy?: boolean;
    encryptionKey?: string;
    maxMemory?: number;
    gcThreshold?: number;
    enableMemoryTracking?: boolean;
    autoCleanup?: boolean;
}

/**
 * Helper type for creating flexible SecureObject instances
 * Allows both strict typing and dynamic key addition
 */
export type FlexibleSecureObject<
    T extends Record<string, SecureValue> = Record<string, SecureValue>
> = {
    [K in keyof T]: T[K];
} & {
    [key: string]: SecureValue;
};

/**
 * Internal data structure for storing values
 */
export interface SecureObjectData {
    data: Map<string, any>;
    secureBuffers: Map<string, any>; // SecureBuffer type
    metadata: Map<string, ValueMetadata>;
}


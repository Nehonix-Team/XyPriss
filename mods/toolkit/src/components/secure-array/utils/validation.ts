/***************************************************************************
 * XyPrissSecurity - Secure Array Validation Utilities
 *
 * This file contains validation utilities for SecureArray
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
 * Validation utilities for SecureArray
 */

import {
    SecureArrayValue,
    SecureArrayOptions,
    isSecureArrayValue,
    ValidationResult,
} from "../types";

/**
 * Validation utilities for SecureArray operations
 */
export class ArrayValidationUtils {
    /**
     * Validates a SecureArray value
     */
    public static validateSecureArrayValue(value: any): void {
        if (!isSecureArrayValue(value)) {
            throw new Error(`Invalid SecureArray value: ${typeof value}`);
        }
    }

    /**
     * Validates an array index
     */
    public static validateIndex(index: number, arrayLength?: number): void {
        if (!Number.isInteger(index)) {
            throw new Error(`Index must be an integer: ${index}`);
        }

        if (index < 0) {
            throw new Error(`Index cannot be negative: ${index}`);
        }

        if (arrayLength !== undefined && index >= arrayLength) {
            throw new Error(`Index out of bounds: ${index} >= ${arrayLength}`);
        }
    }

    /**
     * Validates SecureArray options
     */
    public static validateOptions(
        options: SecureArrayOptions
    ): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (options.maxMemory !== undefined) {
            if (
                typeof options.maxMemory !== "number" ||
                options.maxMemory <= 0
            ) {
                errors.push("maxMemory must be a positive number");
            }
        }

        if (options.gcThreshold !== undefined) {
            if (
                typeof options.gcThreshold !== "number" ||
                options.gcThreshold < 0 ||
                options.gcThreshold > 1
            ) {
                errors.push("gcThreshold must be a number between 0 and 1");
            }
        }

        if (options.maxLength !== undefined) {
            if (
                typeof options.maxLength !== "number" ||
                options.maxLength <= 0
            ) {
                errors.push("maxLength must be a positive number");
            }
        }

        if (options.encryptionKey !== undefined) {
            if (typeof options.encryptionKey !== "string") {
                errors.push("encryptionKey must be a string");
            } else if (options.encryptionKey.length < 8) {
                warnings.push(
                    "encryptionKey should be at least 8 characters long"
                );
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validates an array of values
     */
    public static validateArray(values: any[]): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (!Array.isArray(values)) {
            errors.push("Input must be an array");
            return { isValid: false, errors, warnings };
        }

        for (let i = 0; i < values.length; i++) {
            try {
                this.validateSecureArrayValue(values[i]);
            } catch (error: any) {
                errors.push(`Invalid value at index ${i}: ${error.message}`);
            }
        }

        if (values.length > 10000) {
            warnings.push(
                "Large array detected, consider performance implications"
            );
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validates a callback function
     */
    public static validateCallback(
        callback: any,
        name: string = "callback"
    ): void {
        if (typeof callback !== "function") {
            throw new Error(`${name} must be a function`);
        }
    }

    /**
     * Validates a predicate function
     */
    public static validatePredicate(predicate: any): void {
        this.validateCallback(predicate, "predicate");
    }

    /**
     * Validates a mapper function
     */
    public static validateMapper(mapper: any): void {
        this.validateCallback(mapper, "mapper");
    }

    /**
     * Validates a reducer function
     */
    public static validateReducer(reducer: any): void {
        this.validateCallback(reducer, "reducer");
    }

    /**
     * Validates a comparator function
     */
    public static validateComparator(comparator: any): void {
        this.validateCallback(comparator, "comparator");
    }

    /**
     * Validates a range (start and end indices)
     */
    public static validateRange(
        start: number,
        end: number,
        arrayLength: number
    ): void {
        this.validateIndex(start);
        this.validateIndex(end);

        if (start > end) {
            throw new Error(
                `Start index (${start}) cannot be greater than end index (${end})`
            );
        }

        if (end >= arrayLength) {
            throw new Error(
                `End index (${end}) is out of bounds for array length ${arrayLength}`
            );
        }
    }

    /**
     * Validates a chunk size
     */
    public static validateChunkSize(size: number): void {
        if (!Number.isInteger(size) || size <= 0) {
            throw new Error(`Chunk size must be a positive integer: ${size}`);
        }
    }

    /**
     * Sanitizes an index to ensure it's valid
     */
    public static sanitizeIndex(index: any): number {
        const num = Number(index);
        if (!Number.isInteger(num) || num < 0) {
            throw new Error(`Invalid index: ${index}`);
        }
        return num;
    }

    /**
     * Checks if a value is a SecureString
     */
    public static isSecureString(value: any): boolean {
        return (
            value &&
            typeof value === "object" &&
            value.constructor?.name === "SecureString"
        );
    }

    /**
     * Checks if a value is a SecureObject
     */
    public static isSecureObject(value: any): boolean {
        return (
            value &&
            typeof value === "object" &&
            value.constructor?.name === "SecureObject"
        );
    }

    /**
     * Checks if a value is a SecureArray
     */
    public static isSecureArray(value: any): boolean {
        return (
            value &&
            typeof value === "object" &&
            value.constructor?.name === "SecureArray"
        );
    }

    /**
     * Validates memory usage
     */
    public static validateMemoryUsage(
        currentUsage: number,
        maxMemory: number
    ): void {
        if (currentUsage > maxMemory) {
            throw new Error(
                `Memory usage (${currentUsage}) exceeds maximum allowed (${maxMemory})`
            );
        }
    }

    /**
     * Validates that an array is not destroyed
     */
    public static validateNotDestroyed(isDestroyed: boolean): void {
        if (isDestroyed) {
            throw new Error("SecureArray has been destroyed");
        }
    }

    /**
     * Validates that an array is not read-only
     */
    public static validateNotReadOnly(isReadOnly: boolean): void {
        if (isReadOnly) {
            throw new Error("SecureArray is read-only");
        }
    }

    /**
     * Validates encryption key strength
     */
    public static validateEncryptionKey(key: string | null): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        if (key === null || key === undefined) {
            return { isValid: true, errors, warnings };
        }

        if (typeof key !== "string") {
            errors.push("Encryption key must be a string");
            return { isValid: false, errors, warnings };
        }

        if (key.length < 8) {
            errors.push("Encryption key must be at least 8 characters long");
        } else if (key.length < 16) {
            warnings.push(
                "Consider using a longer encryption key for better security"
            );
        }

        // Check for common weak patterns
        if (/^(.)\1+$/.test(key)) {
            warnings.push(
                "Encryption key should not consist of repeated characters"
            );
        }

        if (/^(012|123|abc|password|secret)/i.test(key)) {
            warnings.push("Encryption key appears to be weak or common");
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }
}


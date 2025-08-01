/**
 * Validation Utilities
 * Common validation functions for SecureObject
 */

import { SecureValue, SerializationOptions } from "../types";

/**
 * Validation utilities for SecureObject
 */
export class ValidationUtils {
    /**
     * Validates if a value is a valid SecureValue type
     */
    static isValidSecureValue(value: any): value is SecureValue {
        return (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean" ||
            value instanceof Uint8Array ||
            value === null ||
            value === undefined ||
            this.isSecureString(value) ||
            this.isSecureObject(value)
        );
    }

    /**
     * Checks if a value is a SecureString instance
     */
    static isSecureString(value: any): boolean {
        return (
            value &&
            typeof value === "object" &&
            value.constructor.name === "SecureString"
        );
    }

    /**
     * Checks if a value is a SecureObject instance
     */
    static isSecureObject(value: any): boolean {
        return (
            value &&
            typeof value === "object" &&
            value.constructor.name === "SecureObject"
        );
    }

    /**
     * Validates serialization options
     */
    static validateSerializationOptions(options: SerializationOptions): void {
        if (options.format && !["json", "binary"].includes(options.format)) {
            throw new Error(
                `Invalid format option: ${options.format}. Must be 'json' or 'binary'.`
            );
        }

        if (
            options.includeMetadata !== undefined &&
            typeof options.includeMetadata !== "boolean"
        ) {
            throw new Error("includeMetadata option must be a boolean");
        }

        if (
            options.encryptSensitive !== undefined &&
            typeof options.encryptSensitive !== "boolean"
        ) {
            throw new Error("encryptSensitive option must be a boolean");
        }
    }

    /**
     * Validates a key for SecureObject operations
     */
    static validateKey(key: any): void {
        if (key === null || key === undefined) {
            throw new Error("Key cannot be null or undefined");
        }

        if (
            typeof key !== "string" &&
            typeof key !== "number" &&
            typeof key !== "symbol"
        ) {
            throw new Error("Key must be a string, number, or symbol");
        }
    }

    /**
     * Validates an array of keys
     */
    static validateKeys(keys: any[]): void {
        if (!Array.isArray(keys)) {
            throw new Error("Keys must be an array");
        }

        keys.forEach((key, index) => {
            try {
                this.validateKey(key);
            } catch (error: any) {
                throw new Error(
                    `Invalid key at index ${index}: ${error.message}`
                );
            }
        });
    }

    /**
     * Validates an encryption key
     */
    static validateEncryptionKey(key: any): void {
        if (key !== null && typeof key !== "string") {
            throw new Error("Encryption key must be a string or null");
        }

        if (typeof key === "string" && key.length === 0) {
            throw new Error("Encryption key cannot be an empty string");
        }
    }

    /**
     * Validates a timeout value
     */
    static validateTimeout(timeout: any): void {
        if (timeout !== undefined) {
            if (
                typeof timeout !== "number" ||
                timeout < 0 ||
                !Number.isFinite(timeout)
            ) {
                throw new Error("Timeout must be a positive finite number");
            }
        }
    }

    /**
     * Validates a limit value for pagination/filtering
     */
    static validateLimit(limit: any): void {
        if (
            typeof limit !== "number" ||
            limit < 1 ||
            !Number.isInteger(limit)
        ) {
            throw new Error("Limit must be a positive integer");
        }
    }

    /**
     * Validates a callback function
     */
    static validateCallback(callback: any, name: string = "callback"): void {
        if (typeof callback !== "function") {
            throw new Error(`${name} must be a function`);
        }
    }

    /**
     * Validates an event listener
     */
    static validateEventListener(listener: any): void {
        this.validateCallback(listener, "Event listener");
    }

    /**
     * Validates an event type
     */
    static validateEventType(event: any): void {
        const validEvents = [
            "set",
            "get",
            "delete",
            "clear",
            "destroy",
            "filtered",
        ];

        if (!validEvents.includes(event)) {
            throw new Error(
                `Invalid event type: ${event}. Must be one of: ${validEvents.join(
                    ", "
                )}`
            );
        }
    }

    /**
     * Validates a predicate function
     */
    static validatePredicate(predicate: any): void {
        this.validateCallback(predicate, "Predicate");
    }

    /**
     * Validates a mapping function
     */
    static validateMapper(mapper: any): void {
        this.validateCallback(mapper, "Mapper function");
    }

    /**
     * Sanitizes a key to ensure it's a string
     */
    static sanitizeKey(key: any): string {
        this.validateKey(key);
        return String(key);
    }

    /**
     * Checks if an object is empty (null, undefined, or has no properties)
     */
    static isEmpty(obj: any): boolean {
        if (obj === null || obj === undefined) {
            return true;
        }

        if (typeof obj === "object") {
            return Object.keys(obj).length === 0;
        }

        return false;
    }

    /**
     * Deep clones a value (for non-secure values only)
     */
    static deepClone<T>(value: T): T {
        if (value === null || typeof value !== "object") {
            return value;
        }

        if (value instanceof Date) {
            return new Date(value.getTime()) as unknown as T;
        }

        if (value instanceof Array) {
            return value.map((item) => this.deepClone(item)) as unknown as T;
        }

        if (value instanceof Uint8Array) {
            return new Uint8Array(value) as unknown as T;
        }

        // For regular objects
        const cloned = {} as T;
        for (const key in value) {
            if (Object.prototype.hasOwnProperty.call(value, key)) {
                (cloned as any)[key] = this.deepClone((value as any)[key]);
            }
        }

        return cloned;
    }

    /**
     * Checks if a value is a primitive type
     */
    static isPrimitive(value: any): boolean {
        return (
            value === null ||
            value === undefined ||
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean" ||
            typeof value === "symbol" ||
            typeof value === "bigint"
        );
    }

    /**
     * Gets the type name of a value
     */
    static getTypeName(value: any): string {
        if (value === null) return "null";
        if (value === undefined) return "undefined";
        if (value instanceof Uint8Array) return "Uint8Array";
        if (Array.isArray(value)) return "Array";
        if (value instanceof Date) return "Date";
        if (this.isSecureString(value)) return "SecureString";
        if (this.isSecureObject(value)) return "SecureObject";

        return typeof value;
    }
}


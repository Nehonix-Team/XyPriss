/**
 * Serialization Handler Module
 * Handles object serialization and format conversion
 */

import { SerializationOptions, ValueMetadata } from "../types";
import { SecureBuffer } from "../../secure-memory";
import { CryptoHandler } from "../encryption/crypto-handler";
import { MetadataManager } from "../metadata/metadata-manager";
import SecureString from "../../secure-string";

/**
 * Handles serialization operations for SecureObject
 */
export class SerializationHandler {
    constructor(
        private cryptoHandler: CryptoHandler,
        private metadataManager: MetadataManager
    ) {}

    /**
     * Converts SecureObject data to a regular object
     */
    toObject<T>(
        data: Map<string, any>,
        sensitiveKeys: Set<string> | ((key: string) => boolean),
        options: SerializationOptions = {}
    ): T & { _metadata?: Record<string, ValueMetadata> } {
        const result = {} as T & { _metadata?: Record<string, ValueMetadata> };

        for (const [key, value] of data.entries()) {
            const metadata = this.metadataManager.get(key);
            const isUserDefinedSensitive =
                typeof sensitiveKeys === "function"
                    ? sensitiveKeys(key)
                    : sensitiveKeys.has(key);

            // Handle sensitive keys
            if (isUserDefinedSensitive) {
                if (options.encryptSensitive) {
                    // Encrypt user-defined sensitive data
                    let valueToEncrypt: any;
                    if (value instanceof SecureBuffer) {
                        const buffer = value.getBuffer();
                        if (metadata?.type === "Uint8Array") {
                            valueToEncrypt = Array.from(new Uint8Array(buffer));
                        } else {
                            valueToEncrypt = new TextDecoder().decode(buffer);
                        }
                    } else if (value instanceof SecureString) {
                        valueToEncrypt = value.toString();
                    } else {
                        valueToEncrypt = value;
                    }
                    (result as any)[key] =
                        this.cryptoHandler.encryptValue(valueToEncrypt);
                }
                // If encryptSensitive is false, skip sensitive keys (filter them out)
                // This is the fix for the nested password filtering bug
            } else {
                // Normal processing - show actual values for non-sensitive keys
                (result as any)[key] = this.processValue(
                    value,
                    metadata,
                    options,
                    sensitiveKeys
                );
            }
        }

        if (options.includeMetadata) {
            result._metadata = this.metadataManager.toObject();
        }

        return this.applyFormat(result, options);
    }

    /**
     * Processes a single value for serialization
     */
    private processValue(
        value: any,
        metadata: ValueMetadata | undefined,
        options: SerializationOptions,
        sensitiveKeys: Set<string> | ((key: string) => boolean)
    ): any {
        if (value instanceof SecureBuffer) {
            const buffer = value.getBuffer();

            if (metadata?.type === "Uint8Array") {
                // Return as Uint8Array for binary data
                return new Uint8Array(buffer);
            } else {
                // Return as string for text data
                return new TextDecoder().decode(buffer);
            }
        } else if (value instanceof SecureString) {
            return value.toString();
        } else if (
            value &&
            typeof value === "object" &&
            typeof value.toObject === "function"
        ) {
            // For nested SecureObjects, recursively process with the same options
            // Pass through the strictSensitiveKeys option to maintain consistency
            return value.toObject(options);
        } else if (typeof value === "object" && value !== null) {
            // For regular nested objects, recursively check for sensitive keys
            // FIXED: Pass the actual sensitive keys instead of empty Set
            return this.cryptoHandler.processNestedObject(
                value,
                options,
                sensitiveKeys
            );
        } else {
            return value;
        }
    }

    /**
     * Applies format transformation to the result
     */
    private applyFormat<T>(result: T, options: SerializationOptions): any {
        if (options.format === "binary") {
            // Convert to binary format (Uint8Array)
            const jsonString = JSON.stringify(result);
            return new TextEncoder().encode(jsonString);
        } else if (options.format === "json") {
            // Return as JSON string
            return JSON.stringify(result);
        }

        // Default: return as regular object
        return result;
    }

    /**
     * Converts to JSON string
     */
    toJSON<T>(
        data: Map<string, any>,
        sensitiveKeys: Set<string> | ((key: string) => boolean),
        options: SerializationOptions = {}
    ): string {
        const obj = this.toObject<T>(data, sensitiveKeys, options);
        return JSON.stringify(obj);
    }

    /**
     * Creates a deterministic representation for hashing
     */
    createHashableRepresentation(entries: Array<[any, any]>): string {
        const sortedEntries = entries.sort(([a], [b]) =>
            String(a).localeCompare(String(b))
        );

        return JSON.stringify(
            sortedEntries.map(([key, value]) => [
                String(key),
                typeof value === "object" && value instanceof Uint8Array
                    ? Array.from(value)
                    : value,
            ])
        );
    }

    /**
     * Processes nested objects recursively for sensitive key detection
     */
    processNestedObject(
        obj: any,
        options: SerializationOptions,
        sensitiveKeys: Set<string> | ((key: string) => boolean)
    ): any {
        return this.cryptoHandler.processNestedObject(
            obj,
            options,
            sensitiveKeys
        );
    }

    /**
     * Validates serialization options
     */
    validateOptions(options: SerializationOptions): void {
        if (options.format && !["json", "binary"].includes(options.format)) {
            throw new Error(
                `Invalid format option: ${options.format}. Must be 'json' or 'binary'.`
            );
        }
    }

    /**
     * Gets serialization statistics
     */
    getSerializationStats(data: Map<string, any>): {
        totalKeys: number;
        secureBufferCount: number;
        secureStringCount: number;
        nestedObjectCount: number;
        primitiveCount: number;
    } {
        let secureBufferCount = 0;
        let secureStringCount = 0;
        let nestedObjectCount = 0;
        let primitiveCount = 0;

        for (const value of data.values()) {
            if (value instanceof SecureBuffer) {
                secureBufferCount++;
            } else if (value instanceof SecureString) {
                secureStringCount++;
            } else if (typeof value === "object" && value !== null) {
                nestedObjectCount++;
            } else {
                primitiveCount++;
            }
        }

        return {
            totalKeys: data.size,
            secureBufferCount,
            secureStringCount,
            nestedObjectCount,
            primitiveCount,
        };
    }

    /**
     * Estimates serialized size
     */
    estimateSerializedSize(
        data: Map<string, any>,
        options: SerializationOptions = {}
    ): number {
        try {
            const serialized = this.toJSON(data, new Set(), options);
            return new TextEncoder().encode(serialized).length;
        } catch (error) {
            // Fallback estimation
            return data.size * 50; // Rough estimate
        }
    }
}

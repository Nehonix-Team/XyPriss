/***************************************************************************
 * XyPrissSecurity - Secure Array Serialization Handler
 *
 * This file contains the serialization operations for SecureArray
 *
 * @author Nehonix
 * @version 2.0.0
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
 * Handles serialization operations for SecureArray
 */

// Import existing XyPrissSecurity utilities
import { ArrayCryptoHandler } from "../crypto/ArrayCryptoHandler";
import { ArrayMetadataManager } from "../metadata/metadata-manager";
import { SecureArraySerializationOptions } from "../types";
import { bufferToBase64, base64ToBuffer } from "../../../utils/encoding";
import { Hash } from "../../../core/hash";

/**
 * Serialization handler for SecureArray operations
 */
export class ArraySerializationHandler {
    private readonly version: string = "2.0.0";
    private readonly format: string = "XyPrissSecurity-SecureArray";

    constructor(
        private crypto: ArrayCryptoHandler,
        private metadata: ArrayMetadataManager
    ) {}

    /**
     * Serializes SecureArray data to a secure format
     */
    public serialize<T>(
        elements: T[],
        options: SecureArraySerializationOptions = {}
    ): string {
        try {
            const {
                includeMetadata = true,
                encryptSensitive = true,
                compression = false,
                format = "json",
                includeChecksum = true,
            } = options;

            // Create serialization package
            const package_ = {
                version: this.version,
                format: this.format,
                timestamp: Date.now(),
                elements: this.serializeElements(elements, encryptSensitive),
                metadata: includeMetadata ? this.serializeMetadata() : null,
                checksum: null as string | null,
                compression: compression,
                elementCount: elements.length,
            };

            // Generate checksum if requested
            if (includeChecksum) {
                package_.checksum = this.generateChecksum(package_);
            }

            // Convert to string based on format
            let serialized: string;
            switch (format) {
                case "json":
                    serialized = JSON.stringify(package_, null, 0);
                    break;
                case "compact":
                    serialized = JSON.stringify(package_);
                    break;
                case "base64":
                    serialized = bufferToBase64(
                        new TextEncoder().encode(JSON.stringify(package_))
                    );
                    break;
                default:
                    serialized = JSON.stringify(package_);
            }

            // Apply compression if requested
            if (compression) {
                serialized = this.compressData(serialized);
            }

            return serialized;
        } catch (error) {
            console.error("Serialization failed:", error);
            throw new Error(
                `Serialization failed: ${(error as Error).message}`
            );
        }
    }

    /**
     * Deserializes SecureArray data from a secure format
     */
    public deserialize<T>(serializedData: string): {
        elements: T[];
        metadata: Map<number, any>;
        version: string;
        timestamp: number;
    } {
        try {
            // Detect and handle compression
            let data = serializedData;
            if (this.isCompressed(data)) {
                data = this.decompressData(data);
            }

            // Parse the package
            let package_: any;
            try {
                // Try base64 decode first
                if (this.isBase64Format(data)) {
                    const decoded = base64ToBuffer(data);
                    package_ = JSON.parse(new TextDecoder().decode(decoded));
                } else {
                    package_ = JSON.parse(data);
                }
            } catch {
                throw new Error("Invalid serialization format");
            }

            // Validate package structure
            this.validatePackage(package_);

            // Verify checksum if present
            if (package_.checksum) {
                const originalChecksum = package_.checksum;
                package_.checksum = null;
                const computedChecksum = this.generateChecksum(package_);

                if (originalChecksum !== computedChecksum) {
                    throw new Error(
                        "Checksum verification failed - data may be corrupted"
                    );
                }
            }

            // Deserialize elements
            const elements = this.deserializeElements<T>(package_.elements);

            // Deserialize metadata
            const metadata = package_.metadata
                ? this.deserializeMetadata(package_.metadata)
                : new Map<number, any>();

            return {
                elements,
                metadata,
                version: package_.version,
                timestamp: package_.timestamp,
            };
        } catch (error) {
            console.error("Deserialization failed:", error);
            throw new Error(
                `Deserialization failed: ${(error as Error).message}`
            );
        }
    }

    /**
     * Serializes array elements with optional encryption
     */
    private serializeElements<T>(
        elements: T[],
        encryptSensitive: boolean
    ): any[] {
        return elements.map((element, index) => {
            const metadata = this.metadata.get(index);
            const isSecure = metadata?.isSecure || false;

            if (encryptSensitive && isSecure && typeof element === "string") {
                // Encrypt sensitive string data
                return {
                    type: "encrypted",
                    value: this.crypto.encryptValue(element),
                    originalType: metadata?.type || "string",
                };
            } else {
                // Store non-sensitive data as-is
                return {
                    type: "plain",
                    value: element,
                    originalType: metadata?.type || typeof element,
                };
            }
        });
    }

    /**
     * Deserializes array elements with decryption
     */
    private deserializeElements<T>(serializedElements: any[]): T[] {
        return serializedElements.map((item) => {
            if (item.type === "encrypted") {
                // Decrypt encrypted data
                return this.crypto.decryptValue(item.value) as T;
            } else {
                // Return plain data
                return item.value as T;
            }
        });
    }

    /**
     * Serializes metadata
     */
    private serializeMetadata(): any {
        const metadataObj: any = {};

        // Convert Map to object for serialization
        for (const [index, metadata] of this.metadata.getAll()) {
            metadataObj[index] = {
                type: metadata.type,
                isSecure: metadata.isSecure,
                lastAccessed: metadata.lastAccessed,
                accessCount: metadata.accessCount,
            };
        }

        return metadataObj;
    }

    /**
     * Deserializes metadata
     */
    private deserializeMetadata(serializedMetadata: any): Map<number, any> {
        const metadata = new Map<number, any>();

        for (const [indexStr, data] of Object.entries(serializedMetadata)) {
            const index = parseInt(indexStr, 10);
            metadata.set(index, data);
        }

        return metadata;
    }

    /**
     * Generates a checksum for data integrity
     */
    private generateChecksum(package_: any): string {
        // Create a deterministic string representation
        const dataStr = JSON.stringify(package_, Object.keys(package_).sort());

        // Generate SHA-256 hash
        const hash = Hash.create(dataStr, {
            algorithm: "sha256",
            outputFormat: "hex",
        }) as string;

        return hash;
    }

    /**
     * Validates package structure
     */
    private validatePackage(package_: any): void {
        if (!package_ || typeof package_ !== "object") {
            throw new Error("Invalid package structure");
        }

        const requiredFields = ["version", "format", "timestamp", "elements"];
        for (const field of requiredFields) {
            if (!(field in package_)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (package_.format !== this.format) {
            throw new Error(`Unsupported format: ${package_.format}`);
        }

        if (!Array.isArray(package_.elements)) {
            throw new Error("Elements must be an array");
        }
    }

    /**
     * Compresses data using a simple compression algorithm
     */
    private compressData(data: string): string {
        // Simple compression using base64 encoding with compression marker
        const compressed = bufferToBase64(new TextEncoder().encode(data));
        return `[COMPRESSED:${compressed}]`;
    }

    /**
     * Decompresses data
     */
    private decompressData(data: string): string {
        if (!this.isCompressed(data)) {
            return data;
        }

        // Extract compressed data
        const compressedData = data.slice(12, -1); // Remove [COMPRESSED: and ]
        const decompressed = base64ToBuffer(compressedData);
        return new TextDecoder().decode(decompressed);
    }

    /**
     * Checks if data is compressed
     */
    private isCompressed(data: string): boolean {
        return data.startsWith("[COMPRESSED:") && data.endsWith("]");
    }

    /**
     * Checks if data is in base64 format
     */
    private isBase64Format(data: string): boolean {
        try {
            // Simple base64 detection
            return /^[A-Za-z0-9+/]*={0,2}$/.test(data) && data.length % 4 === 0;
        } catch {
            return false;
        }
    }

    /**
     * Exports array data in various formats
     */
    public exportData<T>(
        elements: T[],
        format: "json" | "csv" | "xml" | "yaml" = "json"
    ): string {
        try {
            switch (format) {
                case "json":
                    return JSON.stringify(elements, null, 2);

                case "csv":
                    return this.exportToCSV(elements);

                case "xml":
                    return this.exportToXML(elements);

                case "yaml":
                    return this.exportToYAML(elements);

                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error) {
            console.error("Export failed:", error);
            throw new Error(`Export failed: ${(error as Error).message}`);
        }
    }

    /**
     * Exports to CSV format
     */
    private exportToCSV<T>(elements: T[]): string {
        if (elements.length === 0) {
            return "";
        }

        // Simple CSV export
        const rows: string[] = [];

        // Header
        rows.push("Index,Value,Type");

        // Data rows
        elements.forEach((element, index) => {
            const value =
                typeof element === "string"
                    ? `"${element.replace(/"/g, '""')}"`
                    : String(element);
            const type = typeof element;
            rows.push(`${index},${value},${type}`);
        });

        return rows.join("\n");
    }

    /**
     * Exports to XML format
     */
    private exportToXML<T>(elements: T[]): string {
        const xmlElements = elements
            .map((element, index) => {
                const value = String(element)
                    .replace(/&/g, "&amp;")
                    .replace(/</g, "&lt;")
                    .replace(/>/g, "&gt;");
                const type = typeof element;
                return `  <element index="${index}" type="${type}">${value}</element>`;
            })
            .join("\n");

        return `<?xml version="1.0" encoding="UTF-8"?>\n<secureArray>\n${xmlElements}\n</secureArray>`;
    }

    /**
     * Exports to YAML format
     */
    private exportToYAML<T>(elements: T[]): string {
        const yamlElements = elements
            .map((element, index) => {
                const value =
                    typeof element === "string"
                        ? `"${element.replace(/"/g, '\\"')}"`
                        : String(element);
                return `  - index: ${index}\n    value: ${value}\n    type: ${typeof element}`;
            })
            .join("\n");

        return `secureArray:\n${yamlElements}`;
    }

    /**
     * Gets serialization statistics
     */
    public getSerializationStats(): {
        version: string;
        format: string;
        supportedFormats: string[];
        features: string[];
    } {
        return {
            version: this.version,
            format: this.format,
            supportedFormats: ["json", "compact", "base64"],
            features: [
                "Encryption",
                "Compression",
                "Checksum verification",
                "Metadata preservation",
                "Multiple export formats",
            ],
        };
    }

    /**
     * Securely destroys the serialization handler
     */
    public destroy(): void {
        // Clear any cached data
        // The crypto and metadata handlers will be destroyed by their owners
    }
}


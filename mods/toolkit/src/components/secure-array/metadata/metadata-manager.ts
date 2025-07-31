/***************************************************************************
 * XyPrissSecurity - Secure Array Metadata Manager
 *
 * This file contains the metadata management system for SecureArray
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
 * Metadata manager for SecureArray elements
 */

import { ElementMetadata, SecureArrayStats } from "../types";

/**
 * Manages metadata for SecureArray elements
 */
export class ArrayMetadataManager {
    private metadata: Map<number, ElementMetadata> = new Map();

    /**
     * Updates metadata for an element at the specified index
     */
    public update(
        index: number,
        type: string,
        isSecure: boolean,
        accessed: boolean = false
    ): void {
        const existing = this.metadata.get(index);
        const now = new Date();

        if (existing) {
            existing.type = type;
            existing.isSecure = isSecure;
            if (accessed) {
                existing.lastAccessed = now;
                existing.accessCount++;
            }
        } else {
            this.metadata.set(index, {
                type,
                isSecure,
                created: now,
                lastAccessed: now,
                accessCount: accessed ? 1 : 0,
                index,
            });
        }
    }

    /**
     * Gets metadata for an element at the specified index
     */
    public get(index: number): ElementMetadata | undefined {
        return this.metadata.get(index);
    }

    /**
     * Checks if metadata exists for an element at the specified index
     */
    public has(index: number): boolean {
        return this.metadata.has(index);
    }

    /**
     * Deletes metadata for an element at the specified index
     */
    public delete(index: number): boolean {
        return this.metadata.delete(index);
    }

    /**
     * Gets all metadata
     */
    public getAll(): Map<number, ElementMetadata> {
        return new Map(this.metadata);
    }

    /**
     * Clears all metadata
     */
    public clear(): void {
        this.metadata.clear();
    }

    /**
     * Gets statistics about the metadata
     */
    public getStats(): {
        totalElements: number;
        secureElements: number;
        totalAccesses: number;
        averageAccessCount: number;
        oldestElement: Date | null;
        newestElement: Date | null;
    } {
        if (this.metadata.size === 0) {
            return {
                totalElements: 0,
                secureElements: 0,
                totalAccesses: 0,
                averageAccessCount: 0,
                oldestElement: null,
                newestElement: null,
            };
        }

        let secureElements = 0;
        let totalAccesses = 0;
        let oldestElement: Date | null = null;
        let newestElement: Date | null = null;

        for (const metadata of this.metadata.values()) {
            if (metadata.isSecure) {
                secureElements++;
            }
            totalAccesses += metadata.accessCount;

            if (!oldestElement || metadata.created < oldestElement) {
                oldestElement = metadata.created;
            }
            if (!newestElement || metadata.created > newestElement) {
                newestElement = metadata.created;
            }
        }

        return {
            totalElements: this.metadata.size,
            secureElements,
            totalAccesses,
            averageAccessCount: totalAccesses / this.metadata.size,
            oldestElement,
            newestElement,
        };
    }

    /**
     * Compacts metadata by removing entries for indices that no longer exist
     */
    public compact(maxIndex: number): void {
        const toDelete: number[] = [];

        for (const index of this.metadata.keys()) {
            if (index >= maxIndex) {
                toDelete.push(index);
            }
        }

        for (const index of toDelete) {
            this.metadata.delete(index);
        }
    }

    /**
     * Shifts metadata indices when elements are inserted or removed
     */
    public shiftIndices(startIndex: number, shift: number): void {
        const newMetadata = new Map<number, ElementMetadata>();

        for (const [index, metadata] of this.metadata.entries()) {
            if (index >= startIndex) {
                const newIndex = index + shift;
                if (newIndex >= 0) {
                    metadata.index = newIndex;
                    newMetadata.set(newIndex, metadata);
                }
            } else {
                newMetadata.set(index, metadata);
            }
        }

        this.metadata = newMetadata;
    }

    /**
     * Gets metadata for secure elements only
     */
    public getSecureElementsMetadata(): Map<number, ElementMetadata> {
        const secureMetadata = new Map<number, ElementMetadata>();

        for (const [index, metadata] of this.metadata.entries()) {
            if (metadata.isSecure) {
                secureMetadata.set(index, metadata);
            }
        }

        return secureMetadata;
    }

    /**
     * Gets elements that haven't been accessed recently
     */
    public getStaleElements(maxAge: number): number[] {
        const now = new Date();
        const staleIndices: number[] = [];

        for (const [index, metadata] of this.metadata.entries()) {
            const age = now.getTime() - metadata.lastAccessed.getTime();
            if (age > maxAge) {
                staleIndices.push(index);
            }
        }

        return staleIndices;
    }

    /**
     * Gets the most frequently accessed elements
     */
    public getMostAccessedElements(
        limit: number = 10
    ): Array<{ index: number; accessCount: number }> {
        const elements = Array.from(this.metadata.entries())
            .map(([index, metadata]) => ({
                index,
                accessCount: metadata.accessCount,
            }))
            .sort((a, b) => b.accessCount - a.accessCount)
            .slice(0, limit);

        return elements;
    }

    /**
     * Gets elements by type
     */
    public getElementsByType(type: string): number[] {
        const indices: number[] = [];

        for (const [index, metadata] of this.metadata.entries()) {
            if (metadata.type === type) {
                indices.push(index);
            }
        }

        return indices;
    }

    /**
     * Validates metadata integrity
     */
    public validateIntegrity(): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check for negative indices
        for (const index of this.metadata.keys()) {
            if (index < 0) {
                errors.push(`Invalid negative index: ${index}`);
            }
        }

        // Check for metadata consistency
        for (const [index, metadata] of this.metadata.entries()) {
            if (metadata.index !== index) {
                errors.push(
                    `Index mismatch: metadata.index=${metadata.index}, key=${index}`
                );
            }

            if (metadata.accessCount < 0) {
                errors.push(
                    `Invalid access count: ${metadata.accessCount} at index ${index}`
                );
            }

            if (metadata.created > new Date()) {
                warnings.push(`Future creation date at index ${index}`);
            }

            if (metadata.lastAccessed < metadata.created) {
                warnings.push(
                    `Last accessed before creation at index ${index}`
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
     * Exports metadata to a serializable format
     */
    public export(): Array<[number, ElementMetadata]> {
        return Array.from(this.metadata.entries());
    }

    /**
     * Imports metadata from a serializable format
     */
    public import(data: Array<[number, ElementMetadata]>): void {
        this.metadata.clear();
        for (const [index, metadata] of data) {
            this.metadata.set(index, {
                ...metadata,
                created: new Date(metadata.created),
                lastAccessed: new Date(metadata.lastAccessed),
            });
        }
    }

    /**
     * Gets the size of the metadata map
     */
    public size(): number {
        return this.metadata.size;
    }

    /**
     * Gets all metadata (alias for getAll)
     */
    public getAllMetadata(): Map<number, ElementMetadata> {
        return this.getAll();
    }

    /**
     * Handles splice operations on metadata
     */
    public splice(
        start: number,
        deleteCount: number,
        insertCount: number
    ): void {
        const newMetadata = new Map<number, ElementMetadata>();

        // Copy metadata before the splice point
        for (const [index, metadata] of this.metadata.entries()) {
            if (index < start) {
                newMetadata.set(index, metadata);
            } else if (index >= start + deleteCount) {
                // Shift indices after the splice point
                const newIndex = index - deleteCount + insertCount;
                metadata.index = newIndex;
                newMetadata.set(newIndex, metadata);
            }
            // Skip metadata in the deleted range
        }

        this.metadata = newMetadata;
    }

    /**
     * Reverses the metadata indices
     */
    public reverse(length: number): void {
        const newMetadata = new Map<number, ElementMetadata>();

        for (const [index, metadata] of this.metadata.entries()) {
            const newIndex = length - 1 - index;
            metadata.index = newIndex;
            newMetadata.set(newIndex, metadata);
        }

        this.metadata = newMetadata;
    }

    /**
     * Reorders metadata based on new index mapping
     */
    public reorder(newIndices: number[]): void {
        const newMetadata = new Map<number, ElementMetadata>();

        for (let i = 0; i < newIndices.length; i++) {
            const oldIndex = newIndices[i];
            const metadata = this.metadata.get(oldIndex);
            if (metadata) {
                metadata.index = i;
                newMetadata.set(i, metadata);
            }
        }

        this.metadata = newMetadata;
    }
}


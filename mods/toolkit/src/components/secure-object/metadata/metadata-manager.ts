/**
 * Metadata Manager Module
 * Handles metadata tracking for SecureObject values
 */

import { ValueMetadata } from "../types";

/**
 * Manages metadata for SecureObject values
 */
export class MetadataManager {
    private metadata: Map<string, ValueMetadata> = new Map();

    /** 
     * Updates metadata for a key
     */
    update(
        key: string,
        type: string,
        isSecure: boolean,
        isAccess: boolean = false
    ): void {
        const existing = this.metadata.get(key);
        const now = new Date();

        if (existing && isAccess) {
            existing.lastAccessed = now;
            existing.accessCount++;
        } else {
            this.metadata.set(key, {
                type,
                isSecure,
                created: existing?.created ?? now,
                lastAccessed: now,
                accessCount: (existing?.accessCount ?? 0) + 1,
            });
        }
    }

    /**
     * Gets metadata for a specific key
     */
    get(key: string): ValueMetadata | undefined {
        return this.metadata.get(key);
    }

    /**
     * Gets all metadata
     */
    getAll(): Map<string, ValueMetadata> {
        return new Map(this.metadata);
    }

    /**
     * Checks if metadata exists for a key
     */
    has(key: string): boolean {
        return this.metadata.has(key);
    }

    /**
     * Deletes metadata for a key
     */
    delete(key: string): boolean {
        return this.metadata.delete(key);
    }

    /**
     * Clears all metadata
     */
    clear(): void {
        this.metadata.clear();
    }

    /**
     * Gets the number of metadata entries
     */
    get size(): number {
        return this.metadata.size;
    }

    /**
     * Gets all keys that have metadata
     */
    keys(): string[] {
        return Array.from(this.metadata.keys());
    }

    /**
     * Gets all metadata values
     */
    values(): ValueMetadata[] {
        return Array.from(this.metadata.values());
    }

    /**
     * Gets all metadata entries as [key, metadata] pairs
     */
    entries(): [string, ValueMetadata][] {
        return Array.from(this.metadata.entries());
    }

    /**
     * Gets statistics about the metadata
     */
    getStats(): {
        totalEntries: number;
        secureEntries: number;
        totalAccesses: number;
        averageAccesses: number;
        oldestEntry: Date | null;
        newestEntry: Date | null;
    } {
        const entries = this.values();
        
        if (entries.length === 0) {
            return {
                totalEntries: 0,
                secureEntries: 0,
                totalAccesses: 0,
                averageAccesses: 0,
                oldestEntry: null,
                newestEntry: null,
            };
        }

        const secureEntries = entries.filter(meta => meta.isSecure).length;
        const totalAccesses = entries.reduce((sum, meta) => sum + meta.accessCount, 0);
        const averageAccesses = totalAccesses / entries.length;
        
        const dates = entries.map(meta => meta.created);
        const oldestEntry = new Date(Math.min(...dates.map(d => d.getTime())));
        const newestEntry = new Date(Math.max(...dates.map(d => d.getTime())));

        return {
            totalEntries: entries.length,
            secureEntries,
            totalAccesses,
            averageAccesses,
            oldestEntry,
            newestEntry,
        };
    }

    /**
     * Filters metadata by criteria
     */
    filter(predicate: (key: string, metadata: ValueMetadata) => boolean): Map<string, ValueMetadata> {
        const filtered = new Map<string, ValueMetadata>();
        
        for (const [key, metadata] of this.metadata.entries()) {
            if (predicate(key, metadata)) {
                filtered.set(key, metadata);
            }
        }
        
        return filtered;
    }

    /**
     * Gets metadata for secure values only
     */
    getSecureMetadata(): Map<string, ValueMetadata> {
        return this.filter((_, metadata) => metadata.isSecure);
    }

    /**
     * Gets metadata for non-secure values only
     */
    getNonSecureMetadata(): Map<string, ValueMetadata> {
        return this.filter((_, metadata) => !metadata.isSecure);
    }

    /**
     * Gets the most accessed keys
     */
    getMostAccessed(limit: number = 10): [string, ValueMetadata][] {
        return this.entries()
            .sort(([, a], [, b]) => b.accessCount - a.accessCount)
            .slice(0, limit);
    }

    /**
     * Gets the least accessed keys
     */
    getLeastAccessed(limit: number = 10): [string, ValueMetadata][] {
        return this.entries()
            .sort(([, a], [, b]) => a.accessCount - b.accessCount)
            .slice(0, limit);
    }

    /**
     * Converts metadata to a plain object for serialization
     */
    toObject(): Record<string, ValueMetadata> {
        return Object.fromEntries(this.metadata.entries());
    }

    /**
     * Creates a MetadataManager from a plain object
     */
    static fromObject(obj: Record<string, ValueMetadata>): MetadataManager {
        const manager = new MetadataManager();
        
        for (const [key, metadata] of Object.entries(obj)) {
            // Ensure dates are properly converted
            const convertedMetadata: ValueMetadata = {
                ...metadata,
                created: new Date(metadata.created),
                lastAccessed: new Date(metadata.lastAccessed),
            };
            manager.metadata.set(key, convertedMetadata);
        }
        
        return manager;
    }
}

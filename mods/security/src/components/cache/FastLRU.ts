import { CacheStats, MemoryCacheEntry } from "./types/cache.type";
import { FastLRUConfig, UltraMemoryCacheEntry } from "./types/UFSIMC.type";

//  LRU Node with better type safety and additional metadata
class LRUNode<T = MemoryCacheEntry | UltraMemoryCacheEntry> {
    key: string;
    entry: T | null;
    prev: LRUNode<T> | null = null;
    next: LRUNode<T> | null = null;
    accessCount: number = 0;
    createdAt: number;
    lastAccessed: number;

    constructor(key: string, entry: T | null) {
        this.key = key;
        this.entry = entry;
        this.createdAt = Date.now();
        this.lastAccessed = this.createdAt;
    }

    updateAccess(): void {
        this.lastAccessed = Date.now();
        this.accessCount++;
    }
}

// Performance-optimized and feature-rich LRU Cache
export class FastLRU<T = MemoryCacheEntry | UltraMemoryCacheEntry> {
    private readonly capacity: number;
    private readonly ttl?: number;
    private readonly enableStats: boolean;
    private readonly onEvict?: (key: string, entry: any) => void;

    private size = 0;
    private head: LRUNode<T>;
    private tail: LRUNode<T>;
    private map = new Map<string, LRUNode<T>>();

    // Statistics tracking
    private stats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        totalAccesses: 0,
    };

    // TTL cleanup timer
    private cleanupTimer?: NodeJS.Timeout;

    constructor(config: FastLRUConfig | number) {
        // Support both old constructor signature and new config object
        if (typeof config === "number") {
            this.capacity = config;
            this.enableStats = false;
        } else {
            this.capacity = config.capacity;
            this.ttl = config.ttl;
            this.enableStats = config.enableStats ?? false;
            this.onEvict = config.onEvict;
        }

        // Initialize sentinel nodes
        this.head = new LRUNode<T>("__HEAD__", null);
        this.tail = new LRUNode<T>("__TAIL__", null);
        this.head.next = this.tail;
        this.tail.prev = this.head;

        // Setup TTL cleanup if enabled
        if (this.ttl) {
            this.setupTTLCleanup();
        }
    }

    get(key: string): T | undefined {
        if (this.enableStats) {
            this.stats.totalAccesses++;
        }

        const node = this.map.get(key);
        if (!node) {
            if (this.enableStats) this.stats.misses++;
            return undefined;
        }

        // Check TTL expiration
        if (this.ttl && this.isExpired(node)) {
            this.delete(key);
            if (this.enableStats) this.stats.misses++;
            return undefined;
        }

        // Update access tracking
        node.updateAccess();
        this.moveToHead(node);

        if (this.enableStats) this.stats.hits++;
        return node.entry as T;
    }

    put(key: string, entry: T): T | null {
        const existingNode = this.map.get(key);

        if (existingNode) {
            // Update existing entry
            existingNode.entry = entry;
            existingNode.updateAccess();
            this.moveToHead(existingNode);
            return null;
        }

        // Create new node
        const newNode = new LRUNode<T>(key, entry);
        this.map.set(key, newNode);
        this.addToHead(newNode);
        this.size++;

        // Handle capacity overflow
        if (this.size > this.capacity) {
            const evicted = this.removeTail();
            if (evicted) {
                this.map.delete(evicted.key);
                this.size--;

                if (this.enableStats) this.stats.evictions++;
                if (this.onEvict && evicted.entry) {
                    this.onEvict(evicted.key, evicted.entry);
                }

                return evicted.entry;
            }
        }

        return null;
    }

    has(key: string): boolean {
        const node = this.map.get(key);
        if (!node) return false;

        // Check TTL without updating access
        if (this.ttl && this.isExpired(node)) {
            this.delete(key);
            return false;
        }

        return true;
    }

    peek(key: string): T | undefined {
        // Get without updating LRU order
        const node = this.map.get(key);
        if (!node) return undefined;

        if (this.ttl && this.isExpired(node)) {
            this.delete(key);
            return undefined;
        }

        return node.entry as T;
    }

    delete(key: string): boolean {
        const node = this.map.get(key);
        if (!node) return false;

        this.removeNode(node);
        this.map.delete(key);
        this.size--;

        if (this.onEvict && node.entry) {
            this.onEvict(node.key, node.entry);
        }

        return true;
    }

    clear(): void {
        if (this.onEvict) {
            // Call onEvict for all entries being cleared
            for (const [key, node] of this.map) {
                if (node.entry) {
                    this.onEvict(key, node.entry);
                }
            }
        }

        this.map.clear();
        this.size = 0;
        this.head.next = this.tail;
        this.tail.prev = this.head;

        // Reset stats
        if (this.enableStats) {
            this.stats = { hits: 0, misses: 0, evictions: 0, totalAccesses: 0 };
        }
    }

    //  iteration methods
    keys(): IterableIterator<string> {
        return this.map.keys();
    }

    values(): IterableIterator<T> {
        const values: T[] = [];
        for (const node of this.map.values()) {
            if (node.entry !== null) {
                values.push(node.entry);
            }
        }
        return values[Symbol.iterator]();
    }

    entries(): IterableIterator<[string, T]> {
        const entries: [string, T][] = [];
        for (const [key, node] of this.map) {
            if (node.entry !== null) {
                entries.push([key, node.entry]);
            }
        }
        return entries[Symbol.iterator]();
    }

    // Get all keys as array (for compatibility)
    getKeys(): string[] {
        return Array.from(this.map.keys());
    }

    // Get keys in LRU order (most recent first)
    getKeysInOrder(): string[] {
        const keys: string[] = [];
        let current = this.head.next;

        while (current && current !== this.tail) {
            keys.push(current.key);
            current = current.next;
        }

        return keys;
    }

    // Get internal node (for compatibility with UFSIMC)
    getNode(key: string): { entry: T; key: string } | null {
        const node = this.map.get(key);
        if (!node || !node.entry) return null;

        // Check TTL expiration
        if (this.ttl && this.isExpired(node)) {
            this.delete(key);
            return null;
        }

        return {
            entry: node.entry,
            key: node.key,
        };
    }

    // Get least recently used entries
    getLRUEntries(
        count: number
    ): Array<{ key: string; entry: T; lastAccessed: number }> {
        const entries: Array<{ key: string; entry: T; lastAccessed: number }> =
            [];
        let current = this.tail.prev;
        let collected = 0;

        while (current && current !== this.head && collected < count) {
            if (current.entry !== null) {
                entries.push({
                    key: current.key,
                    entry: current.entry,
                    lastAccessed: current.lastAccessed,
                });
                collected++;
            }
            current = current.prev;
        }

        return entries;
    }

    getSize(): number {
        return this.size;
    }

    getCapacity(): number {
        return this.capacity;
    }

    // Get comprehensive cache statistics
    getStats(): CacheStats {
        if (!this.enableStats) {
            throw new Error(
                "Statistics are not enabled. Enable stats in constructor config."
            );
        }

        const memoryUsage = this.getMemoryUsage();
        return {
            ...this.stats,
            hitRate:
                this.stats.totalAccesses > 0
                    ? this.stats.hits / this.stats.totalAccesses
                    : 0,
            size: this.size,
            capacity: this.capacity,
            totalSize: memoryUsage.bytes,
            entryCount: this.size,
            memoryUsage: {
                used: memoryUsage.bytes,
                limit: this.capacity * 1000, // Rough estimate
                percentage:
                    this.capacity > 0 ? (this.size / this.capacity) * 100 : 0,
            },
        };
    }

    // Memory usage estimation
    getMemoryUsage(): { approximate: boolean; bytes: number } {
        // Rough estimation - actual memory usage depends on entry content
        const nodeOverhead = 120; // Approximate bytes per node
        const mapOverhead = 24; // Approximate bytes per map entry

        return {
            approximate: true,
            bytes: this.size * (nodeOverhead + mapOverhead),
        };
    }

    // Cleanup and resource management
    destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.clear();
    }

    // Private helper methods
    private addToHead(node: LRUNode<T>): void {
        node.prev = this.head;
        node.next = this.head.next;
        if (this.head.next) {
            this.head.next.prev = node;
        }
        this.head.next = node;
    }

    private removeNode(node: LRUNode<T>): void {
        if (node.prev) node.prev.next = node.next;
        if (node.next) node.next.prev = node.prev;
    }

    private moveToHead(node: LRUNode<T>): void {
        this.removeNode(node);
        this.addToHead(node);
    }

    private removeTail(): LRUNode<T> | null {
        const lastNode = this.tail.prev;
        if (lastNode && lastNode !== this.head) {
            this.removeNode(lastNode);
            return lastNode;
        }
        return null;
    }

    private isExpired(node: LRUNode<T>): boolean {
        if (!this.ttl) return false;
        return Date.now() - node.createdAt > this.ttl;
    }

    private setupTTLCleanup(): void {
        const cleanupInterval = Math.min(this.ttl! / 4, 60000); // Cleanup every 1/4 TTL or 1 minute, whichever is smaller

        this.cleanupTimer = setInterval(() => {
            const now = Date.now();
            const keysToDelete: string[] = [];

            for (const [key, node] of this.map) {
                if (now - node.createdAt > this.ttl!) {
                    keysToDelete.push(key);
                }
            }

            for (const key of keysToDelete) {
                this.delete(key);
            }
        }, cleanupInterval);
    }
}

// Factory function for easy instantiation
export function createFastLRU<T = MemoryCacheEntry | UltraMemoryCacheEntry>(
    config: FastLRUConfig
): FastLRU<T> {
    return new FastLRU<T>(config);
}

// Utility types for better TypeScript integration
export type { FastLRUConfig, CacheStats };
export { LRUNode };


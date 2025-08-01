/**
 * Advanced Memory Pool Implementation
 *
 * Provides efficient object pooling with multiple strategies and comprehensive monitoring
 */

import {
    MemoryPool,
    PoolConfig,
    PoolStats,
    PoolStrategy,
    PoolItem,
    MemoryEventType,
} from "./types";
import { MemoryEventManager } from "./event-manager";

/**
 * Advanced memory pool with multiple strategies and monitoring
 */
export class AdvancedMemoryPool<T> implements MemoryPool<T> {
    private items: PoolItem<T>[] = [];
    private config: PoolConfig<T>;
    private eventManager: MemoryEventManager;
    private stats: {
        totalAcquisitions: number;
        totalReleases: number;
        hits: number;
        misses: number;
        createdAt: number;
        lastUsed: number;
    };

    constructor(config: PoolConfig<T>, eventManager: MemoryEventManager) {
        this.config = config;
        this.eventManager = eventManager;
        this.stats = {
            totalAcquisitions: 0,
            totalReleases: 0,
            hits: 0,
            misses: 0,
            createdAt: Date.now(),
            lastUsed: Date.now(),
        };

        this.eventManager.emit(MemoryEventType.POOL_CREATED, {
            name: config.name,
            strategy: config.strategy,
            capacity: config.capacity,
        });
    }

    /**
     * Acquire an item from the pool
     */
    acquire(): T {
        this.stats.totalAcquisitions++;
        this.stats.lastUsed = Date.now();

        // Try to get an item from the pool
        const poolItem = this.getItemFromPool();

        if (poolItem) {
            this.stats.hits++;
            poolItem.lastUsed = Date.now();
            poolItem.usageCount++;

            // Call onAcquire callback if provided
            this.config.onAcquire?.(poolItem.item);

            return poolItem.item;
        } else {
            // Create new item
            this.stats.misses++;
            const newItem = this.config.factory();

            // Call onAcquire callback if provided
            this.config.onAcquire?.(newItem);

            return newItem;
        }
    }

    /**
     * Release an item back to the pool
     */
    release(item: T): void {
        this.stats.totalReleases++;
        this.stats.lastUsed = Date.now();

        // Validate item if validator is provided
        if (this.config.validator && !this.config.validator(item)) {
            return; // Don't add invalid items to pool
        }

        // Check if pool has capacity
        if (this.items.length >= this.config.capacity) {
            // Pool is full, apply strategy to make room
            this.makeRoom();
        }

        // Reset the item
        try {
            this.config.reset(item);
        } catch (error) {
            this.eventManager.emit(MemoryEventType.ERROR_OCCURRED, {
                error: `Failed to reset item in pool ${this.config.name}: ${error}`,
                poolName: this.config.name,
            });
            return; // Don't add item that failed to reset
        }

        // Create pool item wrapper
        const poolItem: PoolItem<T> = {
            item,
            createdAt: Date.now(),
            lastUsed: Date.now(),
            usageCount: 0,
        };

        // Add to pool based on strategy
        this.addItemToPool(poolItem);

        // Call onRelease callback if provided
        this.config.onRelease?.(item);
    }

    /**
     * Get item from pool based on strategy
     */
    private getItemFromPool(): PoolItem<T> | null {
        if (this.items.length === 0) {
            return null;
        }

        // Remove expired items first
        this.removeExpiredItems();

        if (this.items.length === 0) {
            return null;
        }

        switch (this.config.strategy) {
            case PoolStrategy.LIFO:
                return this.items.pop() || null;

            case PoolStrategy.FIFO:
                return this.items.shift() || null;

            case PoolStrategy.LRU:
                return this.getLRUItem();

            case PoolStrategy.ADAPTIVE:
                return this.getAdaptiveItem();

            default:
                return this.items.pop() || null;
        }
    }

    /**
     * Add item to pool based on strategy
     */
    private addItemToPool(poolItem: PoolItem<T>): void {
        switch (this.config.strategy) {
            case PoolStrategy.LIFO:
                this.items.push(poolItem);
                break;

            case PoolStrategy.FIFO:
                this.items.unshift(poolItem);
                break;

            case PoolStrategy.LRU:
            case PoolStrategy.ADAPTIVE:
                // For LRU and adaptive, add to end (most recently used)
                this.items.push(poolItem);
                break;

            default:
                this.items.push(poolItem);
        }
    }

    /**
     * Get least recently used item
     */
    private getLRUItem(): PoolItem<T> | null {
        if (this.items.length === 0) return null;

        // Find item with oldest lastUsed timestamp
        let lruIndex = 0;
        let oldestTime = this.items[0].lastUsed;

        for (let i = 1; i < this.items.length; i++) {
            if (this.items[i].lastUsed < oldestTime) {
                oldestTime = this.items[i].lastUsed;
                lruIndex = i;
            }
        }

        return this.items.splice(lruIndex, 1)[0];
    }

    /**
     * Get item using adaptive strategy
     */
    private getAdaptiveItem(): PoolItem<T> | null {
        if (this.items.length === 0) return null;

        const now = Date.now();
        const hitRate = this.getHitRate();

        // If hit rate is high, prefer LIFO (better cache locality)
        // If hit rate is low, prefer LRU (better memory efficiency)
        if (hitRate > 0.8) {
            return this.items.pop() || null;
        } else {
            return this.getLRUItem();
        }
    }

    /**
     * Make room in the pool when it's full
     */
    private makeRoom(): void {
        if (this.items.length === 0) return;

        switch (this.config.strategy) {
            case PoolStrategy.LIFO:
                this.items.shift(); // Remove oldest
                break;

            case PoolStrategy.FIFO:
                this.items.pop(); // Remove newest
                break;

            case PoolStrategy.LRU:
                this.getLRUItem(); // Remove least recently used
                break;

            case PoolStrategy.ADAPTIVE:
                // Remove based on current performance
                const hitRate = this.getHitRate();
                if (hitRate > 0.8) {
                    this.items.shift(); // Remove oldest
                } else {
                    this.getLRUItem(); // Remove LRU
                }
                break;
        }
    }

    /**
     * Remove expired items from the pool
     */
    private removeExpiredItems(): void {
        if (!this.config.maxAge) return;

        const now = Date.now();
        const maxAge = this.config.maxAge;

        this.items = this.items.filter((poolItem) => {
            const age = now - poolItem.createdAt;
            return age <= maxAge;
        });
    }

    /**
     * Clear all items from the pool
     */
    clear(): void {
        this.items = [];
        this.eventManager.emit(MemoryEventType.POOL_DESTROYED, {
            name: this.config.name,
            reason: "cleared",
        });
    }

    /**
     * Resize the pool capacity
     */
    resize(newCapacity: number): void {
        if (newCapacity < 0) {
            throw new Error("Pool capacity cannot be negative");
        }

        const oldCapacity = this.config.capacity;
        this.config.capacity = newCapacity;

        // If new capacity is smaller, remove excess items
        while (this.items.length > newCapacity) {
            this.makeRoom();
        }

        this.eventManager.emit(MemoryEventType.CONFIG_UPDATED, {
            poolName: this.config.name,
            capacityChange: {
                from: oldCapacity,
                to: newCapacity,
            },
        });
    }

    /**
     * Get pool statistics
     */
    getStats(): PoolStats {
        return {
            name: this.config.name,
            size: this.items.length,
            capacity: this.config.capacity,
            hitRate: this.getHitRate(),
            totalAcquisitions: this.stats.totalAcquisitions,
            totalReleases: this.stats.totalReleases,
            strategy: this.config.strategy,
            createdAt: this.stats.createdAt,
            lastUsed: this.stats.lastUsed,
        };
    }

    /**
     * Calculate hit rate
     */
    private getHitRate(): number {
        const total = this.stats.hits + this.stats.misses;
        return total > 0 ? this.stats.hits / total : 0;
    }

    /**
     * Get current pool size
     */
    get size(): number {
        return this.items.length;
    }

    /**
     * Get pool capacity
     */
    get capacity(): number {
        return this.config.capacity;
    }

    /**
     * Get pool strategy
     */
    get strategy(): PoolStrategy {
        return this.config.strategy;
    }

    /**
     * Get pool name
     */
    get name(): string {
        return this.config.name;
    }

    /**
     * Get detailed pool information for debugging
     */
    getDebugInfo(): Record<string, any> {
        return {
            config: {
                name: this.config.name,
                capacity: this.config.capacity,
                strategy: this.config.strategy,
                maxAge: this.config.maxAge,
            },
            stats: this.getStats(),
            items: this.items.map((item) => ({
                createdAt: item.createdAt,
                lastUsed: item.lastUsed,
                usageCount: item.usageCount,
                age: Date.now() - item.createdAt,
            })),
            performance: {
                hitRate: this.getHitRate(),
                efficiency: this.items.length / this.config.capacity,
                averageAge: this.getAverageItemAge(),
            },
        };
    }

    /**
     * Get average age of items in the pool
     */
    private getAverageItemAge(): number {
        if (this.items.length === 0) return 0;

        const now = Date.now();
        const totalAge = this.items.reduce(
            (sum, item) => sum + (now - item.createdAt),
            0
        );
        return totalAge / this.items.length;
    }

    /**
     * Update pool configuration
     */
    updateConfig(updates: Partial<PoolConfig<T>>): void {
        // Update configuration
        this.config = { ...this.config, ...updates };

        // Handle capacity changes
        if (updates.capacity !== undefined) {
            this.resize(updates.capacity);
        }

        this.eventManager.emit(MemoryEventType.CONFIG_UPDATED, {
            poolName: this.config.name,
            updates,
        });
    }

    /**
     * Destroy the pool and clean up resources
     */
    destroy(): void {
        this.clear();
        this.eventManager.emit(MemoryEventType.POOL_DESTROYED, {
            name: this.config.name,
            reason: "destroyed",
            finalStats: this.getStats(),
        });
    }
}


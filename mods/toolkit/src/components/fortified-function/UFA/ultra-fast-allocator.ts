/**
 * XyPrissSecurity - Optimized Memory Allocator
 * Memory allocator with minimal overhead and maximum performance
 */

import { AllocationMetadata, MemoryPool, POOL_CONFIGS } from "../types/types";

export class UltraFastAllocator {
    private readonly pools: MemoryPool[] = [];
    private readonly allocations = new Map<ArrayBuffer, AllocationMetadata>();
    private readonly stats = {
        totalAllocations: 0,
        totalDeallocations: 0,
        poolHits: 0,
        fallbackAllocations: 0,
        bytesAllocated: 0,
    };

    constructor() {
        this.initializePools();
    }

    /**
     * Initialize memory pools with optimized configurations
     */
    private initializePools(): void {
        for (let i = 0; i < POOL_CONFIGS.length; i++) {
            const config = POOL_CONFIGS[i];
            const totalSize = config.blockSize * config.totalBlocks;
            const buffer = new ArrayBuffer(totalSize);

            // Use bitfield for allocation tracking (32x memory savings)
            const bitmapSize = Math.ceil(config.totalBlocks / 32);

            const pool: MemoryPool = {
                buffer,
                view: new Uint8Array(buffer),
                allocated: new Uint32Array(bitmapSize),
                blockSize: config.blockSize,
                totalBlocks: config.totalBlocks,
                freeBlocks: config.totalBlocks,
                nextFree: 0,
                name: config.name,
            };

            this.pools[i] = pool;
        }
    }

    /**
     * High-performance allocation with minimal overhead
     */
    public allocate(size: number): ArrayBuffer | null {
        const poolIndex = this.selectPool(size);
        if (poolIndex === -1) {
            return this.fallbackAllocate(size);
        }

        const pool = this.pools[poolIndex];
        if (pool.freeBlocks === 0) {
            return this.fallbackAllocate(size);
        }

        const blockIndex = this.findFreeBlock(pool);
        if (blockIndex === -1) {
            return this.fallbackAllocate(size);
        }

        // Set allocation bit
        this.setBit(pool.allocated, blockIndex);
        pool.freeBlocks--;

        // Update next free hint for faster subsequent allocations
        this.updateNextFree(pool, blockIndex);

        // Create buffer view
        const offset = blockIndex * pool.blockSize;
        const buffer = pool.buffer.slice(
            offset,
            offset + Math.min(size, pool.blockSize)
        );

        // Store minimal metadata
        this.allocations.set(buffer, {
            poolIndex,
            blockIndex,
            size: buffer.byteLength,
        });

        this.stats.totalAllocations++;
        this.stats.poolHits++;
        this.stats.bytesAllocated += buffer.byteLength;

        return buffer;
    }

    /**
     * Optimized deallocation
     */
    public deallocate(buffer: ArrayBuffer): boolean {
        const metadata = this.allocations.get(buffer);
        if (!metadata) {
            return false;
        }

        const pool = this.pools[metadata.poolIndex];

        // Clear allocation bit
        this.clearBit(pool.allocated, metadata.blockIndex);
        pool.freeBlocks++;

        // Update next free hint if this block is earlier
        if (metadata.blockIndex < pool.nextFree) {
            pool.nextFree = metadata.blockIndex;
        }

        // Clean up
        this.allocations.delete(buffer);
        this.stats.totalDeallocations++;
        this.stats.bytesAllocated -= metadata.size;

        return true;
    }

    /**
     * Batch allocation for better performance
     */
    public batchAllocate(sizes: number[]): ArrayBuffer[] {
        const results: ArrayBuffer[] = [];

        // Pre-sort sizes for optimal pool usage
        const sortedSizes = sizes.slice().sort((a, b) => a - b);

        for (const size of sortedSizes) {
            const buffer = this.allocate(size);
            if (buffer) {
                results.push(buffer);
            }
        }

        return results;
    }

    /**
     * Batch deallocation
     */
    public batchDeallocate(buffers: ArrayBuffer[]): number {
        let count = 0;
        for (const buffer of buffers) {
            if (this.deallocate(buffer)) {
                count++;
            }
        }
        return count;
    }

    /**
     * Select optimal pool for given size (branchless optimization)
     */
    private selectPool(size: number): number {
        for (let i = 0; i < this.pools.length; i++) {
            if (size <= this.pools[i].blockSize) {
                return i;
            }
        }
        return -1; // No suitable pool
    }

    /**
     * Find free block using bitfield scanning
     */
    private findFreeBlock(pool: MemoryPool): number {
        const startWord = Math.floor(pool.nextFree / 32);
        const totalWords = pool.allocated.length;

        // Search from nextFree position
        for (let wordOffset = 0; wordOffset < totalWords; wordOffset++) {
            const wordIndex = (startWord + wordOffset) % totalWords;
            const word = pool.allocated[wordIndex];

            if (word !== 0xffffffff) {
                // Not all bits set
                const bit = this.findFirstZeroBit(word);
                const blockIndex = wordIndex * 32 + bit;

                if (blockIndex < pool.totalBlocks) {
                    return blockIndex;
                }
            }
        }

        return -1;
    }

    /**
     * Find first zero bit in a 32-bit word (using bit manipulation)
     */
    private findFirstZeroBit(word: number): number {
        // Invert bits and find first set bit
        const inverted = ~word >>> 0; // Unsigned right shift to handle sign
        return inverted === 0 ? -1 : Math.log2(inverted & -inverted);
    }

    /**
     * Update next free hint for faster allocation
     */
    private updateNextFree(pool: MemoryPool, allocatedBlock: number): void {
        if (allocatedBlock === pool.nextFree) {
            // Find next free block after this one
            for (let i = allocatedBlock + 1; i < pool.totalBlocks; i++) {
                if (!this.getBit(pool.allocated, i)) {
                    pool.nextFree = i;
                    return;
                }
            }
            // Wrap around
            pool.nextFree = 0;
        }
    }

    /**
     * Set bit in bitfield
     */
    private setBit(bitfield: Uint32Array, bitIndex: number): void {
        const wordIndex = Math.floor(bitIndex / 32);
        const bitPosition = bitIndex % 32;
        bitfield[wordIndex] |= 1 << bitPosition;
    }

    /**
     * Clear bit in bitfield
     */
    private clearBit(bitfield: Uint32Array, bitIndex: number): void {
        const wordIndex = Math.floor(bitIndex / 32);
        const bitPosition = bitIndex % 32;
        bitfield[wordIndex] &= ~(1 << bitPosition);
    }

    /**
     * Get bit from bitfield
     */
    private getBit(bitfield: Uint32Array, bitIndex: number): boolean {
        const wordIndex = Math.floor(bitIndex / 32);
        const bitPosition = bitIndex % 32;
        return (bitfield[wordIndex] & (1 << bitPosition)) !== 0;
    }

    /**
     * Fallback allocation for sizes that don't fit in pools
     */
    private fallbackAllocate(size: number): ArrayBuffer {
        this.stats.fallbackAllocations++;
        this.stats.bytesAllocated += size;
        return new ArrayBuffer(size);
    }

    /**
     * Defragmentation - compact allocated blocks
     */
    public defragment(): void {
        for (const pool of this.pools) {
            this.defragmentPool(pool);
        }
    }

    /**
     * Defragment a specific pool
     */
    private defragmentPool(pool: MemoryPool): void {
        const compactedBlocks: number[] = [];

        // Collect all allocated blocks
        for (let i = 0; i < pool.totalBlocks; i++) {
            if (this.getBit(pool.allocated, i)) {
                compactedBlocks.push(i);
            }
        }

        if (compactedBlocks.length === 0) return;

        // Create temporary buffer for compaction
        const tempView = new Uint8Array(pool.buffer.byteLength);
        let writeOffset = 0;

        // Compact blocks to beginning
        for (const blockIndex of compactedBlocks) {
            const srcOffset = blockIndex * pool.blockSize;
            tempView.set(
                pool.view.subarray(srcOffset, srcOffset + pool.blockSize),
                writeOffset
            );
            writeOffset += pool.blockSize;
        }

        // Copy back to original buffer
        pool.view.set(tempView);

        // Update allocation bitmap
        pool.allocated.fill(0);
        for (let i = 0; i < compactedBlocks.length; i++) {
            this.setBit(pool.allocated, i);
        }

        pool.nextFree = compactedBlocks.length;
    }

    /**
     * Get performance statistics
     */
    public getStats(): any {
        const poolStats = this.pools.map((pool) => ({
            name: pool.name,
            blockSize: pool.blockSize,
            totalBlocks: pool.totalBlocks,
            freeBlocks: pool.freeBlocks,
            utilization:
                (
                    ((pool.totalBlocks - pool.freeBlocks) / pool.totalBlocks) *
                    100
                ).toFixed(1) + "%",
            totalMemory: this.formatBytes(pool.totalBlocks * pool.blockSize),
        }));

        const totalPoolMemory = this.pools.reduce(
            (sum, pool) => sum + pool.totalBlocks * pool.blockSize,
            0
        );

        return {
            ...this.stats,
            pools: poolStats,
            activeAllocations: this.allocations.size,
            totalPoolMemory: this.formatBytes(totalPoolMemory),
            currentMemoryUsage: this.formatBytes(this.stats.bytesAllocated),
            hitRate:
                this.stats.totalAllocations > 0
                    ? (
                          (this.stats.poolHits / this.stats.totalAllocations) *
                          100
                      ).toFixed(1) + "%"
                    : "0%",
        };
    }

    /**
     * Format bytes for display
     */
    private formatBytes(bytes: number): string {
        const units = ["B", "KB", "MB", "GB"];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(1)} ${units[unitIndex]}`;
    }

    /**
     * Check if allocator owns a buffer
     */
    public owns(buffer: ArrayBuffer): boolean {
        return this.allocations.has(buffer);
    }

    /**
     * Get allocation info for debugging
     */
    public getAllocationInfo(buffer: ArrayBuffer): AllocationMetadata | null {
        return this.allocations.get(buffer) || null;
    }

    /**
     * Reset all pools
     */
    public reset(): void {
        for (const pool of this.pools) {
            pool.allocated.fill(0);
            pool.freeBlocks = pool.totalBlocks;
            pool.nextFree = 0;
        }

        this.allocations.clear();
        this.stats.bytesAllocated = 0;
    }

    /**
     * Destroy allocator and free all memory
     */
    public destroy(): void {
        this.pools.length = 0;
        this.allocations.clear();
        Object.assign(this.stats, {
            totalAllocations: 0,
            totalDeallocations: 0,
            poolHits: 0,
            fallbackAllocations: 0,
            bytesAllocated: 0,
        });
    }
}

// Export singleton instance for global use
export const globalAllocator = new UltraFastAllocator();


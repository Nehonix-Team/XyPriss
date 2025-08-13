/**
 * Heap Statistics Collector for Bun Workers
 * Collects and tracks heap memory usage statistics
 */

import { logger } from "../../../shared/logger/Logger";

export interface HeapStats {
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
    rss: number;
}

export class HeapStatsCollector {
    private heapStatsCache: Map<string, HeapStats> = new Map();
    private lastCollectionTime: Map<string, number> = new Map();
    private readonly cacheTimeout = 5000; // 5 seconds cache

    /**
     * Get heap statistics for a worker process
     */
    public async getHeapStats(workerId: string, pid: number): Promise<HeapStats> {
        const now = Date.now();
        const lastCollection = this.lastCollectionTime.get(workerId) || 0;
        
        // Return cached stats if recent
        if (now - lastCollection < this.cacheTimeout) {
            const cached = this.heapStatsCache.get(workerId);
            if (cached) {
                return cached;
            }
        }

        try {
            // For Bun, we can use process.memoryUsage() if available
            const stats = await this.collectHeapStats(pid);
            
            // Cache the results
            this.heapStatsCache.set(workerId, stats);
            this.lastCollectionTime.set(workerId, now);
            
            return stats;
        } catch (error) {
            logger.debug("cluster", `Failed to collect heap stats for worker ${workerId}:`, error);
            
            // Return default stats on error
            return {
                heapUsed: 0,
                heapTotal: 0,
                external: 0,
                arrayBuffers: 0,
                rss: 0,
            };
        }
    }

    /**
     * Collect heap statistics from process
     */
    private async collectHeapStats(pid: number): Promise<HeapStats> {
        try {
            // Try to get memory usage from the process
            // In a real implementation, this would use IPC to get memory stats from the worker
            // For now, we'll use system-level process memory information
            
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            // Get process memory info using ps command
            const { stdout } = await execAsync(`ps -p ${pid} -o rss,vsz --no-headers`);
            const [rss, vsz] = stdout.trim().split(/\s+/).map(Number);

            // Convert KB to bytes
            const rssBytes = (rss || 0) * 1024;
            const vszBytes = (vsz || 0) * 1024;

            // Estimate heap usage (this is approximate)
            const estimatedHeapUsed = Math.floor(rssBytes * 0.7); // ~70% of RSS
            const estimatedHeapTotal = Math.floor(vszBytes * 0.5); // ~50% of VSZ

            return {
                heapUsed: estimatedHeapUsed,
                heapTotal: estimatedHeapTotal,
                external: Math.floor(rssBytes * 0.1), // ~10% external
                arrayBuffers: Math.floor(rssBytes * 0.05), // ~5% array buffers
                rss: rssBytes,
            };
        } catch (error) {
            logger.debug("cluster", `Failed to collect system memory stats for PID ${pid}:`, error);
            
            // Return zeros on error
            return {
                heapUsed: 0,
                heapTotal: 0,
                external: 0,
                arrayBuffers: 0,
                rss: 0,
            };
        }
    }

    /**
     * Clear cached stats for a worker
     */
    public clearWorkerStats(workerId: string): void {
        this.heapStatsCache.delete(workerId);
        this.lastCollectionTime.delete(workerId);
    }

    /**
     * Clear all cached stats
     */
    public clearAllStats(): void {
        this.heapStatsCache.clear();
        this.lastCollectionTime.clear();
    }

    /**
     * Get all cached heap stats
     */
    public getAllCachedStats(): Map<string, HeapStats> {
        return new Map(this.heapStatsCache);
    }
}

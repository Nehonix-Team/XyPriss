/**
 * Request Throughput Calculator for Bun Workers
 * Calculates requests per second and tracks request patterns
 */

import { logger } from "../../../shared/logger/Logger";

export interface ThroughputStats {
    requestsPerSecond: number;
    activeRequests: number;
    queuedRequests: number;
    peakThroughput: number;
    averageThroughput: number;
}

interface RequestHistory {
    timestamp: number;
    requestCount: number;
}

export class ThroughputCalculator {
    private throughputCache: Map<string, ThroughputStats> = new Map();
    private requestHistory: Map<string, RequestHistory[]> = new Map();
    private activeRequestCounts: Map<string, number> = new Map();
    private queuedRequestCounts: Map<string, number> = new Map();
    private lastCollectionTime: Map<string, number> = new Map();
    private peakThroughput: Map<string, number> = new Map();
    
    private readonly cacheTimeout = 2000; // 2 seconds cache
    private readonly historyWindow = 300000; // 5 minutes history window
    private readonly calculationWindow = 60000; // 1 minute calculation window

    /**
     * Calculate throughput statistics for a worker
     */
    public calculateThroughput(workerId: string, totalRequests: number): ThroughputStats {
        const now = Date.now();
        const lastCollection = this.lastCollectionTime.get(workerId) || 0;
        
        // Return cached stats if recent
        if (now - lastCollection < this.cacheTimeout) {
            const cached = this.throughputCache.get(workerId);
            if (cached) {
                return cached;
            }
        }

        // Update request history
        this.updateRequestHistory(workerId, totalRequests);
        
        // Calculate current throughput
        const requestsPerSecond = this.calculateRequestsPerSecond(workerId);
        const averageThroughput = this.calculateAverageThroughput(workerId);
        
        // Update peak throughput
        const currentPeak = this.peakThroughput.get(workerId) || 0;
        if (requestsPerSecond > currentPeak) {
            this.peakThroughput.set(workerId, requestsPerSecond);
        }

        const stats: ThroughputStats = {
            requestsPerSecond,
            activeRequests: this.activeRequestCounts.get(workerId) || 0,
            queuedRequests: this.queuedRequestCounts.get(workerId) || 0,
            peakThroughput: this.peakThroughput.get(workerId) || 0,
            averageThroughput,
        };

        // Cache the results
        this.throughputCache.set(workerId, stats);
        this.lastCollectionTime.set(workerId, now);
        
        return stats;
    }

    /**
     * Update request history for throughput calculation
     */
    private updateRequestHistory(workerId: string, totalRequests: number): void {
        const now = Date.now();
        let history = this.requestHistory.get(workerId) || [];
        
        // Add current measurement
        history.push({ timestamp: now, requestCount: totalRequests });
        
        // Remove old measurements outside the window
        history = history.filter(h => now - h.timestamp <= this.historyWindow);
        
        this.requestHistory.set(workerId, history);
    }

    /**
     * Calculate requests per second based on recent history
     */
    private calculateRequestsPerSecond(workerId: string): number {
        const history = this.requestHistory.get(workerId) || [];
        
        if (history.length < 2) {
            return 0;
        }

        // Use last 10 seconds for current rate calculation
        const now = Date.now();
        const recentHistory = history.filter(h => now - h.timestamp <= 10000);
        
        if (recentHistory.length < 2) {
            return 0;
        }

        const oldest = recentHistory[0];
        const newest = recentHistory[recentHistory.length - 1];
        
        const timeDiff = (newest.timestamp - oldest.timestamp) / 1000; // Convert to seconds
        const requestDiff = newest.requestCount - oldest.requestCount;
        
        return timeDiff > 0 ? Math.max(0, requestDiff / timeDiff) : 0;
    }

    /**
     * Calculate average throughput over the calculation window
     */
    private calculateAverageThroughput(workerId: string): number {
        const history = this.requestHistory.get(workerId) || [];
        
        if (history.length < 2) {
            return 0;
        }

        // Use calculation window for average
        const now = Date.now();
        const windowHistory = history.filter(h => now - h.timestamp <= this.calculationWindow);
        
        if (windowHistory.length < 2) {
            return 0;
        }

        const oldest = windowHistory[0];
        const newest = windowHistory[windowHistory.length - 1];
        
        const timeDiff = (newest.timestamp - oldest.timestamp) / 1000; // Convert to seconds
        const requestDiff = newest.requestCount - oldest.requestCount;
        
        return timeDiff > 0 ? Math.max(0, requestDiff / timeDiff) : 0;
    }

    /**
     * Increment active request count
     */
    public incrementActiveRequests(workerId: string): void {
        const current = this.activeRequestCounts.get(workerId) || 0;
        this.activeRequestCounts.set(workerId, current + 1);
        
        // Clear cache to force recalculation
        this.throughputCache.delete(workerId);
    }

    /**
     * Decrement active request count
     */
    public decrementActiveRequests(workerId: string): void {
        const current = this.activeRequestCounts.get(workerId) || 0;
        this.activeRequestCounts.set(workerId, Math.max(0, current - 1));
        
        // Clear cache to force recalculation
        this.throughputCache.delete(workerId);
    }

    /**
     * Set queued request count
     */
    public setQueuedRequests(workerId: string, count: number): void {
        this.queuedRequestCounts.set(workerId, Math.max(0, count));
        
        // Clear cache to force recalculation
        this.throughputCache.delete(workerId);
    }

    /**
     * Clear cached stats for a worker
     */
    public clearWorkerStats(workerId: string): void {
        this.throughputCache.delete(workerId);
        this.requestHistory.delete(workerId);
        this.activeRequestCounts.delete(workerId);
        this.queuedRequestCounts.delete(workerId);
        this.lastCollectionTime.delete(workerId);
        this.peakThroughput.delete(workerId);
    }

    /**
     * Clear all cached stats
     */
    public clearAllStats(): void {
        this.throughputCache.clear();
        this.requestHistory.clear();
        this.activeRequestCounts.clear();
        this.queuedRequestCounts.clear();
        this.lastCollectionTime.clear();
        this.peakThroughput.clear();
    }

    /**
     * Get all cached throughput stats
     */
    public getAllCachedStats(): Map<string, ThroughputStats> {
        return new Map(this.throughputCache);
    }

    /**
     * Get throughput trends for a worker
     */
    public getThroughputTrends(workerId: string, minutes: number = 5): Array<{timestamp: number, rps: number}> {
        const history = this.requestHistory.get(workerId) || [];
        const now = Date.now();
        const windowMs = minutes * 60 * 1000;
        
        const recentHistory = history.filter(h => now - h.timestamp <= windowMs);
        
        // Calculate RPS for each minute
        const trends: Array<{timestamp: number, rps: number}> = [];
        
        for (let i = 1; i < recentHistory.length; i++) {
            const current = recentHistory[i];
            const previous = recentHistory[i - 1];
            
            const timeDiff = (current.timestamp - previous.timestamp) / 1000;
            const requestDiff = current.requestCount - previous.requestCount;
            
            const rps = timeDiff > 0 ? requestDiff / timeDiff : 0;
            
            trends.push({
                timestamp: current.timestamp,
                rps: Math.max(0, rps)
            });
        }
        
        return trends;
    }
}

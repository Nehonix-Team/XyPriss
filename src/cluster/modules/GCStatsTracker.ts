/**
 * Garbage Collection Statistics Tracker for Bun Workers
 * Tracks GC events, timing, and performance impact
 */

import { logger } from "../../../shared/logger/Logger";

export interface GCStats {
    collections: number;
    timeSpent: number; // Total time in milliseconds
    averageTime: number; // Average time per collection
    lastCollection?: Date;
    gcPressure: number; // 0-100 scale indicating GC pressure
}

interface GCEvent {
    timestamp: number;
    duration: number;
    type?: string;
}

export class GCStatsTracker {
    private gcStatsCache: Map<string, GCStats> = new Map();
    private gcHistory: Map<string, GCEvent[]> = new Map();
    private lastCollectionTime: Map<string, number> = new Map();
    private readonly cacheTimeout = 5000; // 5 seconds cache
    private readonly historyWindow = 600000; // 10 minutes history window

    /**
     * Get GC statistics for a worker process
     */
    public async getGCStats(workerId: string, pid: number): Promise<GCStats> {
        const now = Date.now();
        const lastCollection = this.lastCollectionTime.get(workerId) || 0;
        
        // Return cached stats if recent
        if (now - lastCollection < this.cacheTimeout) {
            const cached = this.gcStatsCache.get(workerId);
            if (cached) {
                return cached;
            }
        }

        try {
            const stats = await this.collectGCStats(workerId, pid);
            
            // Cache the results
            this.gcStatsCache.set(workerId, stats);
            this.lastCollectionTime.set(workerId, now);
            
            return stats;
        } catch (error) {
            logger.debug("cluster", `Failed to collect GC stats for worker ${workerId}:`, error);
            
            // Return default stats on error
            return {
                collections: 0,
                timeSpent: 0,
                averageTime: 0,
                gcPressure: 0,
            };
        }
    }

    /**
     * Collect GC statistics from process
     */
    private async collectGCStats(workerId: string, pid: number): Promise<GCStats> {
        try {
            // In a real implementation, this would use performance hooks or IPC
            // to get actual GC stats from the worker process
            // For now, we'll simulate based on typical patterns
            
            const history = this.gcHistory.get(workerId) || [];
            const now = Date.now();
            
            // Clean old history
            const recentHistory = history.filter(h => now - h.timestamp <= this.historyWindow);
            this.gcHistory.set(workerId, recentHistory);
            
            // Calculate stats from history
            const collections = recentHistory.length;
            const totalTime = recentHistory.reduce((sum, event) => sum + event.duration, 0);
            const averageTime = collections > 0 ? totalTime / collections : 0;
            
            // Calculate GC pressure based on frequency and duration
            const recentEvents = recentHistory.filter(h => now - h.timestamp <= 60000); // Last minute
            const gcPressure = this.calculateGCPressure(recentEvents);
            
            const lastCollection = recentHistory.length > 0 
                ? new Date(recentHistory[recentHistory.length - 1].timestamp)
                : undefined;

            return {
                collections,
                timeSpent: totalTime,
                averageTime,
                lastCollection,
                gcPressure,
            };
        } catch (error) {
            logger.debug("cluster", `Failed to collect GC stats for PID ${pid}:`, error);
            
            return {
                collections: 0,
                timeSpent: 0,
                averageTime: 0,
                gcPressure: 0,
            };
        }
    }

    /**
     * Calculate GC pressure score (0-100)
     */
    private calculateGCPressure(recentEvents: GCEvent[]): number {
        if (recentEvents.length === 0) {
            return 0;
        }

        // Factors that contribute to GC pressure:
        // 1. Frequency of GC events
        // 2. Duration of GC events
        // 3. Trend over time

        const frequency = recentEvents.length; // Events per minute
        const averageDuration = recentEvents.reduce((sum, e) => sum + e.duration, 0) / recentEvents.length;
        const totalTime = recentEvents.reduce((sum, e) => sum + e.duration, 0);

        // Normalize scores (these thresholds are configurable)
        const frequencyScore = Math.min(100, (frequency / 10) * 100); // 10+ events = 100%
        const durationScore = Math.min(100, (averageDuration / 100) * 100); // 100ms+ avg = 100%
        const timeScore = Math.min(100, (totalTime / 1000) * 100); // 1s+ total = 100%

        // Weighted average
        const pressure = (frequencyScore * 0.4) + (durationScore * 0.3) + (timeScore * 0.3);
        
        return Math.round(Math.min(100, Math.max(0, pressure)));
    }

    /**
     * Record a GC event (to be called by performance monitoring)
     */
    public recordGCEvent(workerId: string, duration: number, type?: string): void {
        const now = Date.now();
        let history = this.gcHistory.get(workerId) || [];
        
        // Add new event
        history.push({
            timestamp: now,
            duration,
            type,
        });
        
        // Clean old events
        history = history.filter(h => now - h.timestamp <= this.historyWindow);
        
        this.gcHistory.set(workerId, history);
        
        // Clear cache to force recalculation
        this.gcStatsCache.delete(workerId);
        
        logger.debug("cluster", `GC event recorded for worker ${workerId}: ${duration}ms`);
    }

    /**
     * Simulate GC events for testing (remove in production)
     */
    public simulateGCEvent(workerId: string): void {
        // Simulate realistic GC durations (1-50ms typically)
        const duration = Math.random() * 49 + 1;
        const types = ['minor', 'major', 'incremental'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        this.recordGCEvent(workerId, duration, type);
    }

    /**
     * Clear cached stats for a worker
     */
    public clearWorkerStats(workerId: string): void {
        this.gcStatsCache.delete(workerId);
        this.gcHistory.delete(workerId);
        this.lastCollectionTime.delete(workerId);
    }

    /**
     * Clear all cached stats
     */
    public clearAllStats(): void {
        this.gcStatsCache.clear();
        this.gcHistory.clear();
        this.lastCollectionTime.clear();
    }

    /**
     * Get all cached GC stats
     */
    public getAllCachedStats(): Map<string, GCStats> {
        return new Map(this.gcStatsCache);
    }

    /**
     * Get GC event history for a worker
     */
    public getGCHistory(workerId: string, minutes: number = 10): GCEvent[] {
        const history = this.gcHistory.get(workerId) || [];
        const now = Date.now();
        const windowMs = minutes * 60 * 1000;
        
        return history.filter(h => now - h.timestamp <= windowMs);
    }

    /**
     * Get GC trends and patterns
     */
    public getGCTrends(workerId: string): {
        eventsPerMinute: number;
        averageDuration: number;
        maxDuration: number;
        totalTimePercentage: number;
    } {
        const history = this.getGCHistory(workerId, 5); // Last 5 minutes
        
        if (history.length === 0) {
            return {
                eventsPerMinute: 0,
                averageDuration: 0,
                maxDuration: 0,
                totalTimePercentage: 0,
            };
        }

        const eventsPerMinute = history.length / 5; // 5 minute window
        const durations = history.map(h => h.duration);
        const averageDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
        const maxDuration = Math.max(...durations);
        const totalGCTime = durations.reduce((sum, d) => sum + d, 0);
        const totalTimePercentage = (totalGCTime / (5 * 60 * 1000)) * 100; // % of 5 minutes

        return {
            eventsPerMinute: Math.round(eventsPerMinute * 100) / 100,
            averageDuration: Math.round(averageDuration * 100) / 100,
            maxDuration: Math.round(maxDuration * 100) / 100,
            totalTimePercentage: Math.round(totalTimePercentage * 100) / 100,
        };
    }
}

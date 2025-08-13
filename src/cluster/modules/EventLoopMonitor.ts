/**
 * Event Loop Monitor for Bun Workers
 * Monitors event loop delay and utilization
 */

import { logger } from "../../../shared/logger/Logger";

export interface EventLoopStats {
    delay: number; // Current delay in milliseconds
    utilization: number; // Utilization percentage (0-100)
    averageDelay: number; // Average delay over time
    maxDelay: number; // Maximum delay recorded
    health: 'healthy' | 'warning' | 'critical';
}

interface DelayMeasurement {
    timestamp: number;
    delay: number;
}

export class EventLoopMonitor {
    private eventLoopStatsCache: Map<string, EventLoopStats> = new Map();
    private delayHistory: Map<string, DelayMeasurement[]> = new Map();
    private lastCollectionTime: Map<string, number> = new Map();
    private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
    
    private readonly cacheTimeout = 1000; // 1 second cache
    private readonly historyWindow = 300000; // 5 minutes history window
    private readonly monitoringInterval = 100; // Monitor every 100ms

    // Health thresholds (configurable)
    private readonly healthyThreshold = 10; // < 10ms is healthy
    private readonly warningThreshold = 50; // 10-50ms is warning
    // > 50ms is critical

    /**
     * Get event loop statistics for a worker process
     */
    public async getEventLoopStats(workerId: string): Promise<EventLoopStats> {
        const now = Date.now();
        const lastCollection = this.lastCollectionTime.get(workerId) || 0;
        
        // Return cached stats if recent
        if (now - lastCollection < this.cacheTimeout) {
            const cached = this.eventLoopStatsCache.get(workerId);
            if (cached) {
                return cached;
            }
        }

        try {
            const stats = await this.collectEventLoopStats(workerId);
            
            // Cache the results
            this.eventLoopStatsCache.set(workerId, stats);
            this.lastCollectionTime.set(workerId, now);
            
            return stats;
        } catch (error) {
            logger.debug("cluster", `Failed to collect event loop stats for worker ${workerId}:`, error);
            
            // Return default stats on error
            return {
                delay: 0,
                utilization: 0,
                averageDelay: 0,
                maxDelay: 0,
                health: 'healthy',
            };
        }
    }

    /**
     * Collect event loop statistics
     */
    private async collectEventLoopStats(workerId: string): Promise<EventLoopStats> {
        const history = this.delayHistory.get(workerId) || [];
        const now = Date.now();
        
        // Clean old history
        const recentHistory = history.filter(h => now - h.timestamp <= this.historyWindow);
        this.delayHistory.set(workerId, recentHistory);
        
        if (recentHistory.length === 0) {
            return {
                delay: 0,
                utilization: 0,
                averageDelay: 0,
                maxDelay: 0,
                health: 'healthy',
            };
        }

        // Calculate current delay (most recent measurement)
        const currentDelay = recentHistory[recentHistory.length - 1]?.delay || 0;
        
        // Calculate average delay
        const delays = recentHistory.map(h => h.delay);
        const averageDelay = delays.reduce((sum, d) => sum + d, 0) / delays.length;
        
        // Calculate max delay
        const maxDelay = Math.max(...delays);
        
        // Calculate utilization (inverse of delay health)
        const utilization = this.calculateUtilization(averageDelay);
        
        // Determine health status
        const health = this.determineHealth(currentDelay, averageDelay);

        return {
            delay: Math.round(currentDelay * 100) / 100,
            utilization: Math.round(utilization * 100) / 100,
            averageDelay: Math.round(averageDelay * 100) / 100,
            maxDelay: Math.round(maxDelay * 100) / 100,
            health,
        };
    }

    /**
     * Calculate event loop utilization percentage
     */
    private calculateUtilization(averageDelay: number): number {
        // Utilization is inversely related to delay
        // 0ms delay = 100% utilization
        // Higher delays = lower utilization
        
        if (averageDelay <= 1) return 100;
        if (averageDelay >= 100) return 0;
        
        // Logarithmic scale for better representation
        const utilization = 100 - (Math.log10(averageDelay) * 50);
        return Math.max(0, Math.min(100, utilization));
    }

    /**
     * Determine health status based on delay metrics
     */
    private determineHealth(currentDelay: number, averageDelay: number): 'healthy' | 'warning' | 'critical' {
        const maxDelay = Math.max(currentDelay, averageDelay);
        
        if (maxDelay <= this.healthyThreshold) {
            return 'healthy';
        } else if (maxDelay <= this.warningThreshold) {
            return 'warning';
        } else {
            return 'critical';
        }
    }

    /**
     * Start monitoring event loop for a worker
     */
    public startMonitoring(workerId: string): void {
        // Stop existing monitoring if any
        this.stopMonitoring(workerId);
        
        // In a real implementation, this would use performance hooks
        // or IPC to get actual event loop delay from the worker
        // For now, we'll simulate realistic delays
        
        const interval = setInterval(() => {
            this.measureEventLoopDelay(workerId);
        }, this.monitoringInterval);
        
        this.monitoringIntervals.set(workerId, interval);
        
        logger.debug("cluster", `Started event loop monitoring for worker ${workerId}`);
    }

    /**
     * Stop monitoring event loop for a worker
     */
    public stopMonitoring(workerId: string): void {
        const interval = this.monitoringIntervals.get(workerId);
        if (interval) {
            clearInterval(interval);
            this.monitoringIntervals.delete(workerId);
            logger.debug("cluster", `Stopped event loop monitoring for worker ${workerId}`);
        }
    }

    /**
     * Measure event loop delay (simulated for now)
     */
    private measureEventLoopDelay(workerId: string): void {
        // In a real implementation, this would use:
        // const { performance } = require('perf_hooks');
        // const start = performance.now();
        // setImmediate(() => {
        //     const delay = performance.now() - start;
        //     this.recordDelay(workerId, delay);
        // });
        
        // For now, simulate realistic delays based on load patterns
        const baseDelay = Math.random() * 5; // 0-5ms base delay
        const loadSpike = Math.random() < 0.1 ? Math.random() * 45 : 0; // 10% chance of 0-45ms spike
        const delay = baseDelay + loadSpike;
        
        this.recordDelay(workerId, delay);
    }

    /**
     * Record a delay measurement
     */
    public recordDelay(workerId: string, delay: number): void {
        const now = Date.now();
        let history = this.delayHistory.get(workerId) || [];
        
        // Add new measurement
        history.push({
            timestamp: now,
            delay,
        });
        
        // Clean old measurements
        history = history.filter(h => now - h.timestamp <= this.historyWindow);
        
        this.delayHistory.set(workerId, history);
        
        // Clear cache to force recalculation
        this.eventLoopStatsCache.delete(workerId);
        
        // Log critical delays
        if (delay > this.warningThreshold) {
            logger.warn("cluster", `High event loop delay detected for worker ${workerId}: ${delay.toFixed(2)}ms`);
        }
    }

    /**
     * Clear cached stats for a worker
     */
    public clearWorkerStats(workerId: string): void {
        this.stopMonitoring(workerId);
        this.eventLoopStatsCache.delete(workerId);
        this.delayHistory.delete(workerId);
        this.lastCollectionTime.delete(workerId);
    }

    /**
     * Clear all cached stats
     */
    public clearAllStats(): void {
        // Stop all monitoring
        for (const workerId of this.monitoringIntervals.keys()) {
            this.stopMonitoring(workerId);
        }
        
        this.eventLoopStatsCache.clear();
        this.delayHistory.clear();
        this.lastCollectionTime.clear();
    }

    /**
     * Get all cached event loop stats
     */
    public getAllCachedStats(): Map<string, EventLoopStats> {
        return new Map(this.eventLoopStatsCache);
    }

    /**
     * Get delay trends for a worker
     */
    public getDelayTrends(workerId: string, minutes: number = 5): Array<{timestamp: number, delay: number}> {
        const history = this.delayHistory.get(workerId) || [];
        const now = Date.now();
        const windowMs = minutes * 60 * 1000;
        
        return history
            .filter(h => now - h.timestamp <= windowMs)
            .map(h => ({
                timestamp: h.timestamp,
                delay: Math.round(h.delay * 100) / 100
            }));
    }

    /**
     * Get performance summary for a worker
     */
    public getPerformanceSummary(workerId: string): {
        status: string;
        recommendation: string;
        metrics: {
            currentDelay: number;
            averageDelay: number;
            maxDelay: number;
            utilization: number;
        };
    } {
        const stats = this.eventLoopStatsCache.get(workerId);
        
        if (!stats) {
            return {
                status: 'unknown',
                recommendation: 'Start monitoring to get performance data',
                metrics: {
                    currentDelay: 0,
                    averageDelay: 0,
                    maxDelay: 0,
                    utilization: 0,
                },
            };
        }

        let recommendation = '';
        switch (stats.health) {
            case 'healthy':
                recommendation = 'Event loop performance is optimal';
                break;
            case 'warning':
                recommendation = 'Consider reducing synchronous operations or increasing worker count';
                break;
            case 'critical':
                recommendation = 'Immediate attention required - high event loop delay detected';
                break;
        }

        return {
            status: stats.health,
            recommendation,
            metrics: {
                currentDelay: stats.delay,
                averageDelay: stats.averageDelay,
                maxDelay: stats.maxDelay,
                utilization: stats.utilization,
            },
        };
    }
}

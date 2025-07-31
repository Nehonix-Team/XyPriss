
export interface PerformanceMetrics {
    requestId: string;
    timestamp: number;
    route: string;
    method: string;
    
    // Timing metrics (in milliseconds)
    totalTime: number;
    middlewareTime: number;
    pluginTime: number;
    cacheTime: number;
    handlerTime: number;
    
    // Cache metrics
    cacheHit: boolean;
    cacheLayer: 'L1' | 'L2' | 'L3' | 'miss';
    
    // Memory metrics
    memoryUsed: number;
    gcTriggered: boolean;
    
    // Classification
    requestType: 'ultra-fast' | 'fast' | 'standard';
    optimizationPath: string;
    
    // Performance indicators
    targetMet: boolean;
    optimizationGain: number;
}

export interface PerformanceStats {
    totalRequests: number;
    
    // Response time statistics
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    avgResponseTime: number;
    
    // Target achievement
    ultraFastTargetRate: number; // % of requests under 1ms
    fastTargetRate: number;      // % of requests under 5ms
    
    // Cache performance
    overallCacheHitRate: number;
    l1CacheHitRate: number;
    l2CacheHitRate: number;
    l3CacheHitRate: number;
    
    // Memory performance
    avgMemoryUsage: number;
    gcFrequency: number;
    
    // Optimization effectiveness
    optimizationSuccessRate: number;
    avgOptimizationGain: number;
}

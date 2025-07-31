export interface RouteStats {
    path: string;
    method: string;
    hitCount: number;
    totalResponseTime: number;
    averageResponseTime: number;
    lastAccessed: Date;
    errorCount: number;
    cacheHits: number;
    cacheMisses: number;
    popularity: number; // Calculated score
}

export interface OptimizationRule {
    pattern: string;
    minHits: number;
    maxResponseTime: number;
    cacheStrategy: "aggressive" | "moderate" | "conservative";
    preloadEnabled?: boolean;
}

export interface RouteOptimizationConfig {
    enabled?: boolean;
    analysisInterval?: number; // How often to analyze routes (ms)
    optimizationThreshold?: number; // Min hits before optimization
    popularityWindow?: number; // Time window for popularity calculation (ms)
    maxTrackedRoutes?: number; // Maximum routes to track
    autoOptimization?: boolean; // Enable automatic optimization
    customRules?: OptimizationRule[];
    onOptimization?: (route: string, optimization: string) => void;
    onAnalysis?: (stats: RouteStats[]) => void;
}

export interface PluginManagerConfig {
    routeOptimization?: RouteOptimizationConfig;
    serverMaintenance?: MaintenanceConfig;
    customPlugins?: Array<{
        name: string;
        plugin: any;
        config?: any;
    }>;
}

export interface MaintenanceIssue {
    type: "error" | "warning" | "info";
    category: "memory" | "performance" | "logs" | "errors" | "resources";
    message: string;
    severity: number; // 1-10
    timestamp: Date;
    details: any;
    resolved: boolean;
}

export interface HealthMetrics {
    memoryUsage: {
        used: number;
        total: number;
        percentage: number;
        trend: "increasing" | "stable" | "decreasing";
    };
    cpuUsage: number;
    errorRate: number;
    responseTime: {
        average: number;
        p95: number;
        trend: "improving" | "stable" | "degrading";
    };
    activeConnections: number;
    uptime: number;
}

export interface MaintenanceConfig {
    enabled?: boolean;
    checkInterval?: number; // How often to check (ms)
    errorThreshold?: number; // Error rate threshold (%)
    memoryThreshold?: number; // Memory usage threshold (%)
    responseTimeThreshold?: number; // Response time threshold (ms)
    logRetentionDays?: number; // How long to keep logs
    maxLogFileSize?: number; // Max log file size in bytes
    autoCleanup?: boolean; // Enable automatic cleanup
    autoRestart?: boolean; // Enable automatic restart on critical issues
    onIssueDetected?: (issue: MaintenanceIssue) => void;
    onMaintenanceComplete?: (actions: string[]) => void;
}

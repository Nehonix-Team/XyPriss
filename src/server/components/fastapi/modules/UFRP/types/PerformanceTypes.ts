/**
 * XyPrissJS - Performance Types
 */

export interface PerformanceConfig {
    enabled: boolean;
    metrics: string[];
    interval: number;
    alerts: any[];
}

export interface PerformanceStats {
    requests: {
        total: number;
        avgResponseTime: number;
        totalResponseTime: number;
    };
    system: any;
    alerts: any[];
}


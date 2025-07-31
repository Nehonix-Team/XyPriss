/**
 * XyPrissJS - Request Analysis Types
 */

export interface AnalyzerConfig {
    enabled: boolean;
    patternRetentionTime: number;
    analysisInterval: number;
    hotPatternThreshold: number;
}

export interface RequestPattern {
    count: number;
    lastSeen: number;
    avgResponseTime: number;
    priority: number;
    method: string;
    path: string;
    frequency: number;
    trend: "increasing" | "decreasing" | "stable";
}

export interface PatternStats {
    totalPatterns: number;
    activePatterns: number;
    hotPatterns: number;
    trends: Record<string, number>;
    avgResponseTime: number;
}


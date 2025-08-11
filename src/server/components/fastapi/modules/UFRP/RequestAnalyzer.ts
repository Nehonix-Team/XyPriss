/**
 * XyPrissJS - Request Analyzer Module
 * Analyzes request patterns for optimization and prediction
 */

import {
    AnalyzerConfig,
    RequestPattern,
    PatternStats,
} from "./types/RequestTypes"; 

export class RequestAnalyzer {
    private config: AnalyzerConfig;
    private patterns: Map<string, RequestPattern>;
    private stats: PatternStats;

    constructor(config: Partial<AnalyzerConfig> = {}) {
        this.config = {
            enabled: true,
            patternRetentionTime: 3600000, // 1 hour
            analysisInterval: 300000, // 5 minutes
            hotPatternThreshold: 100, // requests per hour
            ...config,
        };

        this.patterns = new Map();
        this.stats = {
            totalPatterns: 0,
            activePatterns: 0,
            hotPatterns: 0,
            trends: {},
            avgResponseTime: 0,
        };

        if (this.config.enabled) {
            this.startAnalysis();
        }
    }

    private startAnalysis(): void {
        setInterval(() => {
            this.analyzePatterns();
        }, this.config.analysisInterval);
    }

    analyzeRequest(method: string, path: string, responseTime: number): void {
        if (!this.config.enabled) return;

        const key = `${method}:${path}`;
        const now = Date.now();

        if (!this.patterns.has(key)) {
            this.patterns.set(key, {
                count: 0,
                lastSeen: now,
                avgResponseTime: 0,
                priority: 0,
                method,
                path,
                frequency: 0,
                trend: "stable",
            });
            this.stats.totalPatterns++;
        }

        const pattern = this.patterns.get(key)!;
        pattern.count++;
        pattern.lastSeen = now;
        pattern.avgResponseTime =
            (pattern.avgResponseTime * (pattern.count - 1) + responseTime) /
            pattern.count;

        this.updatePatternStats();
    }

    private analyzePatterns(): void {
        const now = Date.now();
        let totalResponseTime = 0;
        let activePatterns = 0;
        let hotPatterns = 0;
        const trends: Record<string, number> = {};

        this.patterns.forEach((pattern, key) => {
            // Remove old patterns
            if (now - pattern.lastSeen > this.config.patternRetentionTime) {
                this.patterns.delete(key);
                this.stats.totalPatterns--;
                return;
            }

            // Calculate frequency (requests per hour)
            const hoursSinceFirst = (now - pattern.lastSeen) / 3600000;
            pattern.frequency = pattern.count / Math.max(hoursSinceFirst, 1);

            // Update trend
            const prevFrequency = pattern.frequency;
            if (pattern.frequency > prevFrequency * 1.1) {
                pattern.trend = "increasing";
            } else if (pattern.frequency < prevFrequency * 0.9) {
                pattern.trend = "decreasing";
            } else {
                pattern.trend = "stable";
            }

            // Update stats
            totalResponseTime += pattern.avgResponseTime;
            activePatterns++;
            if (pattern.frequency >= this.config.hotPatternThreshold) {
                hotPatterns++;
            }
            trends[pattern.trend] = (trends[pattern.trend] || 0) + 1;

            // Update priority based on frequency and response time
            pattern.priority = this.calculatePriority(pattern);
        });

        this.stats.activePatterns = activePatterns;
        this.stats.hotPatterns = hotPatterns;
        this.stats.trends = trends;
        this.stats.avgResponseTime =
            activePatterns > 0 ? totalResponseTime / activePatterns : 0;
    }

    private calculatePriority(pattern: RequestPattern): number {
        const frequencyWeight = 0.6;
        const responseTimeWeight = 0.4;

        const normalizedFrequency = Math.min(
            pattern.frequency / this.config.hotPatternThreshold,
            1
        );
        const normalizedResponseTime = Math.min(
            pattern.avgResponseTime / 1000,
            1
        ); // Assuming 1s as max

        return (
            (normalizedFrequency * frequencyWeight +
                normalizedResponseTime * responseTimeWeight) *
            100
        );
    }

    private updatePatternStats(): void {
        this.stats.activePatterns = this.patterns.size;
        this.stats.hotPatterns = Array.from(this.patterns.values()).filter(
            (p) => p.frequency >= this.config.hotPatternThreshold
        ).length;
    }

    getPatterns(): Map<string, RequestPattern> {
        return new Map(this.patterns);
    }

    getStats(): PatternStats {
        return { ...this.stats };
    }

    getHotPatterns(): RequestPattern[] {
        return Array.from(this.patterns.values())
            .filter((p) => p.frequency >= this.config.hotPatternThreshold)
            .sort((a, b) => b.priority - a.priority);
    }

    updateConfig(config: Partial<AnalyzerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    reset(): void {
        this.patterns.clear();
        this.stats = {
            totalPatterns: 0,
            activePatterns: 0,
            hotPatterns: 0,
            trends: {},
            avgResponseTime: 0,
        };
    }
}


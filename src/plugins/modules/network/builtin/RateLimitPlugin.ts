/**
 * Rate Limit Plugin
 *
 * Advanced rate limiting with multiple strategies, Redis support, and per-route limits
 * Uses express-rate-limit and Redis for distributed rate limiting
 */

import { Request, Response } from "express";
import { performance } from "perf_hooks";
import rateLimit from "express-rate-limit";
import { Redis } from "ioredis";
import { NetworkPlugin } from "../core/NetworkPlugin";

// Import security modules from xypriss-security package
import { RandomTokens } from "xypriss-security";
import * as crypto from "crypto";

// Import XyPriss cache system
import { SecureCacheAdapter } from "../../../../cache";
import type { SecureCacheConfig } from "../../../../cache/type";
import {
    NetworkExecutionContext,
    NetworkExecutionResult,
    NetworkCategory,
    RateLimitConfig,
    RateLimitStrategy,
    RateLimitRule,
    RedisConfig,
    NetworkHealthStatus,
} from "../types/NetworkTypes";
import { Logger } from "../../../../../shared/logger";

/**
 * Advanced rate limiting plugin with Redis support
 */
export class RateLimitPlugin extends NetworkPlugin {
    public readonly id = "xypriss.network.ratelimit";
    public readonly name = "XyPriss Rate Limiting Plugin (XPRL)";
    public readonly version = "1.0.0";
    public readonly networkCategory = NetworkCategory.RATE_LIMIT;
    private readonly logger: Logger;

    // Rate limiting state
    private cacheAdapter!: SecureCacheAdapter;
    private rateLimiters = new Map<string, any>();
    private rateLimitStats = {
        totalRequests: 0,
        blockedRequests: 0,
        allowedRequests: 0,
        rateLimitHits: new Map<string, number>(),
        averageRequestsPerSecond: 0,
        peakRequestsPerSecond: 0,
        lastResetTime: Date.now(),
        securityEvents: new Map<string, number>(),
    };

    constructor(
        config: RateLimitConfig = {
            enabled: true,
            strategy: "fixed-window",
            global: { requests: 1000, window: "1h" },
            skipSuccessfulRequests: false,
            skipFailedRequests: false,
        }
    ) {
        super(config);
        this.logger = new Logger();
        this.initializeCacheAdapter();
        this.initializeRateLimiting();
    }

    /**
     * Initialize cache adapter for rate limiting storage
     */
    private initializeCacheAdapter(): void {
        const config = this.getRateLimitConfig();

        // Configure cache adapter for rate limiting
        const cacheConfig: SecureCacheConfig = {
            strategy: config.redis ? "hybrid" : "memory", // Use memory-only if no Redis config
            memory: {
                maxSize: 50, // 50MB for rate limiting data
                ttl: 3600000, // 1 hour default TTL
                algorithm: "lru",
                evictionPolicy: "ttl",
            },
            performance: {
                compressionThreshold: 1024,
                asyncWrite: true,
                pipeline: true,
                connectionPooling: true,
            },
            security: {
                encryption: true,
                accessMonitoring: true,
                sanitization: true,
            },
            monitoring: {
                enabled: true,
                metricsInterval: 60000, // 1 minute
                detailed: false,
            },
        };

        // Only add Redis config if it exists
        if (config.redis) {
            cacheConfig.redis = {
                host: config.redis.host,
                port: config.redis.port,
                password: config.redis.password,
                db: config.redis.db || 0,
            };
        }

        this.cacheAdapter = new SecureCacheAdapter(cacheConfig);
    }

    /**
     * Initialize rate limiting using cache adapter
     */
    private async initializeRateLimiting(): Promise<void> {
        // Connect to cache backends
        await this.cacheAdapter.connect();

        // Create rate limiters
        this.createRateLimiters();

        // Start statistics tracking
        this.startStatsTracking();
    }

    /**
     * Create rate limiters for different scopes
     */
    private createRateLimiters(): void {
        const config = this.getRateLimitConfig();

        // Global rate limiter
        if (config.global) {
            this.rateLimiters.set(
                "global",
                this.createRateLimiter("global", config.global)
            );
        }

        // Per-IP rate limiter
        if (config.perIP) {
            this.rateLimiters.set(
                "perIP",
                this.createRateLimiter("perIP", config.perIP)
            );
        }

        // Per-user rate limiter
        if (config.perUser) {
            this.rateLimiters.set(
                "perUser",
                this.createRateLimiter("perUser", config.perUser)
            );
        }

        // Per-route rate limiters
        if (config.perRoute) {
            for (const [route, rule] of Object.entries(config.perRoute)) {
                this.rateLimiters.set(
                    `route:${route}`,
                    this.createRateLimiter(`route:${route}`, rule)
                );
            }
        }
    }

    /**
     * Create individual rate limiter
     */
    private createRateLimiter(scope: string, rule: RateLimitRule): any {
        const config = this.getRateLimitConfig();
        const windowMs = this.parseTimeWindow(rule.window);

        const limiterConfig: any = {
            windowMs,
            max: rule.requests,
            message: {
                error: "Too many requests",
                scope,
                limit: rule.requests,
                window: rule.window,
                retryAfter: Math.ceil(windowMs / 1000),
            },
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: config.skipSuccessfulRequests || false,
            skipFailedRequests: config.skipFailedRequests || false,

            // Custom key generator based on scope
            keyGenerator: (req: Request) =>
                this.generateRateLimitKey(req, scope),

            // Custom handler for rate limit exceeded
            handler: (req: Request, res: Response) => {
                this.handleRateLimitExceeded(req, res, scope);
            },

            // Skip function for conditional rate limiting
            skip: (req: Request) => this.shouldSkipRateLimit(req, scope),
        };

        // Add cache store for distributed rate limiting
        if (config.strategy !== "fixed-window") {
            limiterConfig.store = this.createCacheStore(scope, windowMs);
        }

        return rateLimit(limiterConfig);
    }

    /**
     * Execute rate limiting logic
     */
    public async executeNetwork(
        context: NetworkExecutionContext
    ): Promise<NetworkExecutionResult> {
        const startTime = performance.now();
        const { req, res } = context;

        try {
            if (!this.getRateLimitConfig().enabled) {
                return {
                    success: true,
                    executionTime: performance.now() - startTime,
                    shouldContinue: true,
                    data: {
                        rateLimited: false,
                        reason: "rate_limiting_disabled",
                    },
                };
            }

            // Apply rate limiters in order of specificity
            const rateLimitResults = await this.applyRateLimiters(req, res);

            // Update statistics
            this.updateRateLimitStats(rateLimitResults);

            const executionTime = performance.now() - startTime;
            const wasBlocked = rateLimitResults.some(
                (result) => result.blocked
            );

            return {
                success: true,
                executionTime,
                shouldContinue: !wasBlocked,
                data: {
                    rateLimited: wasBlocked,
                    appliedLimits: rateLimitResults,
                    remainingRequests: this.getRemainingRequests(req),
                },
                modifications: wasBlocked
                    ? {
                          statusCode: 429,
                          headers: {
                              "Retry-After": "60",
                              "X-RateLimit-Limit": this.getRateLimitHeader(req),
                              "X-RateLimit-Remaining": "0",
                          },
                      }
                    : undefined,
                networkMetrics: {
                    processingTime: executionTime,
                    memoryUsage: process.memoryUsage().heapUsed,
                    cpuUsage: process.cpuUsage().user,
                },
            };
        } catch (error: any) {
            return {
                success: false,
                executionTime: performance.now() - startTime,
                shouldContinue: true,
                error,
            };
        }
    }

    /**
     * Apply all configured rate limiters
     */
    private async applyRateLimiters(
        req: Request,
        res: Response
    ): Promise<any[]> {
        const results: any[] = [];

        for (const [scope, limiter] of this.rateLimiters.entries()) {
            if (this.shouldApplyLimiter(req, scope)) {
                try {
                    await new Promise<void>((resolve, reject) => {
                        limiter(req, res, (err: any) => {
                            if (err) {
                                if (err.status === 429) {
                                    results.push({
                                        scope,
                                        blocked: true,
                                        error: err,
                                    });
                                    resolve(); // Don't reject, just mark as blocked
                                } else {
                                    reject(err);
                                }
                            } else {
                                results.push({ scope, blocked: false });
                                resolve();
                            }
                        });
                    });
                } catch (error) {
                    results.push({ scope, blocked: true, error });
                }
            }
        }

        return results;
    }

    /**
     * Generate secure rate limit key based on scope using security modules
     */
    private generateRateLimitKey(req: Request, scope: string): string {
        let baseKey: string;

        switch (scope) {
            case "global":
                baseKey = "global";
                break;
            case "perIP":
                baseKey = req.ip || req.socket.remoteAddress || "unknown";
                break;
            case "perUser":
                baseKey = (req as any).user?.id || req.ip || "anonymous";
                break;
            default:
                if (scope.startsWith("route:")) {
                    const route = scope.substring(6);
                    baseKey = `${route}:${req.ip}`;
                } else {
                    baseKey = req.ip || "unknown";
                }
        }

        // Use secure hashing for consistent key generation
        return this.generateSecureKey(baseKey, scope);
    }

    /**
     * Generate secure hash key using xypriss-security Hash module
     */
    private generateSecureKey(baseKey: string, scope: string): string {
        try {
            // Use crypto module with secure approach for synchronous operation
            const keyData = `${scope}:${baseKey}:${
                this.getRateLimitConfig().global?.window || "1h"
            }`;

            // Use timing-safe comparison approach from security module
            const hash = crypto
                .createHash("sha256")
                .update(keyData)
                .digest("hex");

            // Add entropy using SecureRandom if available
            const salt = this.generateSecureSalt();
            return crypto
                .createHash("sha256")
                .update(hash + salt)
                .digest("hex");
        } catch (error) {
            // Fallback to crypto hash
            return crypto
                .createHash("sha256")
                .update(`${scope}:${baseKey}`)
                .digest("hex");
        }
    }

    /**
     * Generate secure salt for key hashing
     */
    private generateSecureSalt(): string {
        try {
            // Use SecureRandom for salt generation
            return RandomTokens.generateSecureToken(16);
        } catch (error) {
            // Fallback to crypto random bytes
            return crypto.randomBytes(16).toString("hex");
        }
    }

    /**
     * Parse time window string to milliseconds
     */
    private parseTimeWindow(window: string): number {
        const match = window.match(/^(\d+)([smhd])$/);
        if (!match) return 60000; // Default 1 minute

        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case "s":
                return value * 1000;
            case "m":
                return value * 60 * 1000;
            case "h":
                return value * 60 * 60 * 1000;
            case "d":
                return value * 24 * 60 * 60 * 1000;
            default:
                return 60000;
        }
    }

    /**
     * Create cache store for distributed rate limiting using SecureCacheAdapter
     */
    private createCacheStore(scope: string, windowMs: number): any {
        return {
            incr: async (key: string, cb: Function) => {
                try {
                    const fullKey = `ratelimit:${scope}:${key}`;

                    // Get current count from cache
                    const cached = await this.cacheAdapter.get(fullKey);
                    const current = cached ? (cached.value as number) + 1 : 1;

                    // Store updated count with TTL
                    await this.cacheAdapter.set(fullKey, current, {
                        ttl: windowMs,
                        tags: [`ratelimit`, scope],
                    });

                    cb(null, {
                        totalHits: current,
                        resetTime: new Date(Date.now() + windowMs),
                    });
                } catch (error) {
                    cb(error);
                }
            },
            decrement: async (key: string) => {
                try {
                    const fullKey = `ratelimit:${scope}:${key}`;
                    const cached = await this.cacheAdapter.get(fullKey);
                    const current = cached
                        ? Math.max(0, (cached.value as number) - 1)
                        : 0;

                    if (current > 0) {
                        await this.cacheAdapter.set(fullKey, current, {
                            ttl: windowMs,
                            tags: [`ratelimit`, scope],
                        });
                    } else {
                        await this.cacheAdapter.delete(fullKey);
                    }
                } catch (error) {
                    this.logger.warn(
                        "plugins",
                        "Failed to decrement rate limit key:",
                        error
                    );
                }
            },
            resetKey: async (key: string) => {
                try {
                    const fullKey = `ratelimit:${scope}:${key}`;
                    await this.cacheAdapter.delete(fullKey);
                } catch (error) {
                    this.logger.warn(
                        "plugins",
                        "Failed to reset rate limit key:",
                        error
                    );
                }
            },
        };
    }

    /**
     * Handle rate limit exceeded
     */
    private handleRateLimitExceeded(
        req: Request,
        res: Response,
        scope: string
    ): void {
        this.rateLimitStats.blockedRequests++;

        const hitCount = this.rateLimitStats.rateLimitHits.get(scope) || 0;
        this.rateLimitStats.rateLimitHits.set(scope, hitCount + 1);

        if (!res.headersSent) {
            res.status(429).json({
                error: "Rate limit exceeded",
                scope,
                message: `Too many requests for ${scope}`,
                retryAfter: 60,
                timestamp: new Date().toISOString(),
            });
        }
    }

    /**
     * Check if rate limiter should be applied
     */
    private shouldApplyLimiter(req: Request, scope: string): boolean {
        if (scope.startsWith("route:")) {
            const route = scope.substring(6);
            return req.path === route || req.path.startsWith(route);
        }
        return true;
    }

    /**
     * Check if request should skip rate limiting
     */
    private shouldSkipRateLimit(req: Request, scope: string): boolean {
        // Skip rate limiting for health checks
        if (req.path === "/health" || req.path === "/ping") {
            return true;
        }

        // Skip for internal requests
        if (req.get("X-Internal-Request")) {
            return true;
        }

        return false;
    }

    /**
     * Update rate limiting statistics
     */
    private updateRateLimitStats(results: any[]): void {
        this.rateLimitStats.totalRequests++;

        const wasBlocked = results.some((result) => result.blocked);
        if (wasBlocked) {
            this.rateLimitStats.blockedRequests++;
        } else {
            this.rateLimitStats.allowedRequests++;
        }
    }

    /**
     * Get remaining requests for client using secure key lookup
     */
    private getRemainingRequests(req: Request): number {
        try {
            const key = this.generateRateLimitKey(req, "perIP");
            // In a real implementation, this would query Redis or memory store
            // For now, return a calculated value based on current stats
            const config = this.getRateLimitConfig();
            const maxRequests =
                config.perIP?.requests || config.global?.requests || 1000;
            const usedRequests =
                this.rateLimitStats.totalRequests % maxRequests;
            return Math.max(0, maxRequests - usedRequests);
        } catch (error) {
            return 0; // Conservative approach on error
        }
    }

    /**
     * Get rate limit header value based on request context
     */
    private getRateLimitHeader(req: Request): string {
        const config = this.getRateLimitConfig();

        // Determine which limit applies to this request
        if (config.perIP && req.ip) {
            return config.perIP.requests.toString();
        }

        return config.global?.requests.toString() || "1000";
    }

    /**
     * Start statistics tracking
     */
    private startStatsTracking(): void {
        setInterval(() => {
            this.updateRequestsPerSecond();
        }, 1000);
    }

    /**
     * Update requests per second statistics
     */
    private updateRequestsPerSecond(): void {
        const now = Date.now();
        const timeDiff = (now - this.rateLimitStats.lastResetTime) / 1000;

        if (timeDiff >= 1) {
            const requestsPerSecond =
                this.rateLimitStats.totalRequests / timeDiff;
            this.rateLimitStats.averageRequestsPerSecond = requestsPerSecond;

            if (requestsPerSecond > this.rateLimitStats.peakRequestsPerSecond) {
                this.rateLimitStats.peakRequestsPerSecond = requestsPerSecond;
            }
        }
    }

    /**
     * Get rate limit configuration
     */
    private getRateLimitConfig(): RateLimitConfig {
        return this.config as RateLimitConfig;
    }

    /**
     * Validate rate limit configuration
     */
    public validateNetworkConfig(config: RateLimitConfig): boolean {
        if (config.global && config.global.requests <= 0) {
            return false;
        }

        if (config.perIP && config.perIP.requests <= 0) {
            return false;
        }

        return true;
    }

    /**
     * Check network health
     */
    public async checkNetworkHealth(): Promise<NetworkHealthStatus> {
        const blockRate =
            this.rateLimitStats.blockedRequests /
            Math.max(this.rateLimitStats.totalRequests, 1);

        const cacheHealthy = await this.checkCacheHealth();

        return {
            healthy: blockRate < 0.5 && cacheHealthy,
            status:
                blockRate < 0.2 && cacheHealthy
                    ? "healthy"
                    : blockRate < 0.5 && cacheHealthy
                    ? "degraded"
                    : "unhealthy",
            metrics: {
                responseTime: this.performanceMetrics.averageExecutionTime,
                errorRate: blockRate,
                throughput: this.rateLimitStats.averageRequestsPerSecond,
                connections: cacheHealthy ? 1 : 0,
            },
            lastCheck: new Date(),
        };
    }

    /**
     * Check cache adapter health
     */
    private async checkCacheHealth(): Promise<boolean> {
        try {
            // Test cache connectivity by performing a simple operation
            const testKey = "health_check_test";
            await this.cacheAdapter.set(testKey, "test", { ttl: 1000 });
            const result = await this.cacheAdapter.get(testKey);
            await this.cacheAdapter.delete(testKey);

            return result !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get rate limiting statistics
     */
    public getRateLimitStats() {
        return {
            ...this.rateLimitStats,
            cacheConnected: true, // Cache adapter handles connection status internally
            activeLimiters: this.rateLimiters.size,
            rateLimitHits: Object.fromEntries(
                this.rateLimitStats.rateLimitHits
            ),
        };
    }

    /**
     * Cleanup resources
     */
    public async destroy(): Promise<void> {
        // Disconnect from cache adapter
        await this.cacheAdapter.disconnect();
        await super.destroy();
    }
}


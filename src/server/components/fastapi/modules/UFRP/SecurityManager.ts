/**
 * XyPrissJS - Security Manager Module
 * Handles security-related operations like header sanitization and validation
 */

import { SecureInMemoryCache } from "../../../../../cache";
import { SecurityConfig, SecurityStats } from "./types/SecurityTypes";
import { Request, Response, NextFunction } from "express";

export class SecurityManager {
    private config: SecurityConfig;
    private stats: SecurityStats;
    private rateLimitCache: SecureInMemoryCache;

    constructor(config: Partial<SecurityConfig> = {}) {
        this.config = {
            allowedHeaders: [
                "content-type",
                "accept",
                "authorization",
                "x-requested-with",
                "user-agent",
            ],
            sensitiveHeaders: ["authorization", "cookie", "x-api-key"],
            maxRequestSize: 1024 * 1024, // 1MB
            rateLimits: {
                windowMs: 60000, // 1 minute
                maxRequests: 100,
            },
            ...config,
        };

        this.stats = {
            totalRequests: 0,
            blockedRequests: 0,
            rateLimitedRequests: 0,
            avgRequestSize: 0,
            securityViolations: {
                oversizedRequests: 0,
                malformedHeaders: 0,
                rateLimitViolations: 0,
            },
        };

        // Initialize rate limiting cache with secure in-memory storage
        this.rateLimitCache = new SecureInMemoryCache();
    }

    async validateRequest(
        req: Request
    ): Promise<{ valid: boolean; reason?: string }> {
        this.stats.totalRequests++;

        // Check request size
        const contentLength = parseInt(req.headers["content-length"] || "0");
        if (contentLength > this.config.maxRequestSize) {
            this.stats.securityViolations.oversizedRequests++;
            this.stats.blockedRequests++;
            return { valid: false, reason: "Request too large" };
        }

        // Validate headers
        const invalidHeaders = this.validateHeaders(req.headers);
        if (invalidHeaders.length > 0) {
            this.stats.securityViolations.malformedHeaders++;
            this.stats.blockedRequests++;
            return {
                valid: false,
                reason: `Invalid headers: ${invalidHeaders.join(", ")}`,
            };
        }

        // Check rate limits
        if (!(await this.checkRateLimit(req))) {
            this.stats.securityViolations.rateLimitViolations++;
            this.stats.rateLimitedRequests++;
            return { valid: false, reason: "Rate limit exceeded" };
        }

        // Update average request size
        this.stats.avgRequestSize =
            (this.stats.avgRequestSize * (this.stats.totalRequests - 1) +
                contentLength) /
            this.stats.totalRequests;

        return { valid: true };
    }

    private validateHeaders(
        headers: Record<string, string | string[] | undefined>
    ): string[] {
        const invalidHeaders: string[] = [];

        for (const [key, value] of Object.entries(headers)) {
            // Check if header is allowed
            if (!this.config.allowedHeaders.includes(key.toLowerCase())) {
                invalidHeaders.push(key);
                continue;
            }

            // Validate sensitive headers
            if (this.config.sensitiveHeaders.includes(key.toLowerCase())) {
                if (!value || (Array.isArray(value) && value.length === 0)) {
                    invalidHeaders.push(key);
                }
            }
        }

        return invalidHeaders;
    }

    private async checkRateLimit(req: Request): Promise<boolean> {
        try {
            // Generate rate limit key based on IP address and user agent for better security
            const clientIp = req.ip || req.socket.remoteAddress || "unknown";
            const userAgent = req.headers["user-agent"] || "unknown";
            const rateLimitKey = `rate_limit:${clientIp}:${userAgent.substring(
                0,
                50
            )}`;

            const now = Date.now();
            const windowMs = this.config.rateLimits.windowMs;
            const maxRequests = this.config.rateLimits.maxRequests;

            // Get current rate limit data for this client
            const rateLimitData = (await this.rateLimitCache.get(
                rateLimitKey
            )) as {
                count: number;
                resetTime: number;
            } | null;

            let currentData: { count: number; resetTime: number };

            if (!rateLimitData || rateLimitData.resetTime < now) {
                // Initialize or reset the rate limit window
                currentData = {
                    count: 1,
                    resetTime: now + windowMs,
                };
            } else {
                // Increment the request count
                currentData = {
                    count: rateLimitData.count + 1,
                    resetTime: rateLimitData.resetTime,
                };
            }

            // Store updated rate limit data
            await this.rateLimitCache.set(rateLimitKey, currentData, {
                ttl: windowMs,
                encrypt: false, // Rate limit data doesn't need encryption
                compress: false, // Small data, no compression needed
            });

            // Check if rate limit is exceeded
            if (currentData.count > maxRequests) {
                return false; // Rate limit exceeded
            }

            return true; // Within rate limit
        } catch (error) {
            // If rate limiting fails, allow the request but log the error
            console.error("Rate limiting error:", error);
            return true;
        }
    }

    sanitizeHeaders(
        headers: Record<string, string | string[] | undefined>
    ): Record<string, string> {
        const sanitized: Record<string, string> = {};

        for (const [key, value] of Object.entries(headers)) {
            if (
                this.config.allowedHeaders.includes(key.toLowerCase()) &&
                value !== undefined
            ) {
                // For sensitive headers, only keep the first value
                if (this.config.sensitiveHeaders.includes(key.toLowerCase())) {
                    sanitized[key] = Array.isArray(value) ? value[0] : value;
                } else {
                    sanitized[key] = Array.isArray(value)
                        ? value.join(", ")
                        : value;
                }
            }
        }

        return sanitized;
    }

    getMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const { valid, reason } = await this.validateRequest(req);

                if (!valid) {
                    res.status(400).json({ error: reason });
                    return;
                }

                // Sanitize headers
                req.headers = this.sanitizeHeaders(req.headers);
                next();
            } catch (error) {
                console.error("Security middleware error:", error);
                res.status(500).json({ error: "Internal security error" });
            }
        };
    }

    getStats(): SecurityStats {
        return { ...this.stats };
    }

    updateConfig(config: Partial<SecurityConfig>): void {
        this.config = { ...this.config, ...config };
    }

    reset(): void {
        this.stats = {
            totalRequests: 0,
            blockedRequests: 0,
            rateLimitedRequests: 0,
            avgRequestSize: 0,
            securityViolations: {
                oversizedRequests: 0,
                malformedHeaders: 0,
                rateLimitViolations: 0,
            },
        };
    }
}


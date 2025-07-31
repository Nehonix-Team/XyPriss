/**
 * XyPrissJS - Security Types
 */

export interface SecurityConfig {
    allowedHeaders: string[];
    sensitiveHeaders: string[];
    maxRequestSize: number;
    rateLimits: {
        windowMs: number;
        maxRequests: number;
    };
}

export interface SecurityStats {
    totalRequests: number;
    blockedRequests: number;
    rateLimitedRequests: number;
    avgRequestSize: number;
    securityViolations: {
        oversizedRequests: number;
        malformedHeaders: number;
        rateLimitViolations: number;
    };
}


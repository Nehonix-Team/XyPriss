/**
 * Smart Cache Plugin
 *
 * Intelligent caching plugin with <0.5ms execution overhead
 * leveraging XyPrissJS cache systems for optimal performance.
 */

import { CachePlugin } from "../core/CachePlugin";
import {
    PluginPriority,
    PluginExecutionContext,
    PluginInitializationContext,
} from "../types/PluginTypes";

/**
 * Smart Cache Plugin for intelligent request caching
 */
export class SmartCachePlugin extends CachePlugin {
    public readonly id = "xypriss::nehonix.ftfy.cache";
    public readonly name = "Smart Cache Plugin";
    public readonly version = "1.3.19";
    public readonly priority = PluginPriority.HIGH;

    // Cache configuration
    public readonly cacheStrategy: "memory" | "redis" | "hybrid" = "hybrid";
    public readonly compressionEnabled = true;
    public readonly encryptionEnabled = true; // Keep encryption for security

    // Smart caching rules
    private cachingRules: Map<
        string,
        {
            pattern: RegExp;
            ttl: number;
            enabled: boolean;
            compression: boolean;
            tags: string[];
        }
    > = new Map();

    // Cache analytics
    private cacheAnalytics = {
        totalRequests: 0,
        cacheableRequests: 0,
        cacheHits: 0,
        cacheMisses: 0,
        cacheSkips: 0,
        averageHitTime: 0,
        averageMissTime: 0,
        compressionSavings: 0,
    };

    // Dynamic TTL adjustment based on request patterns
    private requestPatterns: Map<
        string,
        {
            frequency: number;
            lastAccess: number;
            averageResponseTime: number;
            volatility: number; // How often the content changes
        }
    > = new Map();

    // Background prefetching queue and worker
    private prefetchQueue: Array<{
        url: string;
        priority: number;
        timestamp: number;
        context?: any;
    }> = [];
    private prefetchWorkerActive = false;
    private prefetchStats = {
        totalPrefetched: 0,
        successfulPrefetches: 0,
        failedPrefetches: 0,
        averagePrefetchTime: 0,
    };

    /**
     * Initialize smart cache plugin
     */
    protected async initializeCachePlugin(
        context: PluginInitializationContext,
    ): Promise<void> {
        // Setup default caching rules
        this.setupDefaultCachingRules();

        // Configure custom rules from settings
        if (context.config.customSettings.cachingRules) {
            this.configureCachingRules(
                context.config.customSettings.cachingRules,
            );
        }

        // Setup cache analytics cleanup
        this.setupAnalyticsCleanup();

        // Setup dynamic TTL adjustment
        this.setupDynamicTTLAdjustment();

        context.logger.debug(
            "plugins",
            "Smart Cache Plugin initialized with intelligent caching rules",
        );
    }

    /**
     * Check if request should be cached (plugin-specific logic)
     */
    protected shouldCacheRequest(context: PluginExecutionContext): boolean {
        const { req } = context;

        // Apply smart caching rules
        for (const [ruleName, rule] of this.cachingRules.entries()) {
            if (rule.enabled && rule.pattern.test(req.path)) {
                // Check additional conditions
                if (this.shouldApplyRule(context, rule)) {
                    return true;
                }
            }
        }

        // Fallback to intelligent heuristics
        return this.applyIntelligentCaching(context);
    }

    /**
     * Get custom cache key components
     */
    protected getCustomKeyComponents(
        context: PluginExecutionContext,
    ): string[] {
        const { req } = context;
        const components: string[] = [];

        // Add user-specific components for personalized content
        if (context.security.isAuthenticated) {
            components.push(`user:${context.security.userId}`);

            // Add role-based caching
            if (context.security.roles.length > 0) {
                components.push(
                    `roles:${context.security.roles.sort().join(",")}`,
                );
            }
        }

        // Add device type for responsive caching
        const userAgent = req.headers["user-agent"];
        if (userAgent) {
            const deviceType = this.detectDeviceType(userAgent);
            components.push(`device:${deviceType}`);
        }

        // Add language for i18n caching
        const acceptLanguage = req.headers["accept-language"];
        if (acceptLanguage) {
            const primaryLanguage = acceptLanguage.split(",")[0].split("-")[0];
            components.push(`lang:${primaryLanguage}`);
        }

        // Add API version for versioned APIs
        const apiVersion = req.headers["api-version"] || req.query.version;
        if (apiVersion) {
            components.push(`version:${apiVersion}`);
        }

        return components;
    }

    /**
     * Get custom TTL for request
     */
    protected getCustomTTL(context: PluginExecutionContext): number {
        const { req } = context;
        const route = this.normalizeRoute(req.path);

        // Check if we have pattern data for dynamic TTL
        const pattern = this.requestPatterns.get(route);
        if (pattern) {
            return this.calculateDynamicTTL(pattern);
        }

        // Apply rule-based TTL
        for (const [ruleName, rule] of this.cachingRules.entries()) {
            if (rule.enabled && rule.pattern.test(req.path)) {
                return rule.ttl;
            }
        }

        // Default TTL based on content type
        return this.getDefaultTTLByContentType(req.path);
    }

    /**
     * Handle custom cache operations
     */
    protected async handleCustomCacheOperation(
        context: PluginExecutionContext,
        operation: string,
    ): Promise<any> {
        switch (operation) {
            case "analyze":
                return await this.analyzeCachePerformance(context);
            case "optimize":
                return await this.optimizeCacheStrategy(context);
            case "prefetch":
                return await this.prefetchRelatedContent(context);
            default:
                return { operation, supported: false };
        }
    }

    /**
     * Precompile cache operations
     */
    protected async precompileCacheOperations(): Promise<void> {
        // Pre-warm route normalization
        this.normalizeRoute("/api/users/123");

        // Pre-warm device detection
        this.detectDeviceType(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        );

        // Pre-warm TTL calculation
        this.calculateDynamicTTL({
            frequency: 10,
            lastAccess: Date.now(),
            averageResponseTime: 100,
            volatility: 0.1,
        });
    }

    // ===== SMART CACHING LOGIC =====

    /**
     * Setup default caching rules
     */
    private setupDefaultCachingRules(): void {
        // Static assets - long TTL
        this.cachingRules.set("static", {
            pattern: /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/,
            ttl: 86400000, // 24 hours
            enabled: true,
            compression: true,
            tags: ["static"],
        });

        // API responses - medium TTL
        this.cachingRules.set("api", {
            pattern: /^\/api\/(?!auth|admin)/,
            ttl: 300000, // 5 minutes
            enabled: true,
            compression: true,
            tags: ["api"],
        });

        // Public pages - short TTL
        this.cachingRules.set("public", {
            pattern: /^\/(?!admin|dashboard|profile)/,
            ttl: 60000, // 1 minute
            enabled: true,
            compression: true,
            tags: ["public"],
        });

        // User-specific content - very short TTL
        this.cachingRules.set("user", {
            pattern: /^\/(profile|dashboard|settings)/,
            ttl: 30000, // 30 seconds
            enabled: true,
            compression: false,
            tags: ["user"],
        });
    }

    /**
     * Configure custom caching rules
     */
    private configureCachingRules(rules: any[]): void {
        for (const rule of rules) {
            this.cachingRules.set(rule.name, {
                pattern: new RegExp(rule.pattern),
                ttl: rule.ttl || 300000,
                enabled: rule.enabled !== false,
                compression: rule.compression !== false,
                tags: rule.tags || [],
            });
        }
    }

    /**
     * Check if caching rule should be applied
     */
    private shouldApplyRule(
        context: PluginExecutionContext,
        rule: any,
    ): boolean {
        const { req } = context;

        // Don't cache authenticated requests for public rules
        if (rule.tags.includes("public") && context.security.isAuthenticated) {
            return false;
        }

        // Don't cache if request has cache-control: no-cache
        const cacheControl = req.headers["cache-control"];
        if (cacheControl && cacheControl.includes("no-cache")) {
            return false;
        }

        // Don't cache if request has pragma: no-cache
        const pragma = req.headers.pragma;
        if (pragma && pragma.includes("no-cache")) {
            return false;
        }

        return true;
    }

    /**
     * Apply intelligent caching heuristics
     */
    private applyIntelligentCaching(context: PluginExecutionContext): boolean {
        const { req } = context;

        // Analyze request characteristics
        const hasQueryParams = Object.keys(req.query).length > 0;
        const hasBody = req.body && Object.keys(req.body).length > 0;
        const isIdempotent = ["GET", "HEAD", "OPTIONS"].includes(req.method);

        // Don't cache non-idempotent requests
        if (!isIdempotent) {
            return false;
        }

        // Don't cache requests with complex query parameters
        if (hasQueryParams && this.hasComplexQueryParams(req.query)) {
            return false;
        }

        // Cache simple GET requests
        if (req.method === "GET" && !hasBody) {
            return true;
        }

        return false;
    }

    /**
     * Calculate dynamic TTL based on request patterns
     */
    protected calculateDynamicTTL(pattern: any): number {
        const baseTime = 300000; // 5 minutes base

        // Adjust based on frequency (more frequent = longer cache)
        const frequencyMultiplier = Math.min(pattern.frequency / 10, 2);

        // Adjust based on volatility (more volatile = shorter cache)
        const volatilityMultiplier = Math.max(1 - pattern.volatility, 0.1);

        // Adjust based on response time (slower = longer cache)
        const responseTimeMultiplier = Math.min(
            pattern.averageResponseTime / 100,
            3,
        );

        return Math.round(
            baseTime *
                frequencyMultiplier *
                volatilityMultiplier *
                responseTimeMultiplier,
        );
    }

    /**
     * Get default TTL by content type
     */
    private getDefaultTTLByContentType(path: string): number {
        if (path.match(/\.(css|js)$/)) {
            return 3600000; // 1 hour for CSS/JS
        }

        if (path.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
            return 86400000; // 24 hours for images
        }

        if (path.startsWith("/api/")) {
            return 300000; // 5 minutes for API
        }

        return 60000; // 1 minute default
    }

    // ===== ANALYTICS AND OPTIMIZATION =====

    /**
     * Analyze cache performance
     */
    protected async analyzeCachePerformance(
        context: PluginExecutionContext,
    ): Promise<any> {
        const hitRate =
            this.cacheAnalytics.totalRequests > 0
                ? (this.cacheAnalytics.cacheHits /
                      this.cacheAnalytics.totalRequests) *
                  100
                : 0;

        const cacheableRate =
            this.cacheAnalytics.totalRequests > 0
                ? (this.cacheAnalytics.cacheableRequests /
                      this.cacheAnalytics.totalRequests) *
                  100
                : 0;

        return {
            hitRate: Math.round(hitRate * 100) / 100,
            cacheableRate: Math.round(cacheableRate * 100) / 100,
            totalRequests: this.cacheAnalytics.totalRequests,
            cacheHits: this.cacheAnalytics.cacheHits,
            cacheMisses: this.cacheAnalytics.cacheMisses,
            averageHitTime: this.cacheAnalytics.averageHitTime,
            averageMissTime: this.cacheAnalytics.averageMissTime,
            compressionSavings: this.cacheAnalytics.compressionSavings,
            topPatterns: this.getTopRequestPatterns(),
        };
    }

    /**
     * Optimize cache strategy
     */
    protected async optimizeCacheStrategy(
        context: PluginExecutionContext,
    ): Promise<any> {
        const optimizations: string[] = [];

        // Analyze hit rates by rule
        for (const [ruleName, rule] of this.cachingRules.entries()) {
            // Suggest optimizations based on performance
            if (rule.enabled) {
                optimizations.push(`Rule '${ruleName}' is active`);
            }
        }

        // Suggest TTL adjustments
        const ttlSuggestions = this.suggestTTLOptimizations();
        optimizations.push(...ttlSuggestions);

        return {
            optimizations,
            suggestions: this.generateSmartOptimizationSuggestions(),
        };
    }

    /**
     * Prefetch related content
     */
    protected async prefetchRelatedContent(
        context: PluginExecutionContext,
    ): Promise<any> {
        const { req } = context;
        const relatedUrls = this.identifyRelatedContent(req.path);

        // Queue related URLs for background prefetching
        const queuedUrls: string[] = [];
        for (const url of relatedUrls) {
            const priority = this.calculatePrefetchPriority(url, context);

            // Only queue high-priority URLs to avoid overwhelming the system
            if (priority > 0.5) {
                this.queueForPrefetch(url, priority, context);
                queuedUrls.push(url);
            }
        }

        // Start background prefetch worker if not already active
        if (!this.prefetchWorkerActive && this.prefetchQueue.length > 0) {
            this.startPrefetchWorker();
        }

        return {
            prefetched: queuedUrls.length,
            urls: queuedUrls,
            queueSize: this.prefetchQueue.length,
        };
    }

    /**
     * Queue a URL for background prefetching
     */
    private queueForPrefetch(
        url: string,
        priority: number,
        context: PluginExecutionContext,
    ): void {
        // Avoid duplicate entries
        const existingIndex = this.prefetchQueue.findIndex(
            (item) => item.url === url,
        );
        if (existingIndex >= 0) {
            // Update priority if higher
            if (this.prefetchQueue[existingIndex].priority < priority) {
                this.prefetchQueue[existingIndex].priority = priority;
                this.prefetchQueue[existingIndex].timestamp = Date.now();
            }
            return;
        }

        // Add to queue
        this.prefetchQueue.push({
            url,
            priority,
            timestamp: Date.now(),
            context: {
                method: context.req.method,
                headers: context.req.headers,
                baseUrl: `${context.req.protocol}://${context.req.get("host")}`,
            },
        });

        // Sort by priority (highest first)
        this.prefetchQueue.sort((a, b) => b.priority - a.priority);

        // Limit queue size to prevent memory issues
        if (this.prefetchQueue.length > 100) {
            this.prefetchQueue = this.prefetchQueue.slice(0, 100);
        }
    }

    /**
     * Calculate prefetch priority for a URL
     */
    private calculatePrefetchPriority(
        url: string,
        context: PluginExecutionContext,
    ): number {
        let priority = 0.3; // Base priority

        // Check request patterns
        const pattern = this.requestPatterns.get(url);
        if (pattern) {
            // Higher frequency = higher priority
            priority += Math.min(pattern.frequency / 100, 0.4);

            // Recent access = higher priority
            const timeSinceAccess = Date.now() - pattern.lastAccess;
            if (timeSinceAccess < 300000) {
                // 5 minutes
                priority += 0.2;
            }

            // Lower volatility = higher priority (more stable content)
            priority += (1 - pattern.volatility) * 0.1;
        }

        // Check if URL matches high-priority patterns
        if (url.includes("/api/") || url.includes("/static/")) {
            priority += 0.2;
        }

        // Check if it's a common resource type
        if (url.match(/\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2)$/)) {
            priority += 0.3;
        }

        return Math.min(priority, 1.0);
    }

    /**
     * Start the background prefetch worker
     */
    private async startPrefetchWorker(): Promise<void> {
        if (this.prefetchWorkerActive) return;

        this.prefetchWorkerActive = true;

        try {
            while (this.prefetchQueue.length > 0) {
                const item = this.prefetchQueue.shift();
                if (!item) break;

                // Skip items that are too old (older than 5 minutes)
                if (Date.now() - item.timestamp > 300000) {
                    continue;
                }

                await this.performPrefetch(item);

                // Small delay to prevent overwhelming the server
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
        } catch (error) {
            console.error("Prefetch worker error:", error);
        } finally {
            this.prefetchWorkerActive = false;
        }
    }

    /**
     * Perform actual prefetch operation
     */
    private async performPrefetch(item: {
        url: string;
        priority: number;
        context?: any;
    }): Promise<void> {
        const startTime = Date.now();

        try {
            // Perform actual HTTP request for prefetching to warm up the cache
            const response = await this.performActualPrefetchRequest(
                item.url,
                item.context,
            );

            if (response.success) {
                this.prefetchStats.successfulPrefetches++;

                // Update request patterns
                this.updateRequestPattern(item.url, Date.now() - startTime);
            } else {
                this.prefetchStats.failedPrefetches++;
            }

            this.prefetchStats.totalPrefetched++;

            // Update average prefetch time
            const prefetchTime = Date.now() - startTime;
            this.prefetchStats.averagePrefetchTime =
                (this.prefetchStats.averagePrefetchTime *
                    (this.prefetchStats.totalPrefetched - 1) +
                    prefetchTime) /
                this.prefetchStats.totalPrefetched;
        } catch (error) {
            this.prefetchStats.failedPrefetches++;
            this.prefetchStats.totalPrefetched++;
            console.error(`Prefetch failed for ${item.url}:`, error);
        }
    }

    /**
     * Perform actual prefetch request with real HTTP call
     */
    private async performActualPrefetchRequest(
        url: string,
        context?: any,
    ): Promise<{
        success: boolean;
        data?: any;
        statusCode?: number;
        headers?: any;
        error?: string;
    }> {
        try {
            // Construct full URL if relative
            let fullUrl = url;
            if (context?.baseUrl && !url.startsWith("http")) {
                fullUrl = `${context.baseUrl}${
                    url.startsWith("/") ? url : "/" + url
                }`;
            }

            // Prepare request options
            const requestOptions: any = {
                method: context?.method || "GET",
                headers: {
                    "User-Agent": "XyPrissJS-SmartCache/1.0",
                    Accept: "*/*",
                    "Cache-Control": "no-cache", // Force fresh fetch for prefetching
                    ...this.getFilteredHeaders(context?.headers),
                },
                timeout: 5000, // 5 second timeout for prefetch requests
                redirect: "follow",
                maxRedirects: 3,
            };

            // Use Node.js built-in fetch if available (Node 18+), otherwise use a fallback
            let response: any;
            let responseData: any;

            if (typeof fetch !== "undefined") {
                // Use native fetch
                response = await fetch(fullUrl, requestOptions);

                if (response.ok) {
                    // Try to get response data based on content type
                    const contentType =
                        response.headers.get("content-type") || "";

                    if (contentType.includes("application/json")) {
                        responseData = await response.json();
                    } else if (contentType.includes("text/")) {
                        responseData = await response.text();
                    } else {
                        // For binary data, just get the size
                        const buffer = await response.arrayBuffer();
                        responseData = {
                            size: buffer.byteLength,
                            type: "binary",
                        };
                    }
                } else {
                    throw new Error(
                        `HTTP ${response.status}: ${response.statusText}`,
                    );
                }
            } else {
                // Fallback using Node.js http/https modules
                response = await this.makeHttpRequest(fullUrl, requestOptions);
                responseData = response.data;
            }

            // Cache the prefetched content
            await this.cachePrefetchedContent(url, responseData, response);

            return {
                success: true,
                data: responseData,
                statusCode: response.status || response.statusCode,
                headers: response.headers,
            };
        } catch (error) {
            console.warn(`Prefetch failed for ${url}:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    /**
     * Filter headers to only include safe ones for prefetching
     */
    private getFilteredHeaders(headers?: any): Record<string, string> {
        if (!headers) return {};

        const safeHeaders: Record<string, string> = {};
        const allowedHeaders = [
            "accept",
            "accept-language",
            "accept-encoding",
            "user-agent",
        ];

        for (const [key, value] of Object.entries(headers)) {
            if (
                allowedHeaders.includes(key.toLowerCase()) &&
                typeof value === "string"
            ) {
                safeHeaders[key] = value;
            }
        }

        return safeHeaders;
    }

    /**
     * Make HTTP request using Node.js built-in modules
     */
    private async makeHttpRequest(url: string, options: any): Promise<any> {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === "https:";

            // Dynamically import http/https modules
            const httpModule = isHttps ? require("https") : require("http");

            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: options.method || "GET",
                headers: options.headers || {},
                timeout: options.timeout || 5000,
            };

            const req = httpModule.request(requestOptions, (res: any) => {
                let data = "";

                res.on("data", (chunk: any) => {
                    data += chunk;
                });

                res.on("end", () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data,
                    });
                });
            });

            req.on("error", (error: any) => {
                reject(error);
            });

            req.on("timeout", () => {
                req.destroy();
                reject(new Error("Request timeout"));
            });

            req.end();
        });
    }

    /**
     * Cache the prefetched content
     */
    private async cachePrefetchedContent(
        url: string,
        data: any,
        response: any,
    ): Promise<void> {
        try {
            // Generate cache key for the prefetched content
            const cacheKey = this.generatePrefetchCacheKey(url);

            // Determine TTL based on response headers
            const ttl = this.calculatePrefetchTTL(response);

            // Store in cache with appropriate metadata
            const cacheEntry = {
                url,
                data,
                timestamp: Date.now(),
                statusCode: response.status || response.statusCode,
                headers: response.headers,
                prefetched: true,
            };

            // Use the plugin's cache if available
            if (this.cache) {
                await this.cache.set(cacheKey, cacheEntry, { ttl });
            }
        } catch (error) {
            console.warn(
                `Failed to cache prefetched content for ${url}:`,
                error,
            );
        }
    }

    /**
     * Generate cache key for prefetched content
     */
    private generatePrefetchCacheKey(url: string): string {
        return `prefetch:${url}`;
    }

    /**
     * Calculate TTL for prefetched content based on response headers
     */
    private calculatePrefetchTTL(response: any): number {
        const headers = response.headers || {};

        // Check Cache-Control header
        const cacheControl =
            headers["cache-control"] || headers.get?.("cache-control");
        if (cacheControl) {
            const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
            if (maxAgeMatch) {
                return parseInt(maxAgeMatch[1]) * 1000; // Convert to milliseconds
            }
        }

        // Check Expires header
        const expires = headers["expires"] || headers.get?.("expires");
        if (expires) {
            const expiresDate = new Date(expires);
            const now = new Date();
            if (expiresDate > now) {
                return expiresDate.getTime() - now.getTime();
            }
        }

        // Default TTL for prefetched content (5 minutes)
        return 300000;
    }

    /**
     * Update request pattern data
     */
    private updateRequestPattern(url: string, responseTime: number): void {
        const pattern = this.requestPatterns.get(url) || {
            frequency: 0,
            lastAccess: 0,
            averageResponseTime: 0,
            volatility: 0.5,
        };

        pattern.frequency++;
        pattern.lastAccess = Date.now();
        pattern.averageResponseTime =
            (pattern.averageResponseTime * (pattern.frequency - 1) +
                responseTime) /
            pattern.frequency;

        this.requestPatterns.set(url, pattern);
    }

    // ===== UTILITY METHODS =====

    /**
     * Normalize route for pattern tracking
     */
    private normalizeRoute(path: string): string {
        return path
            .replace(/\/\d+/g, "/:id")
            .replace(/\/[a-f0-9-]{36}/g, "/:uuid")
            .replace(/\?.*$/, "");
    }

    /**
     * Detect device type from user agent
     */
    protected detectDeviceType(userAgent: string): string {
        if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
            return "mobile";
        }
        if (/Tablet|iPad/.test(userAgent)) {
            return "tablet";
        }
        return "desktop";
    }

    /**
     * Check for complex query parameters
     */
    private hasComplexQueryParams(query: any): boolean {
        const complexParams = [
            "search",
            "filter",
            "sort",
            "timestamp",
            "random",
        ];
        return complexParams.some((param) => param in query);
    }

    /**
     * Get top request patterns
     */
    private getTopRequestPatterns(): any[] {
        const patterns = Array.from(this.requestPatterns.entries())
            .sort((a, b) => b[1].frequency - a[1].frequency)
            .slice(0, 10);

        return patterns.map(([route, data]) => ({
            route,
            frequency: data.frequency,
            averageResponseTime: data.averageResponseTime,
            volatility: data.volatility,
        }));
    }

    /**
     * Suggest TTL optimizations
     */
    private suggestTTLOptimizations(): string[] {
        const suggestions: string[] = [];

        for (const [route, pattern] of this.requestPatterns.entries()) {
            if (pattern.frequency > 50 && pattern.volatility < 0.1) {
                suggestions.push(
                    `Increase TTL for high-frequency, stable route: ${route}`,
                );
            }

            if (pattern.volatility > 0.8) {
                suggestions.push(`Decrease TTL for volatile route: ${route}`);
            }
        }

        return suggestions;
    }

    /**
     * Generate optimization suggestions
     */
    private generateSmartOptimizationSuggestions(): string[] {
        const suggestions: string[] = [];

        const hitRate =
            this.cacheAnalytics.totalRequests > 0
                ? (this.cacheAnalytics.cacheHits /
                      this.cacheAnalytics.totalRequests) *
                  100
                : 0;

        if (hitRate < 30) {
            suggestions.push(
                "Consider increasing TTL values to improve hit rate",
            );
        }

        if (hitRate > 90) {
            suggestions.push(
                "Excellent cache performance - consider expanding caching rules",
            );
        }

        if (
            this.cacheAnalytics.averageMissTime >
            this.cacheAnalytics.averageHitTime * 10
        ) {
            suggestions.push(
                "High miss penalty - consider cache warming strategies",
            );
        }

        return suggestions;
    }

    /**
     * Identify related content for prefetching
     */
    private identifyRelatedContent(path: string): string[] {
        const related: string[] = [];

        // Simple related content identification
        if (path.startsWith("/api/users/")) {
            related.push("/api/users/profile", "/api/users/preferences");
        }

        if (path.startsWith("/api/products/")) {
            related.push("/api/products/categories", "/api/products/featured");
        }

        return related;
    }

    /**
     * Setup analytics cleanup
     */
    private setupAnalyticsCleanup(): void {
        // Reset analytics every hour
        setInterval(() => {
            this.resetAnalytics();
        }, 3600000); // 1 hour
    }

    /**
     * Setup dynamic TTL adjustment
     */
    private setupDynamicTTLAdjustment(): void {
        // Analyze patterns every 10 minutes
        setInterval(() => {
            this.analyzeRequestPatterns();
        }, 600000); // 10 minutes
    }

    /**
     * Reset analytics
     */
    private resetAnalytics(): void {
        // Keep some historical data, reset counters
        this.cacheAnalytics.totalRequests = 0;
        this.cacheAnalytics.cacheableRequests = 0;
        this.cacheAnalytics.cacheHits = 0;
        this.cacheAnalytics.cacheMisses = 0;
        this.cacheAnalytics.cacheSkips = 0;
    }

    /**
     * Analyze request patterns for optimization
     */
    private analyzeRequestPatterns(): void {
        const now = Date.now();

        // Clean up old patterns
        for (const [route, pattern] of this.requestPatterns.entries()) {
            if (now - pattern.lastAccess > 3600000) {
                // 1 hour
                this.requestPatterns.delete(route);
            }
        }
    }
}



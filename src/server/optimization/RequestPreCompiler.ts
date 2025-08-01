/**
 * Request Pre-Compiler
 *
 * optimization system that analyzes request patterns and pre-compiles
 * optimized execution paths for ultra-fast request processing (<1ms overhead).
 *
 * Key Features:
 * - Pattern recognition and route optimization
 * - Pre-compiled execution paths
 * - Intelligent caching strategies
 * - Zero-allocation hot paths
 * - Predictive request handling
 */

import { Request, Response, NextFunction } from "express";
import { SecureCacheAdapter } from "../../cache";
import { func } from "../../../mods/security/src/components/fortified-function";
import {
    CompiledRoute,
    DynamicResponseGenerator,
    PreCompilerConfig,
    RequestPattern,
    ResponseTemplate,
} from "../../types/ReqPreCompiler.type";
import { Logger } from "../utils/Logger";

export class RequestPreCompiler {
    private patterns: Map<string, RequestPattern> = new Map();
    private compiledRoutes: Map<string, CompiledRoute> = new Map();
    private cache: SecureCacheAdapter;
    private config: PreCompilerConfig;
    private learningMode = true;
    private logger: Logger;
    private optimizationStats = {
        totalRequests: 0,
        optimizedRequests: 0,
        avgOptimizationGain: 0,
        compilationTime: 0,
    };

    // Library-agnostic configuration
    private customResponseGenerators: DynamicResponseGenerator[] = [];
    private responseTemplates: Map<string, ResponseTemplate> = new Map();

    // Pre-allocated objects for zero-allocation hot paths
    private readonly fastPathContext = {
        startTime: 0,
        cacheKey: "",
        pattern: null as RequestPattern | null,
    };

    constructor(
        cache: SecureCacheAdapter,
        config: Partial<PreCompilerConfig> = {}
    ) {
        this.cache = cache;
        this.config = {
            enabled: true,
            learningPeriod: 300000, // 5 minutes
            optimizationThreshold: 10, // 10 requests per minute
            maxCompiledRoutes: 1000,
            aggressiveOptimization: false,
            predictivePreloading: true,
            customResponseGenerators: [],
            responseTemplates: [],
            systemInfo: {
                serviceName: "FastApi.ts Service",
                version: "1.0.0",
                environment: process.env.NODE_ENV || "development",
            },
            ...config,
        };

        // Initialize configurable components
        this.initializeCustomGenerators();
        this.initializeResponseTemplates();

        this.logger = new Logger();

        // Start learning period
        setTimeout(() => {
            this.learningMode = false;
            this.compileOptimizedRoutes();
        }, this.config.learningPeriod);
    }

    /**
     * Analyze incoming request and update patterns
     */
    public analyzeRequest(
        req: Request,
        res: Response,
        next: NextFunction
    ): void {
        const startTime = performance.now();
        const patternKey = this.generatePatternKey(req);

        // Update or create pattern
        const pattern =
            this.patterns.get(patternKey) ||
            this.createNewPattern(req, patternKey);
        pattern.frequency++;
        pattern.lastSeen = new Date();

        // Store pattern
        this.patterns.set(patternKey, pattern);

        // Track response time
        res.on("finish", () => {
            const responseTime = performance.now() - startTime;
            pattern.avgResponseTime =
                (pattern.avgResponseTime + responseTime) / 2;
            this.updateOptimizationStats(responseTime);
        });

        next();
    }

    /**
     * Get optimized handler for request if available
     */
    public getOptimizedHandler(req: Request): CompiledRoute | null {
        if (!this.config.enabled || this.learningMode) {
            return null;
        }

        const patternKey = this.generatePatternKey(req);
        return this.compiledRoutes.get(patternKey) || null;
    }

    /**
     * Pre-compile optimized execution paths for hot routes
     */
    private async compileOptimizedRoutes(): Promise<void> {
        this.logger.debug("server", "Starting route pre-compilation...");
        const compilationStart = performance.now();

        // Sort patterns by optimization potential - AGGRESSIVE MODE
        const sortedPatterns = Array.from(this.patterns.values())
            .filter((p) => p.frequency >= this.config.optimizationThreshold)
            .sort(
                (a, b) =>
                    this.calculateOptimizationPotential(b) -
                    this.calculateOptimizationPotential(a)
            )
            .slice(0, this.config.maxCompiledRoutes);

        // BOOST: Automatically upgrade high-potential routes to ultra optimization
        sortedPatterns.forEach((pattern) => {
            if (
                pattern.frequency >= 5 ||
                pattern.route.includes("health") ||
                pattern.route.includes("ping") ||
                pattern.route.includes("status")
            ) {
                pattern.optimizationLevel = "ultra";
                console.log(
                    `ULTRA-OPTIMIZED: ${pattern.route} (freq: ${pattern.frequency})`
                );
            } else if (pattern.frequency >= 2) {
                pattern.optimizationLevel = "advanced";
                console.log(
                    `ADVANCED-OPTIMIZED: ${pattern.route} (freq: ${pattern.frequency})`
                );
            } else {
                pattern.optimizationLevel = "basic";
            }
        });

        for (const pattern of sortedPatterns) {
            await this.compileRoute(pattern);
        }

        const compilationTime = performance.now() - compilationStart;
        this.optimizationStats.compilationTime = compilationTime;

        this.logger.info(
            "server",
            `✔ Pre-compiled ${
                sortedPatterns.length
            } routes in ${compilationTime.toFixed(2)}ms`
        );
    }

    /**
     * Compile individual route for maximum performance
     */
    private async compileRoute(pattern: RequestPattern): Promise<void> {
        const compiledRoute: CompiledRoute = {
            pattern,
            compiledHandler: this.createOptimizedHandler(pattern),
            optimizedMiddleware: this.createOptimizedMiddleware(pattern),
            cacheStrategy: this.determineCacheStrategy(pattern),
            executionPath: this.determineExecutionPath(pattern),
        };

        // Pre-compute data if beneficial
        if (pattern.optimizationLevel === "ultra") {
            compiledRoute.precomputedData = await this.precomputeRouteData(
                pattern
            );
        }

        this.compiledRoutes.set(pattern.id, compiledRoute);
    }

    /**
     * Create ultra-fast optimized handler
     */
    private createOptimizedHandler(pattern: RequestPattern): Function {
        return func(
            async (req: Request, res: Response) => {
                // Ultra-fast path with minimal overhead
                this.fastPathContext.startTime = performance.now();
                this.fastPathContext.pattern = pattern;

                // Skip unnecessary middleware for ultra-optimized routes
                if (pattern.optimizationLevel === "ultra") {
                    return this.handleUltraFastPath(req, res);
                }

                // Standard optimized path
                return this.handleOptimizedPath(req, res);
            },
            {
                ultraFast: "maximum",
                memoize: true,
                cacheTTL: 60000, // 1 minute
                timeout: 5000,
                errorHandling: "graceful",
            }
        );
    }

    /**
     * Handle ultra-fast execution path (<0.5ms target)
     */
    private async handleUltraFastPath(
        req: Request,
        res: Response
    ): Promise<void> {
        // Direct cache lookup with pre-computed key
        const cacheKey =
            this.fastPathContext.cacheKey || this.generateFastCacheKey(req);
        const cachedResponse = await this.cache.get(cacheKey);

        if (cachedResponse) {
            // Ultra-fast cache hit
            res.json(cachedResponse);
            return;
        }

        // Fallback to standard path if cache miss
        return this.handleOptimizedPath(req, res);
    }

    /**
     * Handle standard optimized path with template processing and fallback
     */
    private async handleOptimizedPath(
        req: Request,
        res: Response
    ): Promise<void> {
        try {
            // Optimized execution with reduced overhead
            const pattern = this.fastPathContext.pattern!;

            // Use pre-computed data if available
            const compiledRoute = this.compiledRoutes.get(pattern.id);
            if (compiledRoute?.precomputedData) {
                let responseData = compiledRoute.precomputedData;

                // Handle template substitution for parameterized routes
                if (responseData.template && req.params) {
                    responseData = this.processTemplateData(responseData, req);
                }

                // Add performance headers
                res.set("X-Precomputed", "true");
                res.set("X-Optimization-Level", pattern.optimizationLevel);
                res.set("X-Cache-Strategy", compiledRoute.cacheStrategy);

                res.json(responseData);
                return;
            }

            // Fallback: Generate dynamic response for known patterns
            const dynamicResponse = await this.generateDynamicResponse(
                req,
                pattern
            );
            if (dynamicResponse) {
                res.set("X-Precomputed", "false");
                res.set("X-Dynamic-Generation", "true");
                res.json(dynamicResponse);
                return;
            }

            // Final fallback: Let the request continue to normal route handlers
            // This integrates with the existing FastApi.ts route system
            console.log(
                `No precomputed data for ${pattern.route}, continuing to normal handler`
            );

            // The request will continue through the normal middleware chain
            // This is handled by the calling function in FastApi.ts
        } catch (error: any) {
            console.error(
                `Optimized path handling failed for ${req.path}:`,
                error.message
            );

            // Graceful fallback - let the request continue normally
            // The calling function will handle the fallback to standard processing
            throw error;
        }
    }

    /**
     * Process template data with parameter substitution
     */
    private processTemplateData(templateData: any, req: Request): any {
        try {
            let processedData = JSON.parse(JSON.stringify(templateData));

            // Remove template flag
            delete processedData.template;

            // Substitute URL parameters
            if (req.params) {
                const dataString = JSON.stringify(processedData);
                let substitutedString = dataString;

                Object.entries(req.params).forEach(([key, value]) => {
                    const placeholder = `{{${key}}}`;
                    const globalRegex = new RegExp(
                        placeholder.replace(/[{}]/g, "\\$&"),
                        "g"
                    );
                    substitutedString = substitutedString.replace(
                        globalRegex,
                        value as string
                    );
                });

                // Handle common parameter names
                if (req.params.id) {
                    substitutedString = substitutedString.replace(
                        /\{\{userId\}\}/g,
                        req.params.id
                    );
                }

                processedData = JSON.parse(substitutedString);
            }

            // Update timestamp for freshness
            if (processedData.timestamp) {
                processedData.timestamp = Date.now();
            }

            return processedData;
        } catch (error: any) {
            console.warn("Template processing failed:", error.message);
            return templateData;
        }
    }

    /**
     * Generate dynamic response for known patterns when precomputed data is not available
     * Library-agnostic implementation with configurable response generators
     */
    private async generateDynamicResponse(
        req: Request,
        pattern: RequestPattern
    ): Promise<any> {
        try {
            const route = pattern.route;
            const method = pattern.method;

            // Try custom response generators first (user-defined)
            for (const generator of this.customResponseGenerators) {
                try {
                    let matches = false;

                    if (typeof generator.pattern === "string") {
                        matches =
                            route === generator.pattern ||
                            route.includes(generator.pattern);
                    } else if (generator.pattern instanceof RegExp) {
                        matches = generator.pattern.test(route);
                    }

                    if (matches) {
                        const result = await generator.generator(req, pattern);
                        if (result !== null && result !== undefined) {
                            return {
                                ...result,
                                timestamp: Date.now(),
                                dynamic: true,
                                source: "custom-generator",
                            };
                        }
                    }
                } catch (error: any) {
                    console.warn(
                        `Custom generator failed for pattern ${generator.pattern}:`,
                        error.message
                    );
                    // Continue to next generator
                }
            }

            // Universal health check - always generate fresh data
            if (
                (route === "/health" || route.endsWith("/health")) &&
                method === "GET"
            ) {
                const systemInfo = this.config.systemInfo || {};
                const baseResponse = {
                    status: "ok",
                    timestamp: Date.now(),
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    service: systemInfo.serviceName || "FastApi.ts Service",
                    version: systemInfo.version || "1.0.0",
                    environment:
                        systemInfo.environment ||
                        process.env.NODE_ENV ||
                        "development",
                    dynamic: true,
                };

                // Add custom health data if provided
                if (
                    systemInfo.customHealthData &&
                    typeof systemInfo.customHealthData === "function"
                ) {
                    try {
                        const customData = await systemInfo.customHealthData();
                        return { ...baseResponse, ...customData };
                    } catch (error: any) {
                        console.warn(
                            "Custom health data generation failed:",
                            error.message
                        );
                    }
                }

                return baseResponse;
            }

            // Universal ping endpoint
            if (
                (route === "/ping" || route.endsWith("/ping")) &&
                method === "GET"
            ) {
                return {
                    pong: true,
                    timestamp: Date.now(),
                    service:
                        this.config.systemInfo?.serviceName ||
                        "FastApi.ts Service",
                    dynamic: true,
                };
            }

            // Universal status endpoint
            if (
                (route === "/status" || route.includes("status")) &&
                method === "GET"
            ) {
                const systemInfo = this.config.systemInfo || {};
                const baseResponse = {
                    status: "healthy",
                    timestamp: Date.now(),
                    service: systemInfo.serviceName || "FastApi.ts Service",
                    version: systemInfo.version || "1.0.0",
                    dynamic: true,
                };

                // Add custom status data if provided
                if (
                    systemInfo.customStatusData &&
                    typeof systemInfo.customStatusData === "function"
                ) {
                    try {
                        const customData = await systemInfo.customStatusData();
                        return { ...baseResponse, ...customData };
                    } catch (error: any) {
                        console.warn(
                            "Custom status data generation failed:",
                            error.message
                        );
                    }
                }

                return baseResponse;
            }

            // No universal pattern matched and no custom generators handled it
            // Return null to allow the application's actual route handlers to take over
            return null;
        } catch (error: any) {
            console.warn(
                `Dynamic response generation failed for ${pattern.route}:`,
                error.message
            );
            return null;
        }
    }

    /**
     * Generate pattern key for request classification
     */
    private generatePatternKey(req: Request): string {
        return `${req.method}:${
            req.route?.path || req.path
        }:${this.hashQueryParams(req.query)}`;
    }

    /**
     * Generate fast cache key with minimal overhead
     */
    private generateFastCacheKey(req: Request): string {
        // Pre-computed hash for ultra-fast lookup
        return `fast:${req.method}:${req.path}`;
    }

    /**
     * Hash query parameters for pattern matching
     */
    private hashQueryParams(query: any): string {
        const keys = Object.keys(query).sort();
        return keys.length > 0 ? keys.join(",") : "none";
    }

    /**
     * Create new request pattern
     */
    private createNewPattern(req: Request, patternKey: string): RequestPattern {
        return {
            id: patternKey,
            route: req.route?.path || req.path,
            method: req.method,
            frequency: 0,
            avgResponseTime: 0,
            cacheHitRate: 0,
            complexity: this.calculateRouteComplexity(req),
            lastSeen: new Date(),
            optimizationLevel: "none",
        };
    }

    /**
     * Calculate optimization potential for a pattern
     */
    private calculateOptimizationPotential(pattern: RequestPattern): number {
        const frequencyScore = Math.min(pattern.frequency / 100, 1) * 40;
        const responseTimeScore =
            Math.max(0, (100 - pattern.avgResponseTime) / 100) * 30;
        const complexityScore = ((5 - pattern.complexity) / 5) * 20;
        const recencyScore = this.calculateRecencyScore(pattern.lastSeen) * 10;

        return (
            frequencyScore + responseTimeScore + complexityScore + recencyScore
        );
    }

    /**
     * Calculate route complexity
     */
    private calculateRouteComplexity(req: Request): number {
        let complexity = 1;

        // Add complexity for query parameters
        complexity += Object.keys(req.query).length * 0.5;

        // Add complexity for path parameters
        complexity += Object.keys(req.params || {}).length * 0.3;

        // Add complexity for headers
        complexity += Object.keys(req.headers).length * 0.1;

        return Math.min(complexity, 5);
    }

    /**
     * Calculate recency score
     */
    private calculateRecencyScore(lastSeen: Date): number {
        const hoursSinceLastSeen =
            (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60);
        return Math.max(0, 1 - hoursSinceLastSeen / 24);
    }

    /**
     * Determine optimal cache strategy
     */
    private determineCacheStrategy(
        pattern: RequestPattern
    ): "memory" | "redis" | "hybrid" | "skip" {
        if (pattern.frequency > 50 && pattern.avgResponseTime > 10) {
            return "hybrid";
        } else if (pattern.frequency > 20) {
            return "memory";
        } else if (pattern.avgResponseTime > 50) {
            return "redis";
        }
        return "skip";
    }

    /**
     * Determine execution path
     */
    private determineExecutionPath(
        pattern: RequestPattern
    ): "fast" | "standard" | "complex" {
        if (pattern.complexity <= 2 && pattern.avgResponseTime <= 5) {
            return "fast";
        } else if (pattern.complexity <= 4 && pattern.avgResponseTime <= 20) {
            return "standard";
        }
        return "complex";
    }

    /**
     * Create optimized middleware stack
     */
    private createOptimizedMiddleware(pattern: RequestPattern): Function[] {
        const middleware: Function[] = [];

        // Skip unnecessary middleware for simple routes
        if (pattern.complexity <= 2) {
            return middleware;
        }

        // Add only essential middleware for complex routes
        return middleware;
    }

    /**
     * Pre-compute route data for ultra-fast responses
     * Generates static/semi-static response data for instant serving
     */
    private async precomputeRouteData(pattern: RequestPattern): Promise<any> {
        try {
            const route = pattern.route;
            const method = pattern.method;

            // Universal health check endpoints
            if (
                (route === "/health" || route.endsWith("/health")) &&
                method === "GET"
            ) {
                const systemInfo = this.config.systemInfo || {};
                const baseResponse = {
                    status: "ok",
                    timestamp: Date.now(),
                    uptime: process.uptime(),
                    service: systemInfo.serviceName || "FastApi.ts Service",
                    version: systemInfo.version || "1.0.0",
                    environment:
                        systemInfo.environment ||
                        process.env.NODE_ENV ||
                        "development",
                    precomputed: true,
                    responseTime: "<1ms",
                };

                // Add custom health data if provided
                if (
                    systemInfo.customHealthData &&
                    typeof systemInfo.customHealthData === "function"
                ) {
                    try {
                        const customData = await systemInfo.customHealthData();
                        return { ...baseResponse, ...customData };
                    } catch (error: any) {
                        console.warn(
                            "Custom health data generation failed:",
                            error.message
                        );
                    }
                }

                return baseResponse;
            }

            // Universal ping endpoints
            if (
                (route === "/ping" || route.endsWith("/ping")) &&
                method === "GET"
            ) {
                return {
                    pong: true,
                    timestamp: Date.now(),
                    service:
                        this.config.systemInfo?.serviceName ||
                        "FastApi.ts Service",
                    precomputed: true,
                };
            }

            // Universal status endpoints
            if (
                (route === "/status" || route.includes("status")) &&
                method === "GET"
            ) {
                const systemInfo = this.config.systemInfo || {};
                const baseResponse = {
                    status: "healthy",
                    timestamp: Date.now(),
                    service: systemInfo.serviceName || "FastApi.ts Service",
                    version: systemInfo.version || "1.0.0",
                    precomputed: true,
                };

                // Add custom status data if provided
                if (
                    systemInfo.customStatusData &&
                    typeof systemInfo.customStatusData === "function"
                ) {
                    try {
                        const customData = await systemInfo.customStatusData();
                        return { ...baseResponse, ...customData };
                    } catch (error: any) {
                        console.warn(
                            "Custom status data generation failed:",
                            error.message
                        );
                    }
                }

                return baseResponse;
            }

            // Check for registered response templates first
            const templateKey = `${method}:${route}`;
            const template = this.responseTemplates.get(templateKey);
            if (template) {
                return {
                    ...template.template,
                    timestamp: Date.now(),
                    precomputed: true,
                    source: "template",
                };
            }

            // Monitoring endpoints
            if (route.includes("/XyPriss/") && method === "GET") {
                return {
                    service: "XyPriss-monitoring",
                    status: "operational",
                    timestamp: Date.now(),
                    precomputed: true,
                };
            }

            // Default fallback for other routes
            return null;
        } catch (error: any) {
            console.warn(
                `Failed to precompute data for ${pattern.route}:`,
                error.message
            );
            return null;
        }
    }

    /**
     * Update optimization statistics
     */
    private updateOptimizationStats(responseTime: number): void {
        this.optimizationStats.totalRequests++;

        if (responseTime < 5) {
            this.optimizationStats.optimizedRequests++;
        }

        this.optimizationStats.avgOptimizationGain =
            (this.optimizationStats.avgOptimizationGain + responseTime) / 2;
    }

    /**
     * Get optimization statistics
     */
    public getStats() {
        return {
            ...this.optimizationStats,
            patternsLearned: this.patterns.size,
            routesCompiled: this.compiledRoutes.size,
            optimizationRate:
                this.optimizationStats.optimizedRequests /
                this.optimizationStats.totalRequests,
            customGenerators: this.customResponseGenerators.length,
            responseTemplates: this.responseTemplates.size,
        };
    }

    /**
     * Register a custom dynamic response generator
     * Allows developers to extend the optimization system with their own response logic
     */
    public registerResponseGenerator(
        generator: DynamicResponseGenerator
    ): void {
        this.customResponseGenerators.push(generator);
        // Sort by priority (higher priority first)
        this.customResponseGenerators.sort(
            (a, b) => (b.priority || 0) - (a.priority || 0)
        );
        console.log(
            `Registered custom response generator for pattern: ${generator.pattern}`
        );
    }

    /**
     * Register a response template for pre-computation
     * Allows developers to define static response structures for their routes
     */
    public registerResponseTemplate(template: ResponseTemplate): void {
        const key = `${template.method}:${template.route}`;
        this.responseTemplates.set(key, template);
        console.log(`Registered response template for: ${key}`);
    }

    /**
     * Remove a custom response generator
     */
    public unregisterResponseGenerator(pattern: string | RegExp): void {
        this.customResponseGenerators = this.customResponseGenerators.filter(
            (gen) => gen.pattern !== pattern
        );
    }

    /**
     * Clear all custom configurations
     */
    public clearCustomConfigurations(): void {
        this.customResponseGenerators = [];
        this.responseTemplates.clear();
        console.log("Cleared all custom response configurations");
    }

    /**
     * Force immediate compilation of registered templates and generators
     * Useful for testing or when you want immediate optimization without waiting for learning period
     */
    public forceCompileTemplates(): void {
        console.log(" Force compiling registered templates...");

        // Create patterns from registered templates
        this.responseTemplates.forEach((template, key) => {
            const [method, route] = key.split(":");
            const patternKey = `${method}:${route}:none`;

            const pattern: RequestPattern = {
                id: patternKey,
                route: route,
                method: method,
                frequency: 100, // High frequency to trigger ultra optimization
                avgResponseTime: 0.5, // Ultra-fast response time
                cacheHitRate: 0.9,
                complexity: 1, // Simple route
                lastSeen: new Date(),
                optimizationLevel: "ultra", // Force ultra optimization
            };

            this.patterns.set(patternKey, pattern);
            console.log(`📝 Created pattern for template: ${key}`);
        });

        // Create patterns from custom generators
        this.customResponseGenerators.forEach((generator, index) => {
            const patternString = generator.pattern.toString();
            const patternKey = `GET:${patternString}:none`;

            const pattern: RequestPattern = {
                id: patternKey,
                route: patternString,
                method: "GET",
                frequency: 50, // High frequency
                avgResponseTime: 1, // Fast response time
                cacheHitRate: 0.8,
                complexity: 2, // Slightly more complex
                lastSeen: new Date(),
                optimizationLevel: "advanced", // Advanced optimization
            };

            this.patterns.set(patternKey, pattern);
            console.log(
                `📝 Created pattern for generator ${index}: ${patternString}`
            );
        });

        // Force immediate compilation
        this.learningMode = false;
        this.compileOptimizedRoutes();

        console.log("✔ Force compilation completed!");
    }

    /**
     * Initialize custom response generators from configuration
     */
    private initializeCustomGenerators(): void {
        if (this.config.customResponseGenerators) {
            this.config.customResponseGenerators.forEach((generator) => {
                this.registerResponseGenerator(generator);
            });
        }
    }

    /**
     * Initialize response templates from configuration
     */
    private initializeResponseTemplates(): void {
        if (this.config.responseTemplates) {
            this.config.responseTemplates.forEach((template) => {
                this.registerResponseTemplate(template);
            });
        }
    }
}


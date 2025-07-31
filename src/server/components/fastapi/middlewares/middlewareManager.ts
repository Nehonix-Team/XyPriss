import express, { NextFunction, RequestHandler } from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import {
    MiddlewareManagerOptions,
    MiddlewareManagerDependencies,
    MiddlewareRegistryEntry,
    MiddlewareExecutionResult,
    MiddlewareCacheEntry,
    MiddlewareOptimizationConfig,
    IMiddlewareManager,
    MiddlewarePerformanceMetrics,
} from "../../../../types/components/middleware.type";
import {
    MiddlewareConfiguration,
    MiddlewarePriority,
    CustomMiddleware,
    MiddlewareInfo,
    MiddlewareStats,
} from "../../../../types/types";
import { logger } from "../../../utils/Logger";
import { NehoID } from "nehoid";

/**
 *  MiddlewareManager - Advanced middleware system with optimization, caching, and performance tracking
 * Provides comprehensive middleware management withXyPriss FastXyPrissServer (FFS)performance enhancements
 */
export class MiddlewareManager implements IMiddlewareManager {
    protected readonly options: MiddlewareManagerOptions;
    protected readonly dependencies: MiddlewareManagerDependencies;

    // Middleware registry and management
    private middlewareRegistry: Map<string, MiddlewareRegistryEntry> =
        new Map();
    private middlewareCache: Map<string, MiddlewareCacheEntry> = new Map();
    private executionOrder: string[] = [];

    // Performance tracking
    private performanceMetrics: MiddlewarePerformanceMetrics = {
        totalRequests: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        fastestExecution: Infinity,
        slowestExecution: 0,
        cacheHitRate: 0,
        errorRate: 0,
        throughput: 0,
        optimizationGain: 0,
    };

    // Configuration
    private optimizationConfig: MiddlewareOptimizationConfig = {
        enableCaching: true,
        enableBatching: true,
        enablePrioritization: true,
        enablePerformanceTracking: true,
        cacheWarming: true,
        optimizationThreshold: 10,
        maxCacheSize: 1000,
        defaultTTL: 300000, // 5 minutes
    };

    private initialized = false;

    constructor(
        options: MiddlewareManagerOptions,
        dependencies: MiddlewareManagerDependencies
    ) {
        this.options = options;
        this.dependencies = dependencies;
    }

    /**
     * Initialize the  middleware manager
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        logger.debug("middleware", "Initializing  Middleware Manager...");

        // Configure built-in middleware
        this.configureBuiltInMiddleware();

        // Configure optimization middleware
        this.configureOptimizationMiddleware();

        // Configure request processing middleware
        this.configureRequestProcessingMiddleware();

        // Warm up cache if enabled
        if (this.optimizationConfig.cacheWarming) {
            await this.warmCache();
        }

        this.initialized = true;
        logger.debug("middleware", " Middleware Manager initialized");
    }

    /**
     * Register custom middleware
     */
    public register(
        middleware: CustomMiddleware | RequestHandler,
        options?: {
            name?: string;
            priority?: MiddlewarePriority;
            routes?: string[];
            cacheable?: boolean;
            ttl?: number;
        }
    ): string {
        const id = NehoID.generate({ prefix: "ufs.middleware", size: 16 });
        const name = options?.name || `middleware-${id.slice(0, 8)}`;

        let handler: RequestHandler;
        let priority: MiddlewarePriority = options?.priority || "normal";
        let routes = options?.routes;
        let cacheable = options?.cacheable === true; // Only cache if explicitly set to true
        let ttl = options?.ttl || this.optimizationConfig.defaultTTL;

        if (typeof middleware === "function") {
            handler = middleware;
        } else {
            handler = middleware.handler;
            priority = middleware.priority || priority;
            routes = middleware.routes || routes;
            cacheable = middleware.cacheable || cacheable;
            ttl = middleware.ttl || ttl;
        }

        const entry: MiddlewareRegistryEntry = {
            id,
            name,
            handler: this.wrapMiddleware(handler, name),
            priority,
            order: this.calculateOrder(priority),
            routes,
            enabled: true,
            cacheable,
            ttl,
            metadata: {},
            stats: {
                executionCount: 0,
                totalExecutionTime: 0,
                averageExecutionTime: 0,
                cacheHits: 0,
                cacheMisses: 0,
                errors: 0,
            },
        };

        this.middlewareRegistry.set(id, entry);
        this.updateExecutionOrder();

        // Apply middleware to Express app immediately
        this.applyMiddlewareToApp(entry);

        logger.debug("middleware", `Registered middleware: ${name} (${id})`);
        return id;
    }

    /**
     * Unregister middleware
     */
    public unregister(id: string): boolean {
        const entry = this.middlewareRegistry.get(id);
        if (!entry) return false;

        this.middlewareRegistry.delete(id);
        this.updateExecutionOrder();

        logger.debug(
            "middleware",
            `Unregistered middleware: ${entry.name} (${id})`
        );
        return true;
    }

    /**
     * Enable middleware
     */
    public enable(id: string): boolean {
        const entry = this.middlewareRegistry.get(id);
        if (!entry) return false;

        entry.enabled = true;
        this.updateExecutionOrder();

        logger.debug("middleware", `Enabled middleware: ${entry.name} (${id})`);
        return true;
    }

    /**
     * Disable middleware
     */
    public disable(id: string): boolean {
        const entry = this.middlewareRegistry.get(id);
        if (!entry) return false;

        entry.enabled = false;
        this.updateExecutionOrder();

        logger.debug(
            "middleware",
            `Disabled middleware: ${entry.name} (${id})`
        );
        return true;
    }

    /**
     * Enable security middleware
     */
    public enableSecurity(options?: any): void {
        if (this.options.security?.helmet !== false) {
            try {
                this.dependencies.app.use(helmet(options?.helmet));
                logger.debug("middleware", "Security headers (Helmet) enabled");
            } catch (error) {
                logger.warn(
                    "middleware",
                    "Helmet not available, skipping security headers"
                );
            }
        }

        if (this.options.security?.cors !== false) {
            try {
                this.dependencies.app.use(cors(options?.cors));
                logger.debug("middleware", "CORS enabled");
            } catch (error) {
                logger.warn(
                    "middleware",
                    "CORS not available, skipping CORS headers"
                );
            }
        }
    }

    /**
     * Enable compression middleware
     */
    public enableCompression(options?: any): void {
        if (this.options.performance?.compression !== false) {
            try {
                this.dependencies.app.use(compression(options));
                logger.debug("middleware", "Compression enabled");
            } catch (error) {
                logger.warn(
                    "middleware",
                    "Compression not available, skipping compression"
                );
            }
        }
    }

    /**
     * Enable rate limiting middleware
     */
    public enableRateLimit(options?: any): void {
        if (this.options.security?.rateLimit !== false) {
            try {
                const rateLimitOptions = {
                    windowMs: 15 * 60 * 1000, // 15 minutes
                    max: 100, // limit each IP to 100 requests per windowMs
                    standardHeaders: true,
                    legacyHeaders: false,
                    ...options,
                };
                this.dependencies.app.use(rateLimit(rateLimitOptions));
                logger.debug("middleware", "Rate limiting enabled");
            } catch (error) {
                logger.warn(
                    "middleware",
                    "Rate limiting not available, skipping rate limiting"
                );
            }
        }
    }

    /**
     * Apply immediate middleware configuration during server initialization
     * This method provides basic middleware functionality before the full system is initialized
     */
    public applyImmediateMiddleware(config: MiddlewareConfiguration): void {
        // console.log("Applying immediate middleware configuration...");
        logger.debug(
            "middleware",
            "Applying immediate middleware configuration..."
        );
        // console.log("conf: ", config);

        // Apply rate limiting if configured
        if (config?.rateLimit && config.rateLimit !== true) {
            try {
                const rateLimitConfig = config.rateLimit;
                const limiter = rateLimit({
                    windowMs: rateLimitConfig.windowMs || 15 * 60 * 1000,
                    max: rateLimitConfig.max || 100,
                    message:
                        "Too many requests from this IP, please try again later (msg2).",
                    standardHeaders: true,
                    legacyHeaders: false,
                });
                this.dependencies.app.use(limiter);
                logger.debug("middleware", "Rate limiting applied immediately");
            } catch (error) {
                logger.warn(
                    "middleware",
                    "Failed to apply rate limiting:",
                    error
                );
            }
        }

        // Apply CORS if configured
        if (config?.cors && config.cors !== true) {
            try {
                const corsConfig = config.cors;
                const corsOptions = {
                    origin: (corsConfig.origin as string) || "*",
                    methods: corsConfig.methods || [
                        "GET",
                        "POST",
                        "PUT",
                        "DELETE",
                        "OPTIONS",
                    ],
                    allowedHeaders: corsConfig.allowedHeaders || [
                        "Origin",
                        "X-Requested-With",
                        "Content-Type",
                        "Accept",
                        "Authorization",
                    ],
                    credentials: corsConfig.credentials !== false,
                };
                this.dependencies.app.use(cors(corsOptions));
                logger.debug("middleware", "CORS applied immediately");
            } catch (error) {
                logger.warn("middleware", "Failed to apply CORS:", error);
            }
        }

        // Apply security headers if configured
        if (config?.security && config.security !== true) {
            try {
                this.dependencies.app.use(helmet());
                logger.debug(
                    "middleware",
                    "Helmet security headers applied immediately"
                );
            } catch (error) {
                logger.warn("middleware", "Failed to apply helmet:", error);
            }
        }

        // Apply compression if configured
        if (config?.compression && config.compression !== true) {
            try {
                this.dependencies.app.use(compression());
                logger.debug("middleware", "Compression applied immediately");
            } catch (error) {
                logger.warn(
                    "middleware",
                    "Failed to apply compression:",
                    error
                );
            }
        }

        logger.debug(
            "middleware",
            "Immediate middleware configuration completed"
        );
    }

    /**
     * Enable CORS middleware
     */
    public enableCors(options?: any): void {
        try {
            // Transform XyPrissJS CORS config to standard cors package config
            const corsConfig = this.transformCorsConfig(options);
            this.dependencies.app.use(cors(corsConfig));
            logger.debug("middleware", "CORS enabled with config:", corsConfig);
        } catch (error) {
            logger.warn(
                "middleware",
                "CORS not available, skipping CORS headers"
            );
        }
    }

    /**
     * Transform XyPrissJS CORS configuration to standard cors package configuration
     */
    private transformCorsConfig(XyPrissConfig?: any): any {
        if (!XyPrissConfig) return {};

        const corsConfig: any = {};

        // Map XyPrissJS config to standard cors config
        if (XyPrissConfig.origin !== undefined) {
            corsConfig.origin = XyPrissConfig.origin;
        }

        if (XyPrissConfig.methods !== undefined) {
            corsConfig.methods = XyPrissConfig.methods;
        }

        if (XyPrissConfig.allowedHeaders !== undefined) {
            corsConfig.allowedHeaders = XyPrissConfig.allowedHeaders;
        }

        if (XyPrissConfig.credentials !== undefined) {
            corsConfig.credentials = XyPrissConfig.credentials;
        }

        if (XyPrissConfig.maxAge !== undefined) {
            corsConfig.maxAge = XyPrissConfig.maxAge;
        }

        if (XyPrissConfig.preflightContinue !== undefined) {
            corsConfig.preflightContinue = XyPrissConfig.preflightContinue;
        }

        if (XyPrissConfig.optionsSuccessStatus !== undefined) {
            corsConfig.optionsSuccessStatus =
                XyPrissConfig.optionsSuccessStatus;
        }

        // Don't pass the 'enabled' property to cors package
        // Remove any other XyPrissJS-specific properties

        return corsConfig;
    }

    /**
     * Get middleware information
     */
    public getInfo(id?: string): MiddlewareInfo | MiddlewareInfo[] {
        if (id) {
            const entry = this.middlewareRegistry.get(id);
            if (!entry) throw new Error(`Middleware not found: ${id}`);
            return this.entryToInfo(entry);
        }

        return Array.from(this.middlewareRegistry.values()).map((entry) =>
            this.entryToInfo(entry)
        );
    }

    /**
     * Get middleware statistics
     */
    public getStats(): MiddlewareStats {
        const entries = Array.from(this.middlewareRegistry.values());
        const enabledCount = entries.filter((e) => e.enabled).length;

        const byPriority = entries.reduce((acc, entry) => {
            acc[entry.priority] = (acc[entry.priority] || 0) + 1;
            return acc;
        }, {} as Record<MiddlewarePriority, number>);

        const byType = entries.reduce((acc, entry) => {
            acc[entry.name] = this.entryToInfo(entry);
            return acc;
        }, {} as Record<string, MiddlewareInfo>);

        return {
            totalMiddleware: entries.length,
            enabledMiddleware: enabledCount,
            totalExecutions: this.performanceMetrics.totalRequests,
            averageExecutionTime: this.performanceMetrics.averageExecutionTime,
            cacheHitRate: this.performanceMetrics.cacheHitRate,
            optimizationRate: this.performanceMetrics.optimizationGain,
            byPriority,
            byType,
            performance: {
                fastestMiddleware: this.findFastestMiddleware(),
                slowestMiddleware: this.findSlowestMiddleware(),
                mostUsedMiddleware: this.findMostUsedMiddleware(),
                cacheEfficiency: this.calculateCacheEfficiency(),
            },
        };
    }

    /**
     * Get performance metrics
     */
    public getPerformanceMetrics(): MiddlewarePerformanceMetrics {
        return { ...this.performanceMetrics };
    }

    /**
     * Optimize middleware execution
     */
    public async optimize(): Promise<void> {
        logger.debug("middleware", "Optimizing middleware execution...");

        // Reorder middleware based on performance data
        this.optimizeExecutionOrder();

        // Clean up cache
        this.cleanupCache();

        // Update optimization metrics
        this.updateOptimizationMetrics();

        logger.debug("middleware", "Middleware optimization completed");
    }

    /**
     * Warm up middleware cache
     */
    public async warmCache(): Promise<void> {
        logger.debug("middleware", "Warming up middleware cache...");

        // Pre-cache common middleware results
        const commonPaths = ["/health", "/ping", "/status"];
        const commonMethods = ["GET", "POST"];

        for (const path of commonPaths) {
            for (const method of commonMethods) {
                const cacheKey = `${method}:${path}`;
                // Pre-populate cache with empty results for faster lookup
                this.middlewareCache.set(cacheKey, {
                    result: null,
                    timestamp: Date.now(),
                    ttl: this.optimizationConfig.defaultTTL,
                    hits: 0,
                    middleware: "warmup",
                });
            }
        }

        logger.debug("middleware", "Middleware cache warmed up");
    }

    /**
     * Clear middleware cache
     */
    public clearCache(): void {
        this.middlewareCache.clear();
        logger.debug("middleware", "Middleware cache cleared");
    }

    /**
     * Execute middleware chain
     */
    public async executeMiddleware(
        req: any,
        res: any,
        next: NextFunction
    ): Promise<void> {
        const startTime = performance.now();

        try {
            // Get applicable middleware for this request
            const applicableMiddleware = this.matchRoute(req.path, req.method);

            // Execute middleware in priority order
            for (const entry of applicableMiddleware) {
                if (!entry.enabled) continue;

                const middlewareStartTime = performance.now();

                try {
                    await this.executeMiddlewareEntry(entry, req, res, next);

                    const executionTime =
                        performance.now() - middlewareStartTime;
                    this.updateMiddlewareStats(entry, executionTime, false);
                } catch (error) {
                    const executionTime =
                        performance.now() - middlewareStartTime;
                    this.updateMiddlewareStats(entry, executionTime, true);
                    throw error;
                }
            }

            const totalExecutionTime = performance.now() - startTime;
            this.updatePerformanceMetrics(totalExecutionTime, false);
        } catch (error) {
            const totalExecutionTime = performance.now() - startTime;
            this.updatePerformanceMetrics(totalExecutionTime, true);
            throw error;
        }
    }

    /**
     * Match middleware to route
     */
    public matchRoute(path: string, method: string): MiddlewareRegistryEntry[] {
        return this.executionOrder
            .map((id) => this.middlewareRegistry.get(id))
            .filter((entry): entry is MiddlewareRegistryEntry => {
                if (!entry || !entry.enabled) return false;

                // If no routes specified, apply to all routes
                if (!entry.routes || entry.routes.length === 0) return true;

                // Check if path matches any of the specified routes
                return entry.routes.some((route) => {
                    if (typeof route === "string") {
                        return path === route || path.startsWith(route);
                    }
                    return false;
                });
            });
    }

    /**
     * Configure middleware
     */
    public configure(config: MiddlewareConfiguration): void {
        this.options.middleware = { ...this.options.middleware, ...config };

        // Apply configuration changes
        if (config.enableOptimization !== undefined) {
            this.optimizationConfig.enableCaching = config.enableOptimization;
        }

        if (config.enableCaching !== undefined) {
            this.optimizationConfig.enableCaching = config.enableCaching;
        }

        if (config.enablePerformanceTracking !== undefined) {
            this.optimizationConfig.enablePerformanceTracking =
                config.enablePerformanceTracking;
        }

        logger.debug("middleware", "Middleware configuration updated");
    }

    /**
     * Get current configuration
     */
    public getConfiguration(): MiddlewareConfiguration {
        return { ...this.options.middleware };
    }

    /**
     * Clear all middleware
     */
    public clear(): void {
        this.middlewareRegistry.clear();
        this.middlewareCache.clear();
        this.executionOrder = [];
        logger.debug("middleware", "All middleware cleared");
    }

    /**
     * Create cache middleware for route optimization
     */
    public createCacheMiddleware(options?: {
        ttl?: number;
        keyGenerator?: (req: any) => string;
    }): RequestHandler {
        const ttl = options?.ttl || this.optimizationConfig.defaultTTL;
        const keyGenerator =
            options?.keyGenerator ||
            ((req: any) => `${req.method}:${req.path}`);

        return (req: any, res: any, next: NextFunction) => {
            const cacheKey = keyGenerator(req);
            const cached = this.middlewareCache.get(cacheKey);

            if (cached && this.isCacheValid(cached)) {
                cached.hits++;
                logger.debug("middleware", `Cache hit for route: ${cacheKey}`);
                return next();
            }

            // Cache miss - continue with normal processing
            const originalSend = res.send;
            const self = this;
            res.send = function (body: any) {
                // Cache the response
                self.middlewareCache.set(cacheKey, {
                    result: body,
                    timestamp: Date.now(),
                    ttl,
                    hits: 0,
                    middleware: "route-cache",
                });
                return originalSend.call(this, body);
            };

            next();
        };
    }

    /**
     * Shutdown middleware manager
     */
    public async shutdown(): Promise<void> {
        logger.debug("middleware", "Shutting down  Middleware Manager...");

        this.middlewareRegistry.clear();
        this.middlewareCache.clear();
        this.executionOrder = [];
        this.initialized = false;

        logger.debug("middleware", " Middleware Manager shut down");
    }

    // ===== PRIVATE METHODS =====

    /**
     * Apply middleware to Express app
     */
    private applyMiddlewareToApp(entry: MiddlewareRegistryEntry): void {
        if (!entry.enabled) return;

        // If routes are specified, apply middleware only to those routes
        if (entry.routes && entry.routes.length > 0) {
            entry.routes.forEach((route) => {
                this.dependencies.app.use(route, entry.handler);
                logger.debug(
                    "middleware",
                    `Applied middleware "${entry.name}" to route: ${route}`
                );
            });
        } else {
            // Apply to all routes
            this.dependencies.app.use(entry.handler);
            logger.debug(
                "middleware",
                `Applied middleware "${entry.name}" globally`
            );
        }
    }

    /**
     * Configure built-in middleware
     */
    private configureBuiltInMiddleware(): void {
        logger.debug("middleware", "Configuring built-in middleware...");

        this.configureTrustProxy();
        this.configureSecurityMiddleware();
        this.configurePerformanceMiddleware();
        this.configureBodyParsing();

        logger.debug("middleware", "Built-in middleware configured");
    }

    /**
     * Configure trust proxy settings
     */
    private configureTrustProxy(): void {
        if (this.options.server?.trustProxy) {
            this.dependencies.app.set("trust proxy", true);
        }
    }

    /**
     * Configure security middleware
     */
    private configureSecurityMiddleware(): void {
        if (this.options.security?.helmet) {
            this.enableSecurity();
        }
    }

    /**
     * Configure performance middleware
     */
    private configurePerformanceMiddleware(): void {
        if (this.options.performance?.compression) {
            this.enableCompression();
        }
    }

    /**
     * Configure body parsing middleware
     */
    private configureBodyParsing(): void {
        this.dependencies.app.use(
            express.json({
                limit: this.options.server?.jsonLimit,
            })
        );
        this.dependencies.app.use(
            express.urlencoded({
                extended: true,
                limit: this.options.server?.urlEncodedLimit,
            })
        );
    }

    /**
     * Configure optimization middleware
     */
    private configureOptimizationMiddleware(): void {
        // This will be handled by the existing MiddlewareManager for now
        // to maintain backward compatibility
    }

    /**
     * Configure request processing middleware
     */
    private configureRequestProcessingMiddleware(): void {
        this.dependencies.app.use(
            async (req: any, res: any, next: NextFunction) => {
                // Start performance measurement
                const requestId =
                    this.dependencies.performanceProfiler.startMeasurement(req);
                req.requestId = requestId;
                req.startTime = performance.now();

                try {
                    // Execute  middleware chain
                    await this.executeMiddleware(req, res, next);

                    // Classify request for optimal execution path
                    const classification =
                        this.dependencies.executionPredictor.classify(req);
                    this.dependencies.performanceProfiler.setRequestType(
                        requestId,
                        classification.type,
                        classification.executionPath
                    );

                    // Update optimization stats
                    this.dependencies.optimizationStats.totalRequests++;
                    if (classification.type === "ultra-fast") {
                        this.dependencies.optimizationStats.ultraFastRequests++;
                    } else if (classification.type === "fast") {
                        this.dependencies.optimizationStats.fastRequests++;
                    } else {
                        this.dependencies.optimizationStats.standardRequests++;
                    }

                    // Route to appropriate execution path
                    if (
                        classification.type === "ultra-fast" &&
                        this.dependencies.optimizationEnabled
                    ) {
                        return await this.dependencies.handleUltraFastPath(
                            req,
                            res,
                            next,
                            requestId,
                            classification
                        );
                    } else if (
                        classification.type === "fast" &&
                        this.dependencies.optimizationEnabled
                    ) {
                        return await this.dependencies.handleFastPath(
                            req,
                            res,
                            next,
                            requestId,
                            classification
                        );
                    } else {
                        return await this.dependencies.handleStandardPath(
                            req,
                            res,
                            next,
                            requestId,
                            classification
                        );
                    }
                } catch (optimizationError: any) {
                    // Graceful fallback to standard path on optimization failure
                    logger.warn(
                        "middleware",
                        `Optimization failed for ${req.method} ${req.path}:`,
                        optimizationError.message
                    );
                    this.dependencies.optimizationStats.optimizationFailures++;
                    return await this.dependencies.handleStandardPath(
                        req,
                        res,
                        next,
                        requestId,
                        {
                            type: "standard",
                            confidence: 1.0,
                            executionPath: "fallback",
                            cacheStrategy: "standard",
                            skipMiddleware: [],
                            reason: "Optimization failure fallback",
                            overhead: 0,
                        }
                    );
                }
            }
        );
    }

    /**
     * Wrap middleware with performance tracking and caching
     */
    private wrapMiddleware(
        handler: RequestHandler,
        name: string
    ): RequestHandler {
        return async (req: any, res: any, next: NextFunction) => {
            const startTime = performance.now();

            try {
                // Check cache if middleware is cacheable AND the specific middleware entry allows caching
                const cacheKey = this.generateCacheKey(req, name);
                const middlewareEntry = Array.from(
                    this.middlewareRegistry.values()
                ).find((entry) => entry.name === name);

                if (
                    this.optimizationConfig.enableCaching &&
                    middlewareEntry?.cacheable === true
                ) {
                    const cached = this.middlewareCache.get(cacheKey);
                    if (cached && this.isCacheValid(cached)) {
                        cached.hits++;
                        const executionTime = performance.now() - startTime;
                        logger.debug(
                            "middleware",
                            `Cache hit for ${name}: ${executionTime}ms`
                        );
                        return next();
                    }
                }

                // Execute middleware (Express middleware uses callbacks, not promises)
                handler(req, res, (error?: any) => {
                    const executionTime = performance.now() - startTime;

                    if (error) {
                        logger.error(
                            "middleware",
                            `Error in ${name}: ${error} (${executionTime}ms)`
                        );
                        return next(error);
                    }

                    // Cache result if applicable
                    if (
                        this.optimizationConfig.enableCaching &&
                        executionTime < 10
                    ) {
                        this.middlewareCache.set(cacheKey, {
                            result: null,
                            timestamp: Date.now(),
                            ttl: this.optimizationConfig.defaultTTL,
                            hits: 0,
                            middleware: name,
                        });
                    }

                    logger.debug(
                        "middleware",
                        `Executed ${name}: ${executionTime}ms`
                    );

                    next();
                });
            } catch (error) {
                const executionTime = performance.now() - startTime;
                logger.error(
                    "middleware",
                    `Error in ${name}: ${error} (${executionTime}ms)`
                );
                next(error);
            }
        };
    }

    /**
     * Calculate execution order based on priority
     */
    private calculateOrder(priority: MiddlewarePriority): number {
        const priorityOrder = {
            critical: 1000,
            high: 800,
            normal: 500,
            low: 200,
        };
        return priorityOrder[priority] + Math.random() * 100; // Add randomness for same priority
    }

    /**
     * Update execution order based on priority and performance
     */
    private updateExecutionOrder(): void {
        this.executionOrder = Array.from(this.middlewareRegistry.entries())
            .filter(([_, entry]) => entry.enabled)
            .sort(([_, a], [__, b]) => b.order - a.order)
            .map(([id, _]) => id);
    }

    /**
     * Execute a single middleware entry
     */
    private async executeMiddlewareEntry(
        entry: MiddlewareRegistryEntry,
        req: any,
        res: any,
        next: NextFunction
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                entry.handler(req, res, (error?: any) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Update middleware statistics
     */
    private updateMiddlewareStats(
        entry: MiddlewareRegistryEntry,
        executionTime: number,
        hasError: boolean
    ): void {
        entry.stats.executionCount++;
        entry.stats.totalExecutionTime += executionTime;
        entry.stats.averageExecutionTime =
            entry.stats.totalExecutionTime / entry.stats.executionCount;
        entry.stats.lastExecuted = new Date();

        if (hasError) {
            entry.stats.errors++;
        }
    }

    /**
     * Update performance metrics
     */
    private updatePerformanceMetrics(
        executionTime: number,
        hasError: boolean
    ): void {
        this.performanceMetrics.totalRequests++;
        this.performanceMetrics.totalExecutionTime += executionTime;
        this.performanceMetrics.averageExecutionTime =
            this.performanceMetrics.totalExecutionTime /
            this.performanceMetrics.totalRequests;

        if (executionTime < this.performanceMetrics.fastestExecution) {
            this.performanceMetrics.fastestExecution = executionTime;
        }

        if (executionTime > this.performanceMetrics.slowestExecution) {
            this.performanceMetrics.slowestExecution = executionTime;
        }

        if (hasError) {
            this.performanceMetrics.errorRate =
                (this.performanceMetrics.errorRate *
                    (this.performanceMetrics.totalRequests - 1) +
                    1) /
                this.performanceMetrics.totalRequests;
        }

        // Calculate cache hit rate
        const totalCacheAttempts = Array.from(
            this.middlewareCache.values()
        ).reduce((sum, entry) => sum + entry.hits, 0);
        this.performanceMetrics.cacheHitRate =
            totalCacheAttempts / this.performanceMetrics.totalRequests;

        // Calculate throughput (requests per second)
        const now = Date.now();
        this.performanceMetrics.throughput =
            this.performanceMetrics.totalRequests /
            ((now - (now - this.performanceMetrics.totalExecutionTime)) / 1000);
    }

    /**
     * Convert registry entry to middleware info
     */
    private entryToInfo(entry: MiddlewareRegistryEntry): MiddlewareInfo {
        return {
            name: entry.name,
            priority: entry.priority,
            enabled: entry.enabled,
            order: entry.order,
            routes: entry.routes,
            executionCount: entry.stats.executionCount,
            averageExecutionTime: entry.stats.averageExecutionTime,
            lastExecuted: entry.stats.lastExecuted,
            cacheEnabled: entry.cacheable,
            optimized: entry.stats.averageExecutionTime < 5, // Consider optimized if < 5ms
        };
    }

    /**
     * Generate cache key for middleware
     */
    private generateCacheKey(req: any, middlewareName: string): string {
        return `middleware:${middlewareName}:${req.method}:${req.path}`;
    }

    /**
     * Check if cache entry is valid
     */
    private isCacheValid(entry: MiddlewareCacheEntry): boolean {
        return Date.now() - entry.timestamp < entry.ttl;
    }

    /**
     * Optimize execution order based on performance data
     */
    private optimizeExecutionOrder(): void {
        // Sort by average execution time (fastest first) within same priority
        this.executionOrder = Array.from(this.middlewareRegistry.entries())
            .filter(([_, entry]) => entry.enabled)
            .sort(([_, a], [__, b]) => {
                // First by priority
                if (a.priority !== b.priority) {
                    return b.order - a.order;
                }
                // Then by performance (faster first)
                return (
                    a.stats.averageExecutionTime - b.stats.averageExecutionTime
                );
            })
            .map(([id, _]) => id);
    }

    /**
     * Clean up expired cache entries
     */
    private cleanupCache(): void {
        const now = Date.now();
        for (const [key, entry] of this.middlewareCache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.middlewareCache.delete(key);
            }
        }

        // Limit cache size
        if (this.middlewareCache.size > this.optimizationConfig.maxCacheSize) {
            const entries = Array.from(this.middlewareCache.entries()).sort(
                ([_, a], [__, b]) => a.hits - b.hits
            ); // Remove least used first

            const toRemove =
                this.middlewareCache.size -
                this.optimizationConfig.maxCacheSize;
            for (let i = 0; i < toRemove; i++) {
                this.middlewareCache.delete(entries[i][0]);
            }
        }
    }

    /**
     * Update optimization metrics
     */
    private updateOptimizationMetrics(): void {
        const totalMiddleware = this.middlewareRegistry.size;
        const optimizedMiddleware = Array.from(
            this.middlewareRegistry.values()
        ).filter((entry) => entry.stats.averageExecutionTime < 5).length;

        this.performanceMetrics.optimizationGain =
            totalMiddleware > 0
                ? (optimizedMiddleware / totalMiddleware) * 100
                : 0;
    }

    /**
     * Find fastest middleware
     */
    private findFastestMiddleware(): string {
        let fastest = "";
        let fastestTime = Infinity;

        for (const entry of this.middlewareRegistry.values()) {
            if (entry.stats.averageExecutionTime < fastestTime) {
                fastestTime = entry.stats.averageExecutionTime;
                fastest = entry.name;
            }
        }

        return fastest;
    }

    /**
     * Find slowest middleware
     */
    private findSlowestMiddleware(): string {
        let slowest = "";
        let slowestTime = 0;

        for (const entry of this.middlewareRegistry.values()) {
            if (entry.stats.averageExecutionTime > slowestTime) {
                slowestTime = entry.stats.averageExecutionTime;
                slowest = entry.name;
            }
        }

        return slowest;
    }

    /**
     * Find most used middleware
     */
    private findMostUsedMiddleware(): string {
        let mostUsed = "";
        let mostUsedCount = 0;

        for (const entry of this.middlewareRegistry.values()) {
            if (entry.stats.executionCount > mostUsedCount) {
                mostUsedCount = entry.stats.executionCount;
                mostUsed = entry.name;
            }
        }

        return mostUsed;
    }

    /**
     * Calculate cache efficiency
     */
    private calculateCacheEfficiency(): number {
        const totalCacheAttempts = Array.from(
            this.middlewareCache.values()
        ).reduce((sum, entry) => sum + entry.hits, 0);
        const totalRequests = this.performanceMetrics.totalRequests;

        return totalRequests > 0
            ? (totalCacheAttempts / totalRequests) * 100
            : 0;
    }
}


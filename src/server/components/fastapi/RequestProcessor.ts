import { NextFunction } from "express";
import { PluginType } from "../../plugins/types/PluginTypes";
import { RequestProcessorDependencies } from "../../../types/components/ReqProcessor.type";
import { logger } from "../../../../shared/logger/Logger";

/**
 * RequestProcessor - Handles different execution paths for optimal performance
 * Manages ultra-fast, fast, and standard request processing paths
 */
export class RequestProcessor {
    protected readonly dependencies: RequestProcessorDependencies;

    constructor(dependencies: RequestProcessorDependencies) {
        this.dependencies = dependencies;
    }

    /**
     * Handle ultra-fast execution path (<1ms target)
     * Direct cache lookup, minimal middleware, optimized for static content
     */
    public async handleUltraFastPath(
        req: any,
        res: any,
        next: NextFunction,
        requestId: string,
        classification: any
    ): Promise<void> {
        try {
            // Check for pre-compiled route
            const compiledRoute =
                this.dependencies.requestPreCompiler.getOptimizedHandler(req);
            if (compiledRoute && compiledRoute.executionPath === "fast") {
                return await compiledRoute.compiledHandler(req, res);
            }

            // Direct cache lookup for ultra-fast responses
            const cacheKey =
                this.dependencies.cacheManager.generateUltraFastCacheKey(req);
            const cacheStart = performance.now();
            const cachedResponse = await this.dependencies.cacheManager
                .getCache()
                .get(cacheKey);
            const cacheTime = performance.now() - cacheStart;

            this.dependencies.performanceProfiler.markCacheOperation(
                requestId,
                !!cachedResponse,
                cachedResponse ? "L1" : "miss",
                cacheTime
            );

            if (cachedResponse) {
                // Ultra-fast cache hit - direct response
                res.set("X-Cache", "ULTRA-FAST-HIT");
                res.set("X-Cache-Time", `${cacheTime.toFixed(3)}ms`);
                res.set("X-Execution-Path", "ultra-fast");
                res.json(cachedResponse);

                // Complete measurement
                const metric =
                    this.dependencies.performanceProfiler.completeMeasurement(
                        requestId,
                        res
                    );
                if (metric) {
                    this.updateExecutionPredictorPattern(
                        req,
                        metric.totalTime,
                        true
                    );
                }
                return;
            }

            // Cache miss - fallback to fast path
            return await this.handleFastPath(req, res, next, requestId, {
                ...classification,
                type: "fast",
            });
        } catch (error: any) {
            logger.warn(
                "other",
                `Ultra-fast path failed for ${req.method} ${req.path}:`,
                error.message
            );
            return await this.handleStandardPath(
                req,
                res,
                next,
                requestId,
                classification
            );
        }
    }

    /**
     * Handle fast execution path (<5ms target)
     * Optimized middleware chain, parallel processing where safe
     */
    public async handleFastPath(
        req: any,
        res: any,
        next: NextFunction,
        requestId: string,
        classification: any
    ): Promise<void> {
        try {
            // Execute essential security checks only (parallel where possible)
            const securityPromises = [];

            // Only run critical security plugins for fast path
            if (!classification.skipMiddleware.includes("security")) {
                securityPromises.push(
                    this.dependencies.pluginEngine.executePlugins(
                        PluginType.SECURITY,
                        req,
                        res,
                        next
                    )
                );
            }

            // Run cache check in parallel with security
            const cachePromise = this.handleOptimizedCacheCheck(
                req,
                res,
                requestId
            );

            // Wait for parallel operations
            const [securitySuccess, cacheResult] = await Promise.all([
                securityPromises.length > 0
                    ? securityPromises[0]
                    : Promise.resolve(true),
                cachePromise,
            ]);

            if (!securitySuccess) {
                return res
                    .status(401)
                    .json({ error: "Security validation failed" });
            }

            if (cacheResult.hit) {
                // Fast cache hit
                res.set("X-Cache", "FAST-HIT");
                res.set("X-Cache-Time", `${cacheResult.time.toFixed(3)}ms`);
                res.set("X-Execution-Path", "fast");
                res.json(cacheResult.data);

                // Complete measurement
                const metric =
                    this.dependencies.performanceProfiler.completeMeasurement(
                        requestId,
                        res
                    );
                if (metric) {
                    this.updateExecutionPredictorPattern(
                        req,
                        metric.totalTime,
                        true
                    );
                }
                return;
            }

            // Cache miss - continue to handler with optimized middleware
            res.set("X-Cache", "FAST-MISS");
            res.set("X-Execution-Path", "fast");

            // Set up response caching for future requests
            this.setupResponseCaching(req, res, requestId, "fast");

            next();
        } catch (error: any) {
            logger.warn(
                "other",
                `Fast path failed for ${req.method} ${req.path}:`,
                error.message
            );
            return await this.handleStandardPath(
                req,
                res,
                next,
                requestId,
                classification
            );
        }
    }

    /**
     * Handle standard execution path (full feature set)
     * Complete middleware chain for complex requests
     */
    public async handleStandardPath(
        req: any,
        res: any,
        next: NextFunction,
        requestId: string,
        classification: any
    ): Promise<void> {
        try {
            // Execute full plugin chain for standard path
            const preRequestSuccess =
                await this.dependencies.pluginEngine.executePlugins(
                    PluginType.PRE_REQUEST,
                    req,
                    res,
                    next
                );
            if (!preRequestSuccess) {
                return; // Plugin stopped execution
            }

            const securitySuccess =
                await this.dependencies.pluginEngine.executePlugins(
                    PluginType.SECURITY,
                    req,
                    res,
                    next
                );
            if (!securitySuccess) {
                return res
                    .status(401)
                    .json({ error: "Security validation failed" });
            }

            await this.dependencies.pluginEngine.executePlugins(
                PluginType.CACHE,
                req,
                res,
                next
            );
            await this.dependencies.pluginEngine.executePlugins(
                PluginType.PERFORMANCE,
                req,
                res,
                next
            );

            // Set up response tracking
            res.set("X-Execution-Path", "standard");
            this.setupResponseCaching(req, res, requestId, "standard");

            // Set up post-response handling
            res.on("finish", async () => {
                const metric =
                    this.dependencies.performanceProfiler.completeMeasurement(
                        requestId,
                        res
                    );
                if (metric) {
                    this.updateExecutionPredictorPattern(
                        req,
                        metric.totalTime,
                        false
                    );
                }

                // Execute post-response plugins
                await this.dependencies.pluginEngine.executePlugins(
                    PluginType.POST_RESPONSE,
                    req,
                    res,
                    next
                );

                // Log performance metrics
                if (metric && metric.totalTime < 5) {
                    logger.debug(
                        "other",
                        `ULTRA-FAST: ${req.method} ${
                            req.path
                        } - ${metric.totalTime.toFixed(2)}ms`
                    );
                } else if (metric && metric.totalTime < 20) {
                    logger.debug(
                        "other",
                        `FAST: ${req.method} ${
                            req.path
                        } - ${metric.totalTime.toFixed(2)}ms`
                    );
                } else if (metric && metric.totalTime > 100) {
                    logger.debug(
                        "other",
                        `SLOW: ${req.method} ${
                            req.path
                        } - ${metric.totalTime.toFixed(2)}ms`
                    );
                }
            });

            next();
        } catch (error: any) {
            logger.error(
                "other",
                `Standard path failed for ${req.method} ${req.path}:`,
                error.message
            );
            next(error);
        }
    }

    /**
     * Handle optimized cache check for fast path
     */
    private async handleOptimizedCacheCheck(
        req: any,
        res: any,
        requestId: string
    ): Promise<{ hit: boolean; data?: any; time: number }> {
        const cacheStart = performance.now();
        const cacheKey = this.dependencies.cacheManager.generateCacheKey(req);
        const cachedData = await this.dependencies.cacheManager
            .getCache()
            .get(cacheKey);
        const cacheTime = performance.now() - cacheStart;

        this.dependencies.performanceProfiler.markCacheOperation(
            requestId,
            !!cachedData,
            cachedData ? "L2" : "miss",
            cacheTime
        );

        return {
            hit: !!cachedData,
            data: cachedData,
            time: cacheTime,
        };
    }

    /**
     * Set up response caching for future requests
     */
    private setupResponseCaching(
        req: any,
        res: any,
        requestId: string,
        pathType: string
    ): void {
        const originalJson = res.json.bind(res);
        res.json = (data: any) => {
            // Cache the response asynchronously based on path type
            setImmediate(async () => {
                try {
                    const ttl =
                        this.dependencies.cacheManager.getCacheTTLForPath(
                            pathType
                        );
                    const cacheKey =
                        pathType === "ultra-fast"
                            ? this.dependencies.cacheManager.generateUltraFastCacheKey(
                                  req
                              )
                            : this.dependencies.cacheManager.generateCacheKey(
                                  req
                              );

                    await this.dependencies.cacheManager
                        .getCache()
                        .set(cacheKey, data, { ttl });
                    logger.debug(
                        "other",
                        `CACHED (${pathType}): ${cacheKey} (TTL: ${ttl}ms)`
                    );
                } catch (error: any) {
                    logger.error("other", "Cache set error:", error.message);
                }
            });

            return originalJson(data);
        };
    }

    /**
     * Update execution predictor with actual performance data
     */
    private updateExecutionPredictorPattern(
        req: any,
        responseTime: number,
        cacheHit: boolean
    ): void {
        try {
            this.dependencies.executionPredictor.updatePattern(
                req,
                responseTime,
                cacheHit
            );
            this.dependencies.requestPreCompiler.analyzeRequest(
                req,
                null as any,
                () => {}
            );
        } catch (error: any) {
            logger.warn(
                "other",
                "Failed to update execution predictor:",
                error.message
            );
        }
    }
}


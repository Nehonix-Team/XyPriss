/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * AppModuleManager handles the robust implementation of various application
 * features that were previously stubbed or simplified in XyprissApp.
 ***************************************************************************/

import { Logger } from "../../../shared/logger/Logger";
import { RequestHandler } from "../../types/types";
import type { XyprissApp } from "./XyprissApp";
import { XyDiagnosticsManager } from "./XyDiagnosticsManager";
import { XyLifecycleManager } from "./XyLifecycleManager";
import { FileUploadManager } from "../components/fastapi/FileUploadManager";
import { RequestPreCompiler } from "../optimization/RequestPreCompiler";

/**
 * XyAppModuleManager - Manages and orchestrates robust implementations for application features.
 */
export class XyAppModuleManager {
    private app: XyprissApp;
    private logger: Logger;
    private diagnostics: XyDiagnosticsManager;
    private lifecycle: XyLifecycleManager;
    private fileUploadManager: FileUploadManager;
    private preCompiler: RequestPreCompiler | null = null;

    constructor(app: XyprissApp, logger: Logger) {
        this.app = app;
        this.logger = logger;
        this.diagnostics = new XyDiagnosticsManager(app, logger);
        this.lifecycle = new XyLifecycleManager(app, logger);
        this.fileUploadManager = new FileUploadManager(logger);
    }

    /**
     * Initializes all modules and injects robust implementations into the app.
     */
    public async initialize(): Promise<void> {
        this.injectCacheModule();
        this.lifecycle.initialize();
        this.diagnostics.initialize();
        await this.injectFileUploadModule();
        this.injectUtilityModules();
        this.injectSecurityModule();
    }

    /**
     * Injects robust cache management methods.
     */
    private injectCacheModule(): void {
        this.app.invalidateCache = async (pattern: string): Promise<void> => {
            const cache = this.app.getCache();
            if (!cache) return;

            try {
                let invalidatedCount = 0;
                if (pattern.includes("*") || pattern.includes("?")) {
                    const keys = await cache.keys(pattern);
                    for (const key of keys) {
                        if (await cache.delete(key)) {
                            invalidatedCount++;
                        }
                    }
                } else {
                    if (await cache.delete(pattern)) {
                        invalidatedCount = 1;
                    }
                }

                this.logger.debug(
                    "cache",
                    `Invalidated ${invalidatedCount} entries for pattern: ${pattern}`
                );
            } catch (error) {
                this.logger.error("cache", `Invalidation failed: ${error}`);
                throw error;
            }
        };

        this.app.getCacheStats = async (): Promise<any> => {
            const cache = this.app.getCache();
            if (!cache) return null;
            return await cache.getStats();
        };

        this.app.warmUpCache = async (data: any[]): Promise<void> => {
            const cache = this.app.getCache();
            if (!cache || !data || !data.length) return;

            this.logger.debug("cache", `Warming up ${data.length} entries`);
            await Promise.all(
                data.map((entry) =>
                    cache.set(entry.key, entry.value, { ttl: entry.ttl })
                )
            );
        };
    }

    /**
     * Injects real file upload implementation.
     */
    private async injectFileUploadModule(): Promise<void> {
        try {
            await this.fileUploadManager.initialize();

            this.app.uploadSingle = (fieldname) => {
                return this.fileUploadManager.single(fieldname);
            };

            this.app.uploadArray = (fieldname, maxCount) => {
                return this.fileUploadManager.array(fieldname, maxCount);
            };

            this.app.uploadFields = (fields) => {
                return this.fileUploadManager.fields(fields);
            };

            this.app.uploadAny = () => {
                return this.fileUploadManager.any();
            };

            this.logger.debug(
                "server",
                "Real FileUploadManager injected into app"
            );
        } catch (error: any) {
            this.logger.warn(
                "server",
                `Failed to initialize FileUploadManager: ${error.message}. Using dummy middleware.`
            );

            const dummyMiddleware = (): RequestHandler => (req, res, next) =>
                next && next();

            this.app.uploadSingle = () => dummyMiddleware();
            this.app.uploadArray = () => dummyMiddleware();
            this.app.uploadFields = () => dummyMiddleware();
            this.app.uploadAny = () => dummyMiddleware();
        }
    }

    /**
     * Injects security management methods.
     */
    private injectSecurityModule(): void {
        this.app.enableCors = (options?: any) => {
            (this.app as any).middleware().cors(options);
            return this.app;
        };

        this.app.enableCompression = (options?: any) => {
            (this.app as any).middleware().compression(options);
            return this.app;
        };

        this.app.enableRateLimit = (options?: any) => {
            (this.app as any).middleware().rateLimit(options);
            return this.app;
        };
    }

    /**
     * Injects utility methods for performance and module management.
     */
    private injectUtilityModules(): void {
        const cache = this.app.getCache();
        if (cache) {
            this.preCompiler = new RequestPreCompiler(cache, {
                enabled:
                    this.app.configs?.performance?.preCompilerEnabled !== false,
            });

            this.app.getRequestPreCompiler = () => this.preCompiler;
        } else {
            this.app.getRequestPreCompiler = () => ({
                compile: (routes: any[]) => routes,
                isEnabled: () => false,
                getStats: () => ({
                    patternsLearned: 0,
                    routesCompiled: 0,
                    optimizationRate: 0,
                    customGenerators: 0,
                    responseTemplates: 0,
                    totalRequests: 0,
                    optimizedRequests: 0,
                    avgOptimizationGain: 0,
                    compilationTime: 0,
                }),
            });
        }
    }
}


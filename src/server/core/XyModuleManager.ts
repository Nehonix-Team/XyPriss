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

/**
 * XyAppModuleManager - Manages and orchestrates robust implementations for application features.
 */
export class XyAppModuleManager {
    private app: XyprissApp;
    private logger: Logger;
    private diagnostics: XyDiagnosticsManager;
    private lifecycle: XyLifecycleManager;

    constructor(app: XyprissApp, logger: Logger) {
        this.app = app;
        this.logger = logger;
        this.diagnostics = new XyDiagnosticsManager(app, logger);
        this.lifecycle = new XyLifecycleManager(app, logger);
    }

    /**
     * Initializes all modules and injects robust implementations into the app.
     */
    public initialize(): void {
        this.injectCacheModule();
        this.lifecycle.initialize();
        this.diagnostics.initialize();
        this.injectFileUploadModule();
        this.injectUtilityModules();
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
     * Injects file upload stubs that will be replaced by real implementations when available.
     */
    private injectFileUploadModule(): void {
        const dummyMiddleware = (): RequestHandler => (req, res, next) =>
            next && next();

        this.app.uploadSingle = (fieldname) => {
            return dummyMiddleware();
        };

        this.app.uploadArray = (fieldname) => {
            return dummyMiddleware();
        };

        this.app.uploadFields = (fields) => {
            return dummyMiddleware();
        };

        this.app.uploadAny = () => {
            return dummyMiddleware();
        };
    }

    /**
     * Injects utility methods for performance and module management.
     */
    private injectUtilityModules(): void {
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


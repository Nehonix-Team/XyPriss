/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */

import { FileUploadAPI } from "./server/components/fastapi/upload/file-upload";
import { XyPrissRouter } from "./server/routing";
import { configLoader } from "./server/utils/ConfigLoader";

// Initialize globals by importing them
import { __sys__ } from "./sys";
//tmp====
export { XyPrissSys } from "./sys";
import { __cfg__ } from "./config";
import { __const__ } from "./const";
export type {
    ProcessInfo,
    NetworkStats,
    MonitorSnapshot,
    ProcessMonitorSnapshot,
    ArchiveOptions,
    BatchRenameChange,
} from "./sys/types";

// Load and apply system configuration from xypriss.config.json
if (typeof globalThis !== "undefined") {
    configLoader.loadAndApplySysConfig();
}

// Re-export for convenience
export { __sys__, __cfg__, __const__ };

/**
 * XyPriss Powerhouse
 * High-performance engine with Redis caching, smart optimization, and military-grade security
 *
 * @author Nehonix team
 */

export * from "./server/ServerFactory";
export { createOptimalCache } from "./cache/CacheFactory";
export { SecurityMiddleware } from "./middleware/security-middleware";
export { PerformanceMonitor } from "./server/optimization/performance-monitor";

// File upload API
export * from "./server/components/fastapi/upload/file-upload";

// Configuration API
export * from "./config";

// XJson Response Handler
export { XJsonResponseHandler } from "./middleware/XJsonResponseHandler";

export { Plugin } from "./plugins/api/PluginAPI";
export type { XyPrissPlugin, PluginCreator } from "./plugins/types/PluginTypes";

// Types
import type {
    RouteConfig,
    CacheConfig,
    SecurityConfig,
    PerformanceConfig,
    ServerOptions as IServerOptions,
} from "./types/types";

export type {
    RouteConfig,
    CacheConfig,
    SecurityConfig,
    PerformanceConfig,
    IServerOptions as ServerOptions,
};

declare global {
    /**
     * @fileoverview Comprehensive server options interface for XyPriss integration
     *
     * This interface provides complete configuration options for creating ultra-fast,
     * secure servers with advanced features including caching, clustering,
     * performance optimization, and Go integration.
     *
     * @interface ServerOptions
     * @version 4.5.11
     * @author XyPrissJS Team
     * @since 2025-01-06
     *
     * @example
     * ```typescript
     * import { createServer, ServerOptions } from 'xypriss';
     *
     * const serverOptions: ServerOptions = {
     *   env: 'production',
     *   cache: {
     *     strategy: 'hybrid',
     *     maxSize: 1024 * 1024 * 100, // 100MB
     *     ttl: 3600,
     *     enabled: true,
     *     enableCompression: true
     *   },
     *   security: {
     *     encryption: true,
     *     cors: true,
     *     helmet: true
     *   },
     *   performance: {
     *     optimizationEnabled: true,
     *     aggressiveCaching: true,
     *     parallelProcessing: true
     *   },
     *   server: {
     *     port: 3000,
     *     host: '0.0.0.0',
     *     autoPortSwitch: {
     *       enabled: true,
     *       maxAttempts: 5
     *     }
     *   }
     * };
     *
     * const app = createServer(serverOptions);
     * ```
     */
    type ServerOptions = IServerOptions;
}

// Quick start exports for immediate use
export * from "./quick-start";

/**
 * Default router instance for quick start
 */
export function Router() {
    return new XyPrissRouter({
        caseSensitive: false,
        mergeParams: false,
        strict: false,
    });
}
export { XyPrissRouter } from "./server/routing";

export type {
    XyPrisResponse,
    XyPrisRequest,
    RichRouteOptions,
    RouteGuard,
    RouteGroupOptions,
    RouteMeta,
    RouteLifecycle,
    RouteCache,
    RoutRateLimit,
} from "./server/routing";

export { FileUploadAPI as FLA };

export { TrustProxy } from "./server/utils/trustProxy";

export type { TrustProxyValue } from "./types/trustProxy";

export { PluginHookIds } from "./plugins/const/PluginHookIds";

export { mergeWithDefaults } from "./utils/mergeWithDefaults";
export { mergeWithDefaults as mwdef } from "./utils/mergeWithDefaults";
export * from "./utils/getIp";

// XEMS — XyPriss Encrypted Memory Store
// Exposes the singleton instance and the runner class for direct low-level access.
export { xems } from "./plugins/modules/xems/XemsPlugin"; // "XemsRunner" only for internal use
export type { XemsTypes } from "./types/xems.type";

export { getMime, getMimes } from "./utils/getMime";


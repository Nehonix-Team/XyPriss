/***************************************************************************
 * XyPrissJS - Advanced JavaScript Security Library
 *
 * @author Nehonix
 * @license MIT
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ***************************************************************************** */

import { FileUploadAPI } from "./file-upload";
import { XyPrissRouter } from "./server/routing";

/**
 * XyPrissJS Express Powerhouse
 * Express utility with Redis caching, smart optimization, and military-grade security
 *
 * @author Nehonix team
 */

export * from "./server/ServerFactory";
export * from "./server/components/fastapi/smart-routes";
export { createOptimalCache } from "./cache/CacheFactory";
export { SecurityMiddleware } from "./middleware/security-middleware";
export { PerformanceMonitor } from "./server/optimization/performance-monitor";

// File upload API
export * from "./file-upload";

// Plugin system
export * from "./plugins/modules";

// Types
export type {
    // ServerConfig, // Removed - no longer needed
    RouteConfig,
    CacheConfig,
    SecurityConfig,
    PerformanceConfig,
} from "./types/types";

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
    Request as XyPrissRequest,
    Response as XyPrissResponse,
    NextFunction,
} from "./types/types";

export { FileUploadAPI as FLA };


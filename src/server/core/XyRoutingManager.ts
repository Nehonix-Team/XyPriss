/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * @author Nehonix
 * @license NOSL
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************/

import { Logger } from "../../../shared/logger/Logger";
import { XyPrissRouter } from "../routing/Router";
import type { XyprissApp } from "./XyprissApp";

/**
 * XyRoutingManager - Handles complex routing logic for XyprissApp.
 * Extracted from XyprissApp.ts to improve modularity and maintainability.
 */
export class XyRoutingManager {
    private app: XyprissApp;
    private logger: Logger;

    constructor(app: XyprissApp, logger: Logger) {
        this.app = app;
        this.logger = logger;
    }

    /**
     * Mount a router at a specific path.
     */
    public mountRouter(basePath: string, router: XyPrissRouter): void {
        const routes = router.getRoutes();
        const middleware = router.getMiddleware();
        const httpServer = this.app.getHttpServer();

        this.logger.debug(
            "server",
            `Mounting router at ${basePath} with ${routes.length} routes`
        );

        // Register router middleware first
        middleware.forEach((mw) => {
            httpServer.use(mw);
        });

        // Register all routes from the router
        routes.forEach((route) => {
            const fullPath = this.joinPaths(basePath, route.path);
            let routePath: string | RegExp = fullPath;

            if (route.pattern && basePath !== "/") {
                // Create a new pattern that includes the base path
                const originalPattern = route.pattern.source;
                const flags = route.pattern.flags;

                // Remove the ^ and $ anchors from the original pattern
                const cleanPattern = originalPattern
                    .replace(/^\^/, "")
                    .replace(/\$$/, "");

                // Create new pattern with base path
                const basePathEscaped = basePath.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                );
                const newPatternSource = `^${basePathEscaped}${cleanPattern}$`;

                routePath = new RegExp(newPatternSource, flags);

                this.logger.debug(
                    "server",
                    `Registering route: ${route.method} ${fullPath} (compiled pattern with base path)`
                );
            } else if (route.pattern) {
                // Use the original pattern if no base path
                routePath = route.pattern;
            }

            // Register the route using the appropriate HTTP method
            const allHandlers = [...route.middleware, route.handler];

            // For RegExp routes, we need to manually add the route with parameter names
            if (routePath instanceof RegExp && route.paramNames) {
                httpServer.addRouteWithParams(
                    route.method.toUpperCase(),
                    routePath,
                    route.paramNames,
                    allHandlers
                );
            } else {
                // Use standard HTTP method registration
                const method = route.method.toUpperCase();
                switch (method) {
                    case "GET":
                        httpServer.get(routePath, ...allHandlers);
                        break;
                    case "POST":
                        httpServer.post(routePath, ...allHandlers);
                        break;
                    case "PUT":
                        httpServer.put(routePath, ...allHandlers);
                        break;
                    case "DELETE":
                        httpServer.delete(routePath, ...allHandlers);
                        break;
                    case "PATCH":
                        httpServer.patch(routePath, ...allHandlers);
                        break;
                    case "OPTIONS":
                        httpServer.options(routePath, ...allHandlers);
                        break;
                    case "HEAD":
                        httpServer.head(routePath, ...allHandlers);
                        break;
                    case "CONNECT":
                        httpServer.connect?.(routePath, ...allHandlers);
                        break;
                    case "TRACE":
                        httpServer.trace?.(routePath, ...allHandlers);
                        break;
                    default:
                        this.logger.warn(
                            "server",
                            `Unsupported HTTP method: ${method}`
                        );
                }
            }

            this.logger.debug(
                "server",
                `Mounted route: ${route.method} ${fullPath}`
            );

            // For root routes, also register the base path without trailing slash
            if (route.path === "/") {
                this.registerAltRootRoute(
                    basePath,
                    route,
                    routePath,
                    allHandlers
                );
            }
        });
    }

    /**
     * Registers an alternative root route without the trailing slash.
     */
    private registerAltRootRoute(
        basePath: string,
        route: any,
        routePath: any,
        handlers: any[]
    ): void {
        const httpServer = this.app.getHttpServer();
        const altPath = basePath.replace(/\/$/, "");
        if (altPath === "") return;

        let altRoutePath: string | RegExp = altPath;

        if (routePath instanceof RegExp && route.pattern) {
            const flags = route.pattern.flags;
            const basePathEscaped = altPath.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );
            const newPatternSource = `^${basePathEscaped}/?$`;
            altRoutePath = new RegExp(newPatternSource, flags);
        }

        const method = route.method.toUpperCase();
        switch (method) {
            case "GET":
                httpServer.get(altRoutePath, ...handlers);
                break;
            case "POST":
                httpServer.post(altRoutePath, ...handlers);
                break;
            case "PUT":
                httpServer.put(altRoutePath, ...handlers);
                break;
            case "DELETE":
                httpServer.delete(altRoutePath, ...handlers);
                break;
            case "PATCH":
                httpServer.patch(altRoutePath, ...handlers);
                break;
            case "OPTIONS":
                httpServer.options(altRoutePath, ...handlers);
                break;
            case "HEAD":
                httpServer.head(altRoutePath, ...handlers);
                break;
            default:
                break;
        }

        this.logger.debug(
            "server",
            `Mounted alt route: ${route.method} ${altPath}`
        );
    }

    /**
     * Join two paths correctly.
     */
    public joinPaths(basePath: string, subPath: string): string {
        const normalizedBase = this.normalizePath(basePath);
        const normalizedSub = this.normalizePath(subPath);

        if (normalizedSub === "/") return normalizedBase;
        if (normalizedBase === "/") return normalizedSub;

        return normalizedBase + normalizedSub;
    }

    /**
     * Normalize path.
     */
    public normalizePath(path: string): string {
        if (!path || typeof path !== "string") {
            throw new Error("Path must be a non-empty string");
        }

        let normalized = path.trim();
        if (!normalized.startsWith("/")) normalized = "/" + normalized;
        if (normalized.length > 1) normalized = normalized.replace(/\/+$/, "");
        normalized = normalized.replace(/\/+/g, "/");

        return normalized || "/";
    }
}


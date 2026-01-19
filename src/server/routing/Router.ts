/**
 * XyPriss Router System
 * Express-like router for modular route organization
 */

import { RouteHandler, MiddlewareFunction } from "../../types/httpServer.type";
import { Logger } from "../../../shared/logger/Logger";
import {
    RouteDefinition,
    RouteMatch,
    RouterOptions,
    MiddlewareEntry,
} from "../../types/XyPrissRouter.types";

export class XyPrissRouter {
    private routes: RouteDefinition[] = [];
    private middleware: MiddlewareEntry[] = [];
    private logger: Logger;
    private routerOptions: RouterOptions;

    // Regex patterns for optimization
    private static readonly PATH_PATTERNS = {
        leadingSlash: /^\/+/,
        trailingSlash: /\/+$/,
        multipleSlashes: /\/+/g,
        paramPattern: /:([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
        wildcardPattern: /\*+$/, // Support both * and ** wildcards
        pathValidation:
            /^\/(?:[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]|%[0-9A-Fa-f]{2})*$/,
    };

    constructor(options: RouterOptions = {}) {
        this.routerOptions = {
            caseSensitive: false,
            mergeParams: false,
            strict: false,
            ...options,
        };
        this.logger = new Logger({
            components: {
                router: true,
            },
        });
    }

    /**
     * Add middleware to this router
     */
    use(middleware: MiddlewareFunction): XyPrissRouter;
    use(path: string, middleware: MiddlewareFunction): XyPrissRouter;
    use(path: string, router: XyPrissRouter): XyPrissRouter;
    use(
        pathOrMiddleware: string | MiddlewareFunction,
        middlewareOrRouter?: MiddlewareFunction | XyPrissRouter,
    ): XyPrissRouter {
        try {
            if (typeof pathOrMiddleware === "function") {
                // router.use(middleware)
                this.middleware.push({ handler: pathOrMiddleware });
                this.logger.debug("router", `Added middleware to router`);
            } else if (typeof middlewareOrRouter === "function") {
                // router.use(path, middleware)
                const normalizedPath = this.normalizePath(pathOrMiddleware);
                this.middleware.push({
                    path: normalizedPath,
                    handler: middlewareOrRouter,
                });

                this.logger.debug(
                    "router",
                    `Added path-specific middleware for ${pathOrMiddleware}`,
                );
            } else if (middlewareOrRouter instanceof XyPrissRouter) {
                // router.use(path, router)
                this._mountRouter(pathOrMiddleware, middlewareOrRouter);
                this.logger.debug(
                    "router",
                    `Mounted sub-router at ${pathOrMiddleware}`,
                );
            }
        } catch (error) {
            this.logger.error(
                "router",
                `Failed to add middleware/router: ${error}`,
            );
            throw error;
        }

        return this;
    }

    /**
     * HTTP method handlers
     */
    get(
        path: string,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): XyPrissRouter {
        return this._addRoute("GET", path, handlers);
    }

    post(
        path: string,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): XyPrissRouter {
        return this._addRoute("POST", path, handlers);
    }

    put(
        path: string,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): XyPrissRouter {
        return this._addRoute("PUT", path, handlers);
    }

    patch(
        path: string,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): XyPrissRouter {
        return this._addRoute("PATCH", path, handlers);
    }

    delete(
        path: string,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): XyPrissRouter {
        return this._addRoute("DELETE", path, handlers);
    }

    head(
        path: string,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): XyPrissRouter {
        return this._addRoute("HEAD", path, handlers);
    }

    options(
        path: string,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): XyPrissRouter {
        return this._addRoute("OPTIONS", path, handlers);
    }

    /**
     * Handle all HTTP methods
     */
    all(
        path: string,
        ...handlers: (MiddlewareFunction | RouteHandler)[]
    ): XyPrissRouter {
        const methods = [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "HEAD",
            "OPTIONS",
        ];
        methods.forEach((method) => {
            this._addRoute(method, path, handlers);
        });
        return this;
    }

    /**
     * Get all routes from this router
     */
    getRoutes(): RouteDefinition[] {
        return [...this.routes];
    }

    /**
     * Get all middleware entries from this router
     */
    getMiddleware(): MiddlewareEntry[] {
        return [...this.middleware];
    }

    /**
     * Get router statistics
     */
    getStats(): any {
        const routesByMethod = this.routes.reduce(
            (acc, route) => {
                acc[route.method] = (acc[route.method] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>,
        );

        return {
            totalRoutes: this.routes.length,
            totalMiddleware: this.middleware.length,
            routesByMethod,
            options: this.routerOptions,
        };
    }

    /**
     * Add a route with method, path, and handlers
     */
    private _addRoute(
        method: string,
        path: string,
        handlers: (MiddlewareFunction | RouteHandler)[],
    ): XyPrissRouter {
        if (!method || typeof method !== "string") {
            throw new Error("HTTP method must be a non-empty string");
        }

        if (!path || typeof path !== "string") {
            throw new Error("Route path must be a non-empty string");
        }

        if (!Array.isArray(handlers) || handlers.length === 0) {
            throw new Error(
                `Route ${method} ${path} must have at least one handler`,
            );
        }

        const normalizedPath = this.normalizePath(path);

        // Validate path format
        if (!this._isValidPath(normalizedPath)) {
            throw new Error(`Invalid path format: ${path}`);
        }

        // Separate middleware from the final handler
        const middleware = handlers.slice(0, -1) as MiddlewareFunction[];
        const handler = handlers[handlers.length - 1] as RouteHandler;

        if (typeof handler !== "function") {
            throw new Error(
                `Final handler must be a function for route ${method} ${path}`,
            );
        }

        const { pattern, paramNames } =
            this._compileRoutePattern(normalizedPath);

        const inputMiddlewareEntries: MiddlewareEntry[] = middleware.map(
            (m) => ({ handler: m }),
        );
        const combinedMiddleware = [
            ...this.middleware,
            ...inputMiddlewareEntries,
        ];

        const route: RouteDefinition = {
            method: method.toUpperCase(),
            path: normalizedPath,
            handler,
            middleware: combinedMiddleware,
            pattern,
            paramNames,
        };

        this.routes.push(route);
        this.logger.debug("router", `Added route: ${method} ${normalizedPath}`);
        return this;
    }

    /**
     * Mount a sub-router at a specific path
     */
    private _mountRouter(mountPath: string, router: XyPrissRouter): void {
        if (!router || !(router instanceof XyPrissRouter)) {
            throw new Error("Invalid router instance provided");
        }

        const normalizedMountPath = this.normalizePath(mountPath);

        // Get all routes from the sub-router and prefix them
        const subRoutes = router.getRoutes();
        subRoutes.forEach((route) => {
            try {
                const fullPath = this._joinPaths(
                    normalizedMountPath,
                    route.path,
                );
                const { pattern, paramNames } =
                    this._compileRoutePattern(fullPath);

                // Transform middleware entries from sub-route
                const mountedMiddleware = route.middleware.map((entry) => {
                    if (entry.path) {
                        return {
                            path: this._joinPaths(
                                normalizedMountPath,
                                entry.path,
                            ),
                            handler: entry.handler,
                        };
                    } else {
                        // If middleware had no path in sub-router, it is scoped to mountPath
                        return {
                            path: normalizedMountPath,
                            handler: entry.handler,
                        };
                    }
                });

                // Combine with parent middleware
                // Note: this.middleware are already correctly scoped for the parent
                const combinedMiddleware = [
                    ...this.middleware,
                    ...mountedMiddleware,
                ];

                const mountedRoute: RouteDefinition = {
                    method: route.method,
                    path: fullPath,
                    handler: route.handler,
                    middleware: combinedMiddleware,
                    pattern,
                    paramNames,
                };

                this.routes.push(mountedRoute);
            } catch (error) {
                this.logger.error(
                    "router",
                    `Failed to mount route ${route.method} ${route.path}: ${error}`,
                );
                throw error;
            }
        });
    }

    /**
     * Normalize path using regex patterns
     */
    private normalizePath(path: string): string {
        if (!path || typeof path !== "string") {
            throw new Error("Path must be a non-empty string");
        }

        let normalized = path.trim();

        // Ensure path starts with /
        if (!XyPrissRouter.PATH_PATTERNS.leadingSlash.test(normalized)) {
            normalized = "/" + normalized;
        }

        // Remove trailing slashes except for root
        if (normalized.length > 1) {
            normalized = normalized.replace(
                XyPrissRouter.PATH_PATTERNS.trailingSlash,
                "",
            );
        }

        // Normalize multiple consecutive slashes to single slash
        normalized = normalized.replace(
            XyPrissRouter.PATH_PATTERNS.multipleSlashes,
            "/",
        );

        return normalized || "/";
    }

    /**
     * Join two paths correctly using regex
     */
    private _joinPaths(basePath: string, subPath: string): string {
        const normalizedBase = this.normalizePath(basePath);
        const normalizedSub = this.normalizePath(subPath);

        if (normalizedSub === "/") {
            return normalizedBase;
        }

        return normalizedBase === "/"
            ? normalizedSub
            : normalizedBase + normalizedSub;
    }

    /**
     * Validate path format using regex
     */
    private _isValidPath(path: string): boolean {
        return XyPrissRouter.PATH_PATTERNS.pathValidation.test(path);
    }

    /**
     * Compile a path pattern for basic matching
     */
    private _compilePathPattern(path: string, isMiddleware = false): RegExp {
        let pattern = path;

        // Handle wildcards - distinguish between * and **
        if (XyPrissRouter.PATH_PATTERNS.wildcardPattern.test(pattern)) {
            const wildcardMatch = pattern.match(/\*+$/);
            if (wildcardMatch) {
                const wildcardCount = wildcardMatch[0].length;
                const basePath = pattern.slice(0, -wildcardCount);

                if (wildcardCount === 1) {
                    // Single * - matches one path segment only (no slashes)
                    pattern = basePath + "[^/]+";
                } else {
                    // Double ** or more - matches multiple path segments (including slashes)
                    pattern = basePath + ".*";
                }
            }
        }

        // Escape special regex characters except for our wildcards
        pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

        // Create case-sensitive or insensitive regex
        const flags = this.routerOptions.caseSensitive ? "" : "i";

        // For middleware, we match as a prefix by default (like Express)
        // Express router.use('/path') matches /path, /path/, /path/sub
        if (isMiddleware) {
            // Match the path as a prefix, but only if it's a full path segment
            // (either ends the string or is followed by a slash)
            return new RegExp(`^${pattern}(?:/.*|$)`, flags);
        }

        return new RegExp(`^${pattern}$`, flags);
    }

    /**
     * Compile a route pattern with parameter support
     */
    private _compileRoutePattern(path: string): {
        pattern: RegExp;
        paramNames: string[];
    } {
        const paramNames: string[] = [];
        let pattern = path;

        // Extract parameter names and replace with capture groups
        pattern = pattern.replace(
            XyPrissRouter.PATH_PATTERNS.paramPattern,
            (_match, paramName) => {
                paramNames.push(paramName);
                return "([^/]+)";
            },
        );

        // Handle wildcards - distinguish between * and **
        if (XyPrissRouter.PATH_PATTERNS.wildcardPattern.test(pattern)) {
            const wildcardMatch = pattern.match(/\*+$/);
            if (wildcardMatch) {
                const wildcardCount = wildcardMatch[0].length;
                const basePath = pattern.slice(0, -wildcardCount);

                if (wildcardCount === 1) {
                    // Single * - matches one path segment only (no slashes)
                    pattern = basePath + "([^/]+)";
                    paramNames.push("*");
                } else {
                    // Double ** or more - matches multiple path segments (including slashes)
                    pattern = basePath + "(.*)";
                    paramNames.push("**");
                }
            }
        }

        // Escape special regex characters, but preserve parameter groups
        // First, temporarily replace parameter groups with placeholders
        const paramGroups: string[] = [];
        pattern = pattern.replace(/\([^)]+\)/g, (match) => {
            paramGroups.push(match);
            return `__PARAM_GROUP_${paramGroups.length - 1}__`;
        });

        // Now escape special characters
        pattern = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\" + "$&");

        // Restore parameter groups
        paramGroups.forEach((group, index) => {
            pattern = pattern.replace(`__PARAM_GROUP_${index}__`, group);
        });

        // Handle strict mode
        if (!this.routerOptions.strict && !pattern.includes("(")) {
            pattern += "/?";
        }

        const flags = this.routerOptions.caseSensitive ? "" : "i";
        const compiledPattern = new RegExp(`^${pattern}$`, flags);

        return { pattern: compiledPattern, paramNames };
    }

    /**
     * Match path with compiled pattern and extract parameters
     */
    private _matchPathWithPattern(pattern: RegExp, path: string): RouteMatch {
        const match = pattern.exec(path);

        if (!match) {
            return { matched: false };
        }

        return { matched: true };
    }
}

/**
 * Factory function to create a new router (Express-like)
 */
export function Router(options?: RouterOptions): XyPrissRouter {
    return new XyPrissRouter(options);
}

// Default export for convenience
export default Router;


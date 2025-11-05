/**
 * FastRouteEngine - Ultra-optimized route execution system for XyPriss
 *
 * Enhanced Features:
 * - Proper Radix Tree implementation for O(k) lookup where k = path length
 * - Zero-lookup route matching using compiled radix trees
 * - Batch route registration with automatic optimization
 * - Pre-compiled handler chains for instant execution
 * - Smart route grouping and priority-based execution
 * - Memory-efficient route storage with shared patterns
 * - JIT (Just-In-Time) route compilation
 * - Predictive route caching based on access patterns
 * - Enhanced error handling and validation
 * - Route conflict detection
 * - Comprehensive route tree visualization
 *
 * @author XyPriss Team
 * @version 2.0.0
 */

import { Logger } from "../../../shared/logger/Logger";
import type {
    FastRouteConfig,
    FastRouteHandler,
    FastRouteContext,
    CompiledRoute,
    RouteNode,
    RouteMatcher,
    BatchRouteConfig,
    RouteExecutionStats,
    FastRouteEngineOptions,
} from "../../types/FastRouteEngine.type";
import type {
    XyPrisRequest,
    XyPrisResponse,
} from "../../types/httpServer.type";

/**
 * Enhanced RadixTreeNode for efficient route storage
 */
interface RadixTreeNode {
    segment: string;
    isWildcard: boolean;
    isParam: boolean;
    paramName?: string;
    paramType?: string;
    children: Map<string, RadixTreeNode>;
    routes: Map<string, CompiledRoute>; // method -> route
    priority: number;
}

/**
 * Route validation result
 */
interface RouteValidation {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * FastRouteEngine - Revolutionary routing system with Radix Tree
 */
export class FastRouteEngine {
    private logger: Logger;
    private options: FastRouteEngineOptions;

    // Root radix tree nodes per HTTP method for ultra-fast matching
    private radixTrees: Map<string, RadixTreeNode> = new Map();

    // Compiled routes for instant execution
    private compiledRoutes: Map<string, CompiledRoute> = new Map();

    // Static routes (no params) - O(1) lookup
    private staticRoutes: Map<string, Map<string, CompiledRoute>> = new Map();

    // Dynamic routes (with params) - optimized matching via radix tree
    private dynamicRoutes: Map<string, CompiledRoute[]> = new Map();

    // Route execution statistics
    private stats: RouteExecutionStats = {
        totalRoutes: 0,
        staticRoutes: 0,
        dynamicRoutes: 0,
        totalExecutions: 0,
        averageExecutionTime: 0,
        cacheHits: 0,
        cacheMisses: 0,
        compiledRoutes: 0,
    };

    // Route cache for predictive optimization
    private routeCache: Map<string, CompiledRoute> = new Map();
    private routeAccessCount: Map<string, number> = new Map();

    // Pre-compiled matchers for common patterns
    private matchers: Map<string, RouteMatcher> = new Map();

    // Route conflict detection
    private routeRegistry: Set<string> = new Set();

    constructor(options: FastRouteEngineOptions = {}) {
        this.options = {
            enableCache: true,
            cacheSize: 1000,
            enableStats: true,
            enableJIT: true,
            enablePredictive: true,
            autoOptimize: true,
            optimizationThreshold: 100,
            ...options,
        };

        this.logger = new Logger({
            components: {
                routing: this.options.enableStats ?? true,
            },
        });

        this.initializeMatchers();
        this.initializeRadixTrees();
    }

    /**
     * Initialize radix trees for each HTTP method
     */
    private initializeRadixTrees(): void {
        const methods = [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE",
            "HEAD",
            "OPTIONS",
        ];

        for (const method of methods) {
            this.radixTrees.set(method, this.createRadixNode(""));
        }
    }

    /**
     * Create a new radix tree node
     */
    private createRadixNode(segment: string): RadixTreeNode {
        return {
            segment,
            isWildcard: segment === "*",
            isParam: segment.startsWith(":"),
            paramName: segment.startsWith(":")
                ? this.extractParamName(segment)
                : undefined,
            paramType: segment.startsWith(":")
                ? this.extractParamType(segment)
                : undefined,
            children: new Map(),
            routes: new Map(),
            priority: 0,
        };
    }

    /**
     * Extract parameter name from segment
     */
    private extractParamName(segment: string): string {
        const match = segment.match(/^:([^<]+)/);
        return match ? match[1] : segment.slice(1);
    }

    /**
     * Extract parameter type from segment
     */
    private extractParamType(segment: string): string | undefined {
        const match = segment.match(/<([^>]+)>/);
        return match ? match[1] : undefined;
    }

    /**
     * Initialize pre-compiled matchers for common patterns
     */
    private initializeMatchers(): void {
        // UUID matcher
        this.matchers.set("uuid", {
            pattern:
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            extract: (value: string) => value,
        });

        // ID matcher (numeric)
        this.matchers.set("id", {
            pattern: /^\d+$/,
            extract: (value: string) => parseInt(value, 10),
        });

        // Slug matcher
        this.matchers.set("slug", {
            pattern: /^[a-z0-9-]+$/,
            extract: (value: string) => value,
        });

        // Email matcher
        this.matchers.set("email", {
            pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
            extract: (value: string) => value,
        });

        // Alphanumeric matcher
        this.matchers.set("alpha", {
            pattern: /^[a-zA-Z]+$/,
            extract: (value: string) => value,
        });

        // Any matcher
        this.matchers.set("any", {
            pattern: /.*/,
            extract: (value: string) => value,
        });
    }

    /**
     * Validate route configuration
     */
    private validateRoute(config: FastRouteConfig): RouteValidation {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate method
        if (!config.method) {
            errors.push("Route method is required");
        } else if (
            ![
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "HEAD",
                "OPTIONS",
            ].includes(config.method.toUpperCase())
        ) {
            warnings.push(`Uncommon HTTP method: ${config.method}`);
        }

        // Validate path
        if (!config.path) {
            errors.push("Route path is required");
        } else {
            if (!config.path.startsWith("/")) {
                errors.push("Route path must start with '/'");
            }

            // Check for invalid characters (allow < > for typed parameters)
            if (/[{}[\]\\|^`]/.test(config.path)) {
                errors.push("Route path contains invalid characters");
            }

            // Check for duplicate slashes
            if (/\/\//.test(config.path)) {
                warnings.push("Route path contains duplicate slashes");
            }

            // Validate parameter syntax
            const paramMatches = config.path.match(/:([^/:<]+)(?:<([^>]+)>)?/g);
            if (paramMatches) {
                for (const param of paramMatches) {
                    const typeMatch = param.match(/<([^>]+)>/);
                    if (typeMatch) {
                        const type = typeMatch[1];
                        if (!this.matchers.has(type)) {
                            warnings.push(`Unknown parameter type: ${type}`);
                        }
                    }
                }
            }
        }

        // Validate handler
        if (!config.handler || typeof config.handler !== "function") {
            errors.push("Route handler must be a function");
        }

        // Validate middleware
        if (config.middleware) {
            if (!Array.isArray(config.middleware)) {
                errors.push("Middleware must be an array");
            } else {
                for (let i = 0; i < config.middleware.length; i++) {
                    if (typeof config.middleware[i] !== "function") {
                        errors.push(
                            `Middleware at index ${i} must be a function`
                        );
                    }
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Check for route conflicts
     */
    private checkRouteConflict(method: string, path: string): string | null {
        const routeKey = this.generateRouteKey(method, path);

        if (this.routeRegistry.has(routeKey)) {
            return `Route already exists: ${method} ${path}`;
        }

        // Check for ambiguous routes (e.g., /users/:id and /users/:userId)
        const segments = path.split("/").filter(Boolean);

        for (const existingKey of this.routeRegistry) {
            const [existingMethod, existingPath] = existingKey.split(":", 2);

            if (existingMethod !== method.toUpperCase()) continue;

            const existingSegments = existingPath.split("/").filter(Boolean);

            if (segments.length !== existingSegments.length) continue;

            let isAmbiguous = true;
            for (let i = 0; i < segments.length; i++) {
                const seg = segments[i];
                const existingSeg = existingSegments[i];

                const isParam = seg.startsWith(":");
                const isExistingParam = existingSeg.startsWith(":");

                if (!isParam && !isExistingParam && seg !== existingSeg) {
                    isAmbiguous = false;
                    break;
                }
            }

            if (isAmbiguous && path !== existingPath) {
                return `Ambiguous route detected: ${method} ${path} conflicts with ${existingPath}`;
            }
        }

        return null;
    }

    /**
     * Register a single route with automatic compilation
     */
    public route(config: FastRouteConfig): this {
        const startTime = performance.now();

        try {
            // Validate route
            const validation = this.validateRoute(config);

            if (!validation.valid) {
                throw new Error(
                    `Route validation failed: ${validation.errors.join(", ")}`
                );
            }

            if (validation.warnings.length > 0 && this.options.enableStats) {
                for (const warning of validation.warnings) {
                    this.logger.warn("routing", warning);
                }
            }

            // Check for conflicts
            const conflict = this.checkRouteConflict(
                config.method,
                config.path
            );
            if (conflict) {
                this.logger.warn("routing", conflict);
            }

            const compiled = this.compileRoute(config);
            const routeKey = this.generateRouteKey(config.method, config.path);

            // Register route
            this.routeRegistry.add(routeKey);

            // Store compiled route
            this.compiledRoutes.set(routeKey, compiled);

            // Add to radix tree
            this.addToRadixTree(compiled);

            // Categorize route for optimal lookup
            if (compiled.isStatic) {
                this.addStaticRoute(config.method, config.path, compiled);
                this.stats.staticRoutes++;
            } else {
                this.addDynamicRoute(config.method, compiled);
                this.stats.dynamicRoutes++;
            }

            this.stats.totalRoutes++;
            this.stats.compiledRoutes++;

            const compileTime = performance.now() - startTime;

            if (this.options.enableStats) {
                this.logger.debug(
                    "routing",
                    `Route compiled: ${config.method} ${
                        config.path
                    } (${compileTime.toFixed(2)}ms)`
                );
            }

            return this;
        } catch (error) {
            this.logger.error(
                "routing",
                `Failed to compile route ${config.method} ${config.path}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Add compiled route to radix tree
     */
    private addToRadixTree(route: CompiledRoute): void {
        const method = route.method;
        const root = this.radixTrees.get(method);

        if (!root) {
            throw new Error(`No radix tree found for method: ${method}`);
        }

        const segments = route.path.split("/").filter(Boolean);
        let currentNode = root;

        for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const isLast = i === segments.length - 1;

            // Check for existing child with matching segment
            let childNode = this.findMatchingChild(currentNode, segment);

            if (!childNode) {
                // Create new node
                childNode = this.createRadixNode(segment);

                // Determine key for storage
                const key = segment.startsWith(":")
                    ? `:param`
                    : segment === "*"
                    ? "*"
                    : segment;
                currentNode.children.set(key, childNode);
            }

            if (isLast) {
                // Store route at leaf node
                childNode.routes.set(method, route);
                childNode.priority = route.priority;
            }

            currentNode = childNode;
        }
    }

    /**
     * Find matching child node in radix tree
     */
    private findMatchingChild(
        node: RadixTreeNode,
        segment: string
    ): RadixTreeNode | undefined {
        if (segment.startsWith(":")) {
            return node.children.get(":param");
        } else if (segment === "*") {
            return node.children.get("*");
        } else {
            return node.children.get(segment);
        }
    }

    /**
     * Search radix tree for matching route
     */
    private searchRadixTree(
        method: string,
        path: string
    ): { route: CompiledRoute | null; params: Record<string, any> } {
        const root = this.radixTrees.get(method);

        if (!root) {
            return { route: null, params: {} };
        }

        const segments = path.split("/").filter(Boolean);
        const params: Record<string, any> = {};

        const result = this.traverseRadixTree(root, segments, 0, params);

        return result ? { route: result, params } : { route: null, params: {} };
    }

    /**
     * Recursively traverse radix tree to find matching route
     */
    private traverseRadixTree(
        node: RadixTreeNode,
        segments: string[],
        index: number,
        params: Record<string, any>
    ): CompiledRoute | null {
        // Reached end of path
        if (index === segments.length) {
            const firstKey = node.routes.keys().next().value;
            const route = firstKey ? node.routes.get(firstKey) : undefined;
            return route || null;
        }

        // Bounds check - should never happen but TypeScript needs this
        if (index >= segments.length) {
            return null;
        }

        const segment = segments[index];

        // Try exact match first
        const exactChild = node.children.get(segment);
        if (exactChild) {
            const result = this.traverseRadixTree(
                exactChild,
                segments,
                index + 1,
                params
            );
            if (result) return result;
        }

        // Try parameter match
        const paramChild = node.children.get(":param");
        if (paramChild && paramChild.paramName) {
            // Validate parameter type if specified
            if (paramChild.paramType) {
                const matcher = this.matchers.get(paramChild.paramType);
                if (matcher && !matcher.pattern.test(segment)) {
                    // Type validation failed, skip this path
                } else {
                    params[paramChild.paramName] = matcher
                        ? matcher.extract(segment)
                        : segment;
                    const result = this.traverseRadixTree(
                        paramChild,
                        segments,
                        index + 1,
                        params
                    );
                    if (result) return result;
                }
            } else {
                params[paramChild.paramName] = segment;
                const result = this.traverseRadixTree(
                    paramChild,
                    segments,
                    index + 1,
                    params
                );
                if (result) return result;
            }
        }

        // Try wildcard match
        const wildcardChild = node.children.get("*");
        if (wildcardChild) {
            const firstKey = wildcardChild.routes.keys().next().value;
            const route = firstKey ? wildcardChild.routes.get(firstKey) : undefined;
            return route || null;
        }

        return null;
    }

    /**
     * Batch register multiple routes with optimization
     */
    public batch(configs: BatchRouteConfig): this {
        const startTime = performance.now();

        this.logger.debug(
            "routing",
            `Batch registering ${configs.routes.length} routes...`
        );

        // Validate all routes first
        const validationErrors: string[] = [];
        for (const route of configs.routes) {
            const validation = this.validateRoute(route);
            if (!validation.valid) {
                validationErrors.push(
                    `${route.method} ${route.path}: ${validation.errors.join(
                        ", "
                    )}`
                );
            }
        }

        if (validationErrors.length > 0) {
            throw new Error(
                `Batch validation failed:\n${validationErrors.join("\n")}`
            );
        }

        // Group routes by method for optimization
        const routesByMethod = new Map<string, FastRouteConfig[]>();

        for (const route of configs.routes) {
            const method = route.method.toUpperCase();
            if (!routesByMethod.has(method)) {
                routesByMethod.set(method, []);
            }
            routesByMethod.get(method)!.push(route);
        }

        // Register routes in optimized order (static first, then dynamic)
        for (const [method, routes] of routesByMethod) {
            // Sort: static routes first, then by path complexity
            const sorted = routes.sort((a, b) => {
                const aStatic = !a.path.includes(":") && !a.path.includes("*");
                const bStatic = !b.path.includes(":") && !b.path.includes("*");

                if (aStatic && !bStatic) return -1;
                if (!aStatic && bStatic) return 1;

                // Sort by priority if specified
                if (a.priority !== undefined && b.priority !== undefined) {
                    return b.priority - a.priority;
                }

                return a.path.length - b.path.length;
            });

            for (const route of sorted) {
                this.route(route);
            }
        }

        const batchTime = performance.now() - startTime;

        this.logger.debug(
            "routing",
            `Batch registration completed: ${
                configs.routes.length
            } routes in ${batchTime.toFixed(2)}ms`
        );

        // Auto-optimize if enabled
        if (this.options.autoOptimize && configs.optimize !== false) {
            this.optimize();
        }

        return this;
    }

    /**
     * Execute a route with ultra-fast matching
     */
    public async execute(
        method: string,
        path: string,
        req: XyPrisRequest,
        res: XyPrisResponse
    ): Promise<boolean> {
        const startTime = performance.now();
        const normalizedMethod = method.toUpperCase();

        try {
            // Try cache first (O(1) lookup)
            if (this.options.enableCache) {
                const cacheKey = `${normalizedMethod}:${path}`;
                const cached = this.routeCache.get(cacheKey);

                if (cached) {
                    this.stats.cacheHits++;
                    await this.executeCompiledRoute(cached, req, res, {});
                    this.updateStats(startTime);
                    return true;
                }
                this.stats.cacheMisses++;
            }

            // Try static routes first (O(1) lookup)
            const staticRoute = this.staticRoutes
                .get(normalizedMethod)
                ?.get(path);
            if (staticRoute) {
                await this.executeCompiledRoute(staticRoute, req, res, {});
                this.cacheRoute(`${normalizedMethod}:${path}`, staticRoute);
                this.updateStats(startTime);
                return true;
            }

            // Try radix tree search (O(k) where k = path segments)
            const radixResult = this.searchRadixTree(normalizedMethod, path);
            if (radixResult.route) {
                await this.executeCompiledRoute(
                    radixResult.route,
                    req,
                    res,
                    radixResult.params
                );
                this.cacheRoute(
                    `${normalizedMethod}:${path}`,
                    radixResult.route
                );
                this.updateStats(startTime);
                return true;
            }

            // Fallback to dynamic routes (for backwards compatibility)
            const dynamicRoutes = this.dynamicRoutes.get(normalizedMethod);
            if (dynamicRoutes) {
                for (const route of dynamicRoutes) {
                    const match = this.matchRoute(route, path);
                    if (match.matched) {
                        await this.executeCompiledRoute(
                            route,
                            req,
                            res,
                            match.params || {}
                        );
                        this.cacheRoute(`${normalizedMethod}:${path}`, route);
                        this.updateStats(startTime);
                        return true;
                    }
                }
            }

            // No route found
            return false;
        } catch (error) {
            this.logger.error(
                "routing",
                `Route execution failed for ${method} ${path}:`,
                error
            );
            throw error;
        }
    }

    /**
     * Compile a route configuration into an optimized executable
     */
    private compileRoute(config: FastRouteConfig): CompiledRoute {
        const isStatic =
            !config.path.includes(":") && !config.path.includes("*");
        const segments = config.path.split("/").filter(Boolean);

        const params: string[] = [];
        const pattern: string[] = [];

        for (const segment of segments) {
            if (segment.startsWith(":")) {
                // Parameter segment
                const paramName = segment.slice(1);
                const [name, type] = paramName.split("<");

                params.push(name);

                if (type) {
                    // Typed parameter: :id<uuid>
                    const typeName = type.replace(">", "");
                    pattern.push(
                        `(?<${name}>${this.getMatcherPattern(typeName)})`
                    );
                } else {
                    // Generic parameter: :id
                    pattern.push(`(?<${name}>[^/]+)`);
                }
            } else if (segment === "*") {
                // Wildcard
                pattern.push(".*");
            } else {
                // Static segment
                pattern.push(this.escapeRegex(segment));
            }
        }

        const regex = isStatic
            ? null
            : new RegExp(`^/${pattern.join("/")}$`, "i");

        // Compile handler chain with error boundaries
        const handlers = [...(config.middleware || []), config.handler].map(
            (handler) => this.wrapHandler(handler)
        );

        return {
            method: config.method.toUpperCase(),
            path: config.path,
            isStatic,
            params,
            pattern: regex,
            handlers,
            priority: config.priority ?? 0,
            metadata: config.metadata || {},
        };
    }

    /**
     * Wrap handler with error boundary
     */
    private wrapHandler(handler: FastRouteHandler): FastRouteHandler {
        return async (
            req: XyPrisRequest,
            res: XyPrisResponse,
            ctx: FastRouteContext
        ) => {
            try {
                await handler(req, res, ctx);
            } catch (error) {
                this.logger.error(
                    "routing",
                    `Handler error in ${ctx.route}:`,
                    error
                );
                throw error;
            }
        };
    }

    /**
     * Escape regex special characters
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    /**
     * Execute a compiled route
     */
    private async executeCompiledRoute(
        route: CompiledRoute,
        req: XyPrisRequest,
        res: XyPrisResponse,
        params: Record<string, any>
    ): Promise<void> {
        const context: FastRouteContext = {
            route: route.path,
            method: route.method,
            params: { ...req.params, ...params },
            metadata: route.metadata,
        };

        // Inject params into request
        req.params = context.params;

        // Execute handler chain
        for (const handler of route.handlers) {
            await handler(req, res, context);

            // Stop if response was sent
            if (res.writableEnded || res.headersSent) {
                break;
            }
        }

        this.stats.totalExecutions++;
    }

    /**
     * Match a dynamic route against a path (fallback method)
     */
    private matchRoute(
        route: CompiledRoute,
        path: string
    ): { matched: boolean; params?: Record<string, any> } {
        if (!route.pattern) {
            return { matched: false };
        }

        const match = route.pattern.exec(path);
        if (!match) {
            return { matched: false };
        }

        const params: Record<string, any> = {};

        if (match.groups) {
            for (const [key, value] of Object.entries(match.groups)) {
                // Apply type extraction if available
                const paramIndex = route.params.indexOf(key);
                if (paramIndex !== -1) {
                    const segment = route.path.split("/").filter(Boolean)[
                        paramIndex
                    ];
                    const typeMatch = segment.match(/<([^>]+)>/);

                    if (typeMatch) {
                        const type = typeMatch[1];
                        const matcher = this.matchers.get(type);
                        params[key] = matcher ? matcher.extract(value) : value;
                    } else {
                        params[key] = value;
                    }
                } else {
                    params[key] = value;
                }
            }
        }

        return { matched: true, params };
    }

    /**
     * Add a static route for O(1) lookup
     */
    private addStaticRoute(
        method: string,
        path: string,
        route: CompiledRoute
    ): void {
        const normalizedMethod = method.toUpperCase();

        if (!this.staticRoutes.has(normalizedMethod)) {
            this.staticRoutes.set(normalizedMethod, new Map());
        }

        this.staticRoutes.get(normalizedMethod)!.set(path, route);
    }

    /**
     * Add a dynamic route with optimized ordering
     */
    private addDynamicRoute(method: string, route: CompiledRoute): void {
        const normalizedMethod = method.toUpperCase();

        if (!this.dynamicRoutes.has(normalizedMethod)) {
            this.dynamicRoutes.set(normalizedMethod, []);
        }

        const routes = this.dynamicRoutes.get(normalizedMethod)!;

        // Insert route based on priority and specificity
        const insertIndex = routes.findIndex((r) => {
            if (route.priority !== r.priority) {
                return route.priority > r.priority;
            }
            // More specific routes (fewer params) come first
            return route.params.length < r.params.length;
        });

        if (insertIndex === -1) {
            routes.push(route);
        } else {
            routes.splice(insertIndex, 0, route);
        }
    }

    /**
     * Cache a route for predictive optimization
     */
    private cacheRoute(key: string, route: CompiledRoute): void {
        if (!this.options.enableCache) return;

        // Track access count
        const count = (this.routeAccessCount.get(key) || 0) + 1;
        this.routeAccessCount.set(key, count);

        // Cache if accessed frequently
        if (
            count >= 3 &&
            this.routeCache.size < (this.options.cacheSize || 1000)
        ) {
            this.routeCache.set(key, route);
        }

        // Implement LRU eviction if cache is full
        if (this.routeCache.size > (this.options.cacheSize || 1000)) {
            this.evictLeastUsedRoute();
        }
    }

    /**
     * Evict least recently used route from cache
     */
    private evictLeastUsedRoute(): void {
        let minCount = Infinity;
        let lruKey: string | null = null;

        for (const [key, count] of this.routeAccessCount.entries()) {
            if (this.routeCache.has(key) && count < minCount) {
                minCount = count;
                lruKey = key;
            }
        }

        if (lruKey) {
            this.routeCache.delete(lruKey);
        }
    }

    /**
     * Get matcher pattern for typed parameters
     */
    private getMatcherPattern(type: string): string {
        const matcher = this.matchers.get(type);
        return matcher ? matcher.pattern.source : "[^/]+";
    }

    /**
     * Generate a unique route key
     */
    private generateRouteKey(method: string, path: string): string {
        return `${method.toUpperCase()}:${path}`;
    }

    /**
     * Update execution statistics
     */
    private updateStats(startTime: number): void {
        if (!this.options.enableStats) return;

        const executionTime = performance.now() - startTime;

        // Update average execution time with exponential moving average
        const alpha = 0.1; // Smoothing factor
        this.stats.averageExecutionTime =
            this.stats.averageExecutionTime * (1 - alpha) +
            executionTime * alpha;
    }

    /**
     * Optimize route execution based on access patterns
     */
    public optimize(): void {
        if (!this.options.enablePredictive) return;

        this.logger.debug("routing", "Running route optimization...");

        // Clear cache and rebuild based on access patterns
        const accessEntries = Array.from(this.routeAccessCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, this.options.cacheSize || 1000);

        this.routeCache.clear();

        for (const [key] of accessEntries) {
            const [method, path] = key.split(":", 2);
            const route = this.staticRoutes.get(method)?.get(path);
            if (route) {
                this.routeCache.set(key, route);
            } else {
                // Try to find in dynamic routes
                const radixResult = this.searchRadixTree(method, path);
                if (radixResult.route) {
                    this.routeCache.set(key, radixResult.route);
                }
            }
        }

        // Rebuild radix trees with optimized structure
        this.rebuildRadixTrees();

        this.logger.debug(
            "routing",
            `Optimization complete: ${this.routeCache.size} routes cached`
        );
    }

    /**
     * Rebuild radix trees for optimal performance
     */
    private rebuildRadixTrees(): void {
        // Get all routes sorted by access count
        const sortedRoutes = Array.from(this.compiledRoutes.values()).sort(
            (a, b) => {
                const aKey = this.generateRouteKey(a.method, a.path);
                const bKey = this.generateRouteKey(b.method, b.path);
                const aCount = this.routeAccessCount.get(aKey) || 0;
                const bCount = this.routeAccessCount.get(bKey) || 0;
                return bCount - aCount;
            }
        );

        // Clear and rebuild trees
        this.initializeRadixTrees();

        for (const route of sortedRoutes) {
            this.addToRadixTree(route);
        }
    }

    /**
     * Get route execution statistics
     */
    public getStats(): RouteExecutionStats {
        return { ...this.stats };
    }

    /**
     * Get detailed route information
     */
    public getRouteInfo(method: string, path: string): CompiledRoute | null {
        const routeKey = this.generateRouteKey(method, path);
        return this.compiledRoutes.get(routeKey) || null;
    }

    /**
     * Check if a route exists
     */
    public hasRoute(method: string, path: string): boolean {
        const routeKey = this.generateRouteKey(method, path);
        return this.compiledRoutes.has(routeKey);
    }

    /**
     * Remove a specific route
     */
    public removeRoute(method: string, path: string): boolean {
        const routeKey = this.generateRouteKey(method, path);

        if (!this.compiledRoutes.has(routeKey)) {
            return false;
        }

        const route = this.compiledRoutes.get(routeKey)!;

        // Remove from compiled routes
        this.compiledRoutes.delete(routeKey);

        // Remove from static routes
        if (route.isStatic) {
            const methodRoutes = this.staticRoutes.get(method.toUpperCase());
            if (methodRoutes) {
                methodRoutes.delete(path);
                this.stats.staticRoutes--;
            }
        } else {
            // Remove from dynamic routes
            const dynamicRoutes = this.dynamicRoutes.get(method.toUpperCase());
            if (dynamicRoutes) {
                const index = dynamicRoutes.findIndex((r) => r.path === path);
                if (index !== -1) {
                    dynamicRoutes.splice(index, 1);
                    this.stats.dynamicRoutes--;
                }
            }
        }

        // Remove from registry
        this.routeRegistry.delete(routeKey);

        // Remove from cache
        this.routeCache.delete(routeKey);
        this.routeAccessCount.delete(routeKey);

        // Rebuild radix tree for this method
        this.rebuildMethodRadixTree(method.toUpperCase());

        this.stats.totalRoutes--;
        this.stats.compiledRoutes--;

        this.logger.debug("routing", `Route removed: ${method} ${path}`);

        return true;
    }

    /**
     * Rebuild radix tree for a specific method
     */
    private rebuildMethodRadixTree(method: string): void {
        const root = this.createRadixNode("");
        this.radixTrees.set(method, root);

        // Re-add all routes for this method
        for (const route of this.compiledRoutes.values()) {
            if (route.method === method) {
                this.addToRadixTree(route);
            }
        }
    }

    /**
     * Clear all routes
     */
    public clear(): void {
        this.compiledRoutes.clear();
        this.staticRoutes.clear();
        this.dynamicRoutes.clear();
        this.routeCache.clear();
        this.routeAccessCount.clear();
        this.routeRegistry.clear();
        this.initializeRadixTrees();

        this.stats = {
            totalRoutes: 0,
            staticRoutes: 0,
            dynamicRoutes: 0,
            totalExecutions: 0,
            averageExecutionTime: 0,
            cacheHits: 0,
            cacheMisses: 0,
            compiledRoutes: 0,
        };

        this.logger.debug("routing", "All routes cleared");
    }

    /**
     * Get all registered routes
     */
    public getRoutes(): CompiledRoute[] {
        return Array.from(this.compiledRoutes.values());
    }

    /**
     * Get routes for a specific method
     */
    public getRoutesByMethod(method: string): CompiledRoute[] {
        return Array.from(this.compiledRoutes.values()).filter(
            (route) => route.method === method.toUpperCase()
        );
    }

    /**
     * Get radix tree visualization for debugging
     */
    public visualizeRadixTree(method?: string): string {
        const methods = method
            ? [method.toUpperCase()]
            : Array.from(this.radixTrees.keys());
        const lines: string[] = [];

        for (const m of methods) {
            const root = this.radixTrees.get(m);
            if (!root) continue;

            lines.push(`\n=== ${m} Routes ===`);
            this.visualizeNode(root, "", true, lines);
        }

        return lines.join("\n");
    }

    /**
     * Recursively visualize a radix tree node
     */
    private visualizeNode(
        node: RadixTreeNode,
        prefix: string,
        isLast: boolean,
        lines: string[]
    ): void {
        if (node.segment) {
            const connector = isLast ? "└── " : "├── ";
            const segment = node.isParam
                ? `[${node.paramName}${
                      node.paramType ? `<${node.paramType}>` : ""
                  }]`
                : node.isWildcard
                ? "[*]"
                : node.segment;

            const routeInfo =
                node.routes.size > 0
                    ? ` → ${Array.from(node.routes.keys()).join(", ")}`
                    : "";

            lines.push(`${prefix}${connector}${segment}${routeInfo}`);
        }

        const children = Array.from(node.children.values());
        const childPrefix = prefix + (isLast ? "    " : "│   ");

        for (let i = 0; i < children.length; i++) {
            this.visualizeNode(
                children[i],
                childPrefix,
                i === children.length - 1,
                lines
            );
        }
    }

    /**
     * Get cache statistics
     */
    public getCacheStats(): {
        size: number;
        maxSize: number;
        hitRate: number;
        topRoutes: Array<{ route: string; hits: number }>;
    } {
        const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
        const hitRate =
            totalRequests > 0 ? this.stats.cacheHits / totalRequests : 0;

        const topRoutes = Array.from(this.routeAccessCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([route, hits]) => ({ route, hits }));

        return {
            size: this.routeCache.size,
            maxSize: this.options.cacheSize || 1000,
            hitRate,
            topRoutes,
        };
    }

    /**
     * Export route configuration for debugging
     */
    public exportRoutes(): Array<{
        method: string;
        path: string;
        isStatic: boolean;
        params: string[];
        priority: number;
        metadata: Record<string, any>;
    }> {
        return Array.from(this.compiledRoutes.values()).map((route) => ({
            method: route.method,
            path: route.path,
            isStatic: route.isStatic,
            params: route.params,
            priority: route.priority,
            metadata: route.metadata,
        }));
    }

    /**
     * Validate all registered routes for conflicts
     */
    public validateAllRoutes(): Array<{
        route: string;
        conflicts: string[];
    }> {
        const conflicts: Array<{ route: string; conflicts: string[] }> = [];

        const routes = Array.from(this.compiledRoutes.values());

        for (let i = 0; i < routes.length; i++) {
            const route1 = routes[i];
            const routeConflicts: string[] = [];

            for (let j = i + 1; j < routes.length; j++) {
                const route2 = routes[j];

                if (route1.method !== route2.method) continue;

                if (this.routesConflict(route1, route2)) {
                    routeConflicts.push(`${route2.method} ${route2.path}`);
                }
            }

            if (routeConflicts.length > 0) {
                conflicts.push({
                    route: `${route1.method} ${route1.path}`,
                    conflicts: routeConflicts,
                });
            }
        }

        return conflicts;
    }

    /**
     * Check if two routes conflict with each other
     */
    private routesConflict(
        route1: CompiledRoute,
        route2: CompiledRoute
    ): boolean {
        const segments1 = route1.path.split("/").filter(Boolean);
        const segments2 = route2.path.split("/").filter(Boolean);

        if (segments1.length !== segments2.length) return false;

        for (let i = 0; i < segments1.length; i++) {
            const seg1 = segments1[i];
            const seg2 = segments2[i];

            const isParam1 = seg1.startsWith(":");
            const isParam2 = seg2.startsWith(":");

            // Both static and different = no conflict
            if (!isParam1 && !isParam2 && seg1 !== seg2) {
                return false;
            }
        }

        return true;
    }

    /**
     * Get route matching performance metrics
     */
    public getPerformanceMetrics(): {
        averageExecutionTime: number;
        totalExecutions: number;
        cacheHitRate: number;
        staticRouteRatio: number;
        dynamicRouteRatio: number;
    } {
        const totalRequests = this.stats.cacheHits + this.stats.cacheMisses;
        const cacheHitRate =
            totalRequests > 0 ? this.stats.cacheHits / totalRequests : 0;
        const totalRoutes = this.stats.totalRoutes || 1;

        return {
            averageExecutionTime: this.stats.averageExecutionTime,
            totalExecutions: this.stats.totalExecutions,
            cacheHitRate,
            staticRouteRatio: this.stats.staticRoutes / totalRoutes,
            dynamicRouteRatio: this.stats.dynamicRoutes / totalRoutes,
        };
    }

    /**
     * Reset statistics
     */
    public resetStats(): void {
        this.stats.totalExecutions = 0;
        this.stats.averageExecutionTime = 0;
        this.stats.cacheHits = 0;
        this.stats.cacheMisses = 0;
        this.routeAccessCount.clear();

        this.logger.debug("routing", "Statistics reset");
    }

    /**
     * Enable or disable route caching
     */
    public setCacheEnabled(enabled: boolean): void {
        this.options.enableCache = enabled;

        if (!enabled) {
            this.routeCache.clear();
        }

        this.logger.debug(
            "routing",
            `Route caching ${enabled ? "enabled" : "disabled"}`
        );
    }

    /**
     * Set cache size limit
     */
    public setCacheSize(size: number): void {
        if (size < 0) {
            throw new Error("Cache size must be non-negative");
        }

        this.options.cacheSize = size;

        // Trim cache if necessary
        while (this.routeCache.size > size) {
            this.evictLeastUsedRoute();
        }

        this.logger.debug("routing", `Cache size set to ${size}`);
    }

    /**
     * Warmup cache with commonly accessed routes
     */
    public warmupCache(routes: Array<{ method: string; path: string }>): void {
        this.logger.debug(
            "routing",
            `Warming up cache with ${routes.length} routes...`
        );

        for (const { method, path } of routes) {
            const routeKey = this.generateRouteKey(method, path);
            const route = this.compiledRoutes.get(routeKey);

            if (route) {
                this.routeCache.set(routeKey, route);
                this.routeAccessCount.set(routeKey, 10); // High initial count
            }
        }

        this.logger.debug(
            "routing",
            `Cache warmup complete: ${this.routeCache.size} routes cached`
        );
    }

    /**
     * Get health status of the routing engine
     */
    public getHealthStatus(): {
        status: "healthy" | "degraded" | "unhealthy";
        metrics: {
            totalRoutes: number;
            cacheSize: number;
            avgExecutionTime: number;
            cacheHitRate: number;
        };
        issues: string[];
    } {
        const issues: string[] = [];
        const metrics = this.getPerformanceMetrics();

        // Check for performance issues
        if (metrics.averageExecutionTime > 100) {
            issues.push("High average execution time (>100ms)");
        }

        if (metrics.cacheHitRate < 0.5 && this.stats.totalExecutions > 100) {
            issues.push("Low cache hit rate (<50%)");
        }

        if (this.stats.totalRoutes > 10000) {
            issues.push("Very high number of routes (>10000)");
        }

        const conflicts = this.validateAllRoutes();
        if (conflicts.length > 0) {
            issues.push(`${conflicts.length} route conflicts detected`);
        }

        const status =
            issues.length === 0
                ? "healthy"
                : issues.length <= 2
                ? "degraded"
                : "unhealthy";

        return {
            status,
            metrics: {
                totalRoutes: this.stats.totalRoutes,
                cacheSize: this.routeCache.size,
                avgExecutionTime: metrics.averageExecutionTime,
                cacheHitRate: metrics.cacheHitRate,
            },
            issues,
        };
    }
}

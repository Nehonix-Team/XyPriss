/**
 * Type definitions for FastRouteEngine
 * Ultra-optimized routing system types
 */

import type { XyPrisRequest, XyPrisResponse } from "./httpServer.type";

/**
 * Fast route handler with context
 */
export type FastRouteHandler = (
    req: XyPrisRequest,
    res: XyPrisResponse,
    context: FastRouteContext
) => void | Promise<void>;

/**
 * Route execution context
 */
export interface FastRouteContext {
    route: string;
    method: string;
    params: Record<string, any>;
    metadata: Record<string, any>;
}

/**
 * Fast route configuration
 */
export interface FastRouteConfig {
    /** HTTP method */
    method: string;
    
    /** Route path (supports :param and :param<type> syntax) */
    path: string;
    
    /** Route handler */
    handler: FastRouteHandler;
    
    /** Optional middleware chain */
    middleware?: FastRouteHandler[];
    
    /** Route priority (higher = executed first) */
    priority?: number;
    
    /** Custom metadata */
    metadata?: Record<string, any>;
}

/**
 * Batch route configuration
 */
export interface BatchRouteConfig {
    /** Array of routes to register */
    routes: FastRouteConfig[];
    
    /** Auto-optimize after registration */
    optimize?: boolean;
}

/**
 * Compiled route for fast execution
 */
export interface CompiledRoute {
    method: string;
    path: string;
    isStatic: boolean;
    params: string[];
    pattern: RegExp | null;
    handlers: FastRouteHandler[];
    priority: number;
    metadata: Record<string, any>;
}

/**
 * Route tree node for radix tree
 */
export interface RouteNode {
    segment: string;
    isParam: boolean;
    paramName?: string;
    children: Map<string, RouteNode>;
    handlers: Map<string, CompiledRoute>;
}

/**
 * Route matcher for typed parameters
 */
export interface RouteMatcher {
    pattern: RegExp;
    extract: (value: string) => any;
}

/**
 * Route execution statistics
 */
export interface RouteExecutionStats {
    totalRoutes: number;
    staticRoutes: number;
    dynamicRoutes: number;
    totalExecutions: number;
    averageExecutionTime: number;
    cacheHits: number;
    cacheMisses: number;
    compiledRoutes: number;
}

/**
 * FastRouteEngine options
 */
export interface FastRouteEngineOptions {
    /** Enable route caching */
    enableCache?: boolean;
    
    /** Maximum cache size */
    cacheSize?: number;
    
    /** Enable statistics tracking */
    enableStats?: boolean;
    
    /** Enable JIT compilation */
    enableJIT?: boolean;
    
    /** Enable predictive optimization */
    enablePredictive?: boolean;
    
    /** Auto-optimize routes */
    autoOptimize?: boolean;
    
    /** Optimization threshold (executions before optimization) */
    optimizationThreshold?: number;
}

/**
 * FastAPI interface for route registration
 */
export interface FastAPIInterface {
    /** Register GET route */
    get(path: string, ...handlers: FastRouteHandler[]): FastAPIInterface;
    
    /** Register POST route */
    post(path: string, ...handlers: FastRouteHandler[]): FastAPIInterface;
    
    /** Register PUT route */
    put(path: string, ...handlers: FastRouteHandler[]): FastAPIInterface;
    
    /** Register DELETE route */
    delete(path: string, ...handlers: FastRouteHandler[]): FastAPIInterface;
    
    /** Register PATCH route */
    patch(path: string, ...handlers: FastRouteHandler[]): FastAPIInterface;
    
    /** Register OPTIONS route */
    options(path: string, ...handlers: FastRouteHandler[]): FastAPIInterface;
    
    /** Register HEAD route */
    head(path: string, ...handlers: FastRouteHandler[]): FastAPIInterface;
    
    /** Register route for all HTTP methods */
    all(path: string, ...handlers: FastRouteHandler[]): FastAPIInterface;
    
    /** Add global middleware */
    use(...middleware: FastRouteHandler[]): FastAPIInterface;
    
    /** Batch register routes */
    routes(configs: FastRouteConfig[]): FastAPIInterface;
    
    /** Create route group with prefix */
    group(prefix: string, builder: (group: RouteGroupBuilder) => void): FastAPIInterface;
    
    /** Register single route with full configuration */
    route(config: FastRouteConfig): FastAPIInterface;
    
    /** Optimize routes based on access patterns */
    optimize(): FastAPIInterface;
    
    /** Get execution statistics */
    getStats(): RouteExecutionStats;
    
    /** Clear all routes */
    clear(): FastAPIInterface;
    
    /** Get underlying engine */
    getEngine(): any;
}

/**
 * Route group builder interface
 */
export interface RouteGroupBuilder {
    /** Add middleware to group */
    use(...middleware: FastRouteHandler[]): RouteGroupBuilder;
    
    /** Register GET route in group */
    get(path: string, ...handlers: FastRouteHandler[]): RouteGroupBuilder;
    
    /** Register POST route in group */
    post(path: string, ...handlers: FastRouteHandler[]): RouteGroupBuilder;
    
    /** Register PUT route in group */
    put(path: string, ...handlers: FastRouteHandler[]): RouteGroupBuilder;
    
    /** Register DELETE route in group */
    delete(path: string, ...handlers: FastRouteHandler[]): RouteGroupBuilder;
    
    /** Register PATCH route in group */
    patch(path: string, ...handlers: FastRouteHandler[]): RouteGroupBuilder;
    
    /** Register route for all HTTP methods in group */
    all(path: string, ...handlers: FastRouteHandler[]): RouteGroupBuilder;
}

import { NextFunction, RequestHandler } from "express";
import {
    UltraFastApp,
    MiddlewareConfiguration,
    MiddlewarePriority,
    CustomMiddleware,
    MiddlewareInfo,
    MiddlewareStats,
} from "../types";
import { PerformanceProfiler } from "../../server/optimization/PerformanceProfiler";
import { ExecutionPredictor } from "../../server/optimization/ExecutionPredictor";
import { SecureCacheAdapter } from "../../cache";

/**
 *  Middleware Manager Options
 */
export interface MiddlewareManagerOptions {
    server?: {
        trustProxy?: boolean;
        jsonLimit?: string;
        urlEncodedLimit?: string;
        enableMiddleware?: boolean;
    };
    security?: {
        helmet?: boolean;
        cors?: boolean;
        rateLimit?: boolean;
        customHeaders?: Record<string, string>;
    };
    performance?: {
        compression?: boolean;
        enableOptimization?: boolean;
        enableCaching?: boolean;
        enablePerformanceTracking?: boolean;
        cacheWarming?: boolean;
    };
    middleware?: MiddlewareConfiguration;
}

/**
 *  Middleware Manager Dependencies
 */
export interface MiddlewareManagerDependencies {
    app: UltraFastApp;
    cache: SecureCacheAdapter;
    performanceProfiler: PerformanceProfiler;
    executionPredictor: ExecutionPredictor;
    optimizationEnabled: boolean;
    optimizationStats: any;
    handleUltraFastPath: (
        req: any,
        res: any,
        next: NextFunction,
        requestId: string,
        classification: any
    ) => Promise<void>;
    handleFastPath: (
        req: any,
        res: any,
        next: NextFunction,
        requestId: string,
        classification: any
    ) => Promise<void>;
    handleStandardPath: (
        req: any,
        res: any,
        next: NextFunction,
        requestId: string,
        classification: any
    ) => Promise<void>;
}

/**
 * Middleware Registry Entry
 */
export interface MiddlewareRegistryEntry {
    id: string;
    name: string;
    handler: RequestHandler;
    priority: MiddlewarePriority;
    order: number;
    routes?: string[];
    enabled: boolean;
    cacheable: boolean;
    ttl?: number;
    metadata: Record<string, any>;
    stats: {
        executionCount: number;
        totalExecutionTime: number;
        averageExecutionTime: number;
        lastExecuted?: Date;
        cacheHits: number;
        cacheMisses: number;
        errors: number;
    };
}

/**
 * Middleware Execution Result
 */
export interface MiddlewareExecutionResult {
    success: boolean;
    executionTime: number;
    cached: boolean;
    error?: Error;
    metadata?: Record<string, any>;
}

/**
 * Middleware Cache Entry
 */
export interface MiddlewareCacheEntry {
    result: any;
    timestamp: number;
    ttl: number;
    hits: number;
    middleware: string;
}

/**
 * Middleware Optimization Config
 */
export interface MiddlewareOptimizationConfig {
    enableCaching: boolean;
    enableBatching: boolean;
    enablePrioritization: boolean;
    enablePerformanceTracking: boolean;
    cacheWarming: boolean;
    optimizationThreshold: number;
    maxCacheSize: number;
    defaultTTL: number;
}

/**
 * Built-in Middleware Types
 */
export type BuiltInMiddlewareType =
    | "security"
    | "compression"
    | "rateLimit"
    | "cors"
    | "helmet"
    | "bodyParser"
    | "trustProxy";

/**
 * Middleware Performance Metrics
 */
export interface MiddlewarePerformanceMetrics {
    totalRequests: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    fastestExecution: number;
    slowestExecution: number;
    cacheHitRate: number;
    errorRate: number;
    throughput: number; // requests per second
    optimizationGain: number; // percentage improvement
}

/**
 * Middleware Route Matcher
 */
export interface MiddlewareRouteMatcher {
    pattern: string | RegExp;
    methods?: string[];
    exact?: boolean;
    caseSensitive?: boolean;
}

/**
 *  Middleware Manager Interface
 */
export interface IMiddlewareManager {
    // Core middleware management
    register(
        middleware: CustomMiddleware | RequestHandler,
        options?: {
            name?: string;
            priority?: MiddlewarePriority;
            routes?: string[];
            cacheable?: boolean;
            ttl?: number;
        }
    ): string; // returns middleware ID

    unregister(id: string): boolean;
    enable(id: string): boolean;
    disable(id: string): boolean;

    // Built-in middleware management
    enableSecurity(options?: any): void;
    enableCompression(options?: any): void;
    enableRateLimit(options?: any): void;
    enableCors(options?: any): void;

    // Information and statistics
    getInfo(id?: string): MiddlewareInfo | MiddlewareInfo[];
    getStats(): MiddlewareStats;
    getPerformanceMetrics(): MiddlewarePerformanceMetrics;

    // Optimization and caching
    optimize(): Promise<void>;
    warmCache(): Promise<void>;
    clearCache(): void;

    // Execution and routing
    executeMiddleware(req: any, res: any, next: NextFunction): Promise<void>;
    matchRoute(path: string, method: string): MiddlewareRegistryEntry[];

    // Configuration
    configure(config: MiddlewareConfiguration): void;
    getConfiguration(): MiddlewareConfiguration;

    // Lifecycle
    initialize(): Promise<void>;
    shutdown(): Promise<void>;
}


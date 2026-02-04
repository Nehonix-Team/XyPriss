/**
 * Ultra-Fast Plugin System Types
 *
 * Comprehensive type definitions for the XyPrissJS plugin architecture
 * designed to achieve <1ms execution overhead while maintaining security.
 */

import { Request, Response, NextFunction } from "../../../types";
import { SecureCacheAdapter } from "../../../cache";
import { Logger } from "../../../../shared/logger";
import { InterceptedConsoleCall } from "../../../server/components/fastapi/console/types";

// ===== CORE PLUGIN TYPES =====

/**
 * Plugin execution phases for optimal performance routing
 */
export enum PluginType {
    PRE_REQUEST = "pre-request", // <0.5ms - Request preprocessing, parsing optimization
    SECURITY = "security", // <2ms - Authentication, authorization, validation
    NETWORK = "network", // <1ms - Network operations, connection management, proxy, compression
    CACHE = "cache", // <0.5ms - Cache operations, hit/miss handling
    PERFORMANCE = "performance", // <0.3ms - Metrics collection, monitoring
    POST_RESPONSE = "post-response", // <0.2ms - Cleanup, logging, analytics
    MIDDLEWARE = "middleware", // <1ms - Custom XyPriss middleware integration
    NATIVE = "native", // <0.1ms - WebAssembly/native optimizations
}

/**
 * Plugin execution priority for performance optimization
 */
export enum PluginPriority {
    CRITICAL = 0, // Ultra-fast execution, <0.1ms
    HIGH = 1, // High priority, <0.5ms
    NORMAL = 2, // Standard priority, <1ms
    LOW = 3, // Low priority, <2ms
    BACKGROUND = 4, // Background execution, async
}

/**
 * Plugin execution context with performance tracking
 */
export interface PluginExecutionContext {
    // Request context
    req: Request;
    res: Response;
    next: NextFunction;

    // Performance tracking
    startTime: number;
    executionId: string;

    // XyPrissJS utilities
    cache: SecureCacheAdapter;

    // Plugin-specific data
    pluginData: Map<string, any>;

    // Security context
    security: {
        isAuthenticated: boolean;
        userId?: string;
        roles: string[];
        permissions: string[];
    };

    // Performance metrics
    metrics: {
        requestStartTime: number;
        pluginExecutionTimes: Map<string, number>;
        cacheHits: number;
        cacheMisses: number;
    };
}

/**
 * Plugin execution result with performance data
 */
export interface PluginExecutionResult {
    success: boolean;
    executionTime: number;
    error?: Error;
    data?: any;
    shouldContinue: boolean;
    cacheData?: {
        key: string;
        value: any;
        ttl?: number;
    };
}

/**
 * Base plugin interface for ultra-fast execution
 */
export interface BasePlugin {
    // Plugin metadata
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly type: PluginType;
    readonly priority: PluginPriority;

    // Performance configuration
    readonly maxExecutionTime: number; // Maximum allowed execution time in ms
    readonly isAsync: boolean;
    readonly isCacheable: boolean;

    // Plugin lifecycle
    initialize?(context: PluginInitializationContext): Promise<void> | void;
    execute(
        context: PluginExecutionContext,
    ): Promise<PluginExecutionResult> | PluginExecutionResult;
    cleanup?(context: PluginExecutionContext): Promise<void> | void;

    // Performance optimization
    precompile?(): Promise<void> | void;
    warmup?(context: PluginExecutionContext): Promise<void> | void;

    // Logging & Monitoring Hooks
    /**
     * Hook triggered when a console log is intercepted by the system.
     * Requires PLG.LOGGING.CONSOLE_INTERCEPT permission.
     */
    onConsoleIntercept?(log: InterceptedConsoleCall): void;
}

/**
 * Performance monitoring plugin interface
 */
export interface PerformancePlugin extends BasePlugin {
    readonly type: PluginType.PERFORMANCE;

    // Performance monitoring methods
    startTimer(name: string): void;
    endTimer(name: string): number;
    recordMetric(name: string, value: number): void;
    getMetrics(): PerformanceMetrics;

    // Performance thresholds
    readonly performanceThresholds: {
        responseTime: number;
        memoryUsage: number;
        cpuUsage: number;
    };
}

/**
 * Cache optimization plugin interface
 */
export interface CachePlugin extends BasePlugin {
    readonly type: PluginType.CACHE;

    // Cache operations
    shouldCache?(context: PluginExecutionContext): boolean;
    generateCacheKey?(context: PluginExecutionContext): string;
    getCacheTTL?(context: PluginExecutionContext): number;
    invalidateCache?(pattern: string): Promise<void>;

    // Cache configuration
    readonly cacheStrategy: "memory" | "redis" | "hybrid";
    readonly compressionEnabled: boolean;
    readonly encryptionEnabled: boolean;
}

/**
 * Native/WebAssembly plugin interface for maximum performance
 */
export interface NativePlugin extends BasePlugin {
    readonly type: PluginType.NATIVE;

    // Native execution
    executeNative?(buffer: ArrayBuffer): ArrayBuffer;
    loadWasm?(wasmPath: string): Promise<WebAssembly.Module>;

    // Native configuration
    readonly wasmModule?: WebAssembly.Module;
    readonly nativeLibrary?: string;
}

// ===== PLUGIN CONFIGURATION TYPES =====

/**
 * Plugin initialization context
 */
export interface PluginInitializationContext {
    cache: SecureCacheAdapter;
    config: PluginConfiguration;
    logger: Logger;
}

/**
 * Plugin configuration interface
 */
export interface PluginConfiguration {
    // Performance settings
    maxExecutionTime: number;
    enableProfiling: boolean;
    enableCaching: boolean;

    // Security settings
    enableEncryption: boolean;
    enableAuditLogging: boolean;
    securityLevel: "basic" | "enhanced" | "maximum";

    // Plugin-specific settings
    customSettings: Record<string, any>;
}

/**
 * Performance metrics interface
 */
export interface PerformanceMetrics {
    totalExecutions: number;
    averageExecutionTime: number;
    minExecutionTime: number;
    maxExecutionTime: number;
    errorCount: number;
    successRate: number;
    memoryUsage: number;
    cpuUsage: number;
    lastExecuted: Date;
}

/**
 * Plugin registry configuration
 */
export interface PluginRegistryConfig {
    maxPlugins: number;
    enableHotReload: boolean;
    enableProfiling: boolean;
    performanceThresholds: {
        maxExecutionTime: number;
        maxMemoryUsage: number;
        maxCpuUsage: number;
    };
}

/**
 * Plugin execution statistics
 */
export interface PluginExecutionStats {
    pluginId: string;
    executionCount: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
    errorCount: number;
    lastExecuted: Date;
    performanceScore: number;
}

// ===== PLUGIN EVENTS =====

/**
 * Plugin event types for monitoring and debugging
 */
export enum PluginEventType {
    PLUGIN_REGISTERED = "plugin:registered",
    PLUGIN_UNREGISTERED = "plugin:unregistered",
    PLUGIN_EXECUTED = "plugin:executed",
    PLUGIN_ERROR = "plugin:error",
    PLUGIN_TIMEOUT = "plugin:timeout",
    PERFORMANCE_THRESHOLD_EXCEEDED = "performance:threshold:exceeded",
}

/**
 * Plugin event data
 */
export interface PluginEvent {
    type: PluginEventType;
    pluginId: string;
    timestamp: Date;
    data?: any;
    error?: Error;
    executionTime?: number;
}


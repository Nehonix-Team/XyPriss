/**
 * Plugin System Types
 */

import type {
    Request,
    Response,
    NextFunction,
    XyPrissApp,
    ServerOptions,
} from "../../types/types";
import type { InternalServerOptions } from "../../types/ServerOptions";

import type { InterceptedConsoleCall } from "../../server/components/fastapi/console/types";

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
    CRITICAL = 0, // High-performance execution, <0.1ms
    HIGH = 1, // High priority, <0.5ms
    NORMAL = 2, // Standard priority, <1ms
    LOW = 3, // Low priority, <2ms
    BACKGROUND = 4, // Background execution, async
}

export interface XyPrissServer {
    app: XyPrissApp;
    options?: InternalServerOptions;
    [key: string]: any; // Allow plugins to extend server
}

/**
 * Restricted XyPrissApp for plugins.
 * Only allows HTTP methods and middleware registration.
 */
export interface PluginXyPrissApp {
    get(path: string, ...handlers: any[]): void;
    post(path: string, ...handlers: any[]): void;
    put(path: string, ...handlers: any[]): void;
    delete(path: string, ...handlers: any[]): void;
    patch(path: string, ...handlers: any[]): void;
    options(path: string, ...handlers: any[]): void;
    head(path: string, ...handlers: any[]): void;
    connect(path: string, ...handlers: any[]): void;
    trace(path: string, ...handlers: any[]): void;
    all(path: string, ...handlers: any[]): void;
    use(...args: any[]): void;
}

/**
 * Restricted XyPrissServer for plugins.
 * Only allows access to a restricted set of application methods.
 */
export interface PluginServer {
    /**
     * The application instance with restricted access.
     * Only HTTP methods (get, post, etc.) and 'use' are available.
     */
    app: PluginXyPrissApp;
}

export interface PluginStats {
    name: string;
    version: string;
    description?: string;
    enabled: boolean;
    permissions: {
        allowedHooks: string[] | "*";
        deniedHooks: string[];
        policy: "allow" | "deny";
    };
    uid?: string;
    dependencies: string[];
}

export interface PluginManagement {
    getStats: () => PluginStats[];
    setPermission: (
        pluginName: string,
        hookId: string,
        allowed: boolean,
        by?: string,
    ) => void;
    toggle: (pluginName: string, enabled: boolean) => void;
}

export interface OpsServerManager {
    /**
     * Deploys a fully configured independent XyPriss auxiliary server.
     * Use this for internal admin dashboards, metric scrapers, or documentation servers.
     */
    createAuxiliaryServer: (options: ServerOptions) => XyPrissApp;

    /**
     * Returns the global route registry for documentation generation.
     */
    getRouteRegistry: () => any[];
}

export interface XyPrissPlugin {
    // Required metadata
    name: string;
    version: string;
    type?: string;
    description?: string;

    /**
     * @internal - Captured project root of the plugin.
     * Used for contract security verification.
     */
    __root__?: string;

    /**
     * @internal - Unique technical identifier for the plugin instance.
     * Generated at registration based on fingerprint.
     */
    uid?: string;

    /**
     * @internal - Metadata fingerprint used for duplicate discovery and unique identification.
     */
    fingerprint?: string;

    // Optional dependencies
    dependencies?: string[];

    // Lifecycle hooks (all optional)
    onRegister?(
        error?: Error | null,
        // server?: PluginServer,
        // config?: ServerOptions | undefined,
    ): void | Promise<void>;
    onServerStart?(server: PluginServer): void | Promise<void>;
    onServerReady?(server: PluginServer): void | Promise<void>;
    onServerStop?(server: PluginServer): void | Promise<void>;

    // Request/Response hooks (optional)
    onRequest?(
        req: Request,
        res: Response,
        next: NextFunction,
    ): void | Promise<void>;
    onResponse?(req: Request, res: Response): void | Promise<void>;

    onError?(
        error: Error,
        req: Request,
        res: Response,
        next?: NextFunction,
    ): void | Promise<void>;

    /**
     * Hook triggered when a security attack or problem is detected
     */
    onSecurityAttack?(
        attackData: any,
        req: Request,
        res: Response,
    ): void | Promise<void>;

    /**
     * Hook triggered to report the response time of a request
     */
    onResponseTime?(
        responseTime: number,
        req: Request,
        res: Response,
    ): void | Promise<void>;

    /**
     * Hook triggered when a route generates a 500 error
     */
    onRouteError?(
        error: Error,
        req: Request,
        res: Response,
    ): void | Promise<void>;

    /**
     * Hook triggered when a rate limit is reached
     */
    onRateLimit?(
        limitData: any,
        req: Request,
        res: Response,
    ): void | Promise<void>;

    /**
     * Hook triggered when a console log is intercepted by the system.
     *
     * This hook allows plugins to monitor, analyze, or redirect all console output
     * (log, info, warn, error, debug, etc.) across the entire application.
     *
     * @param log - The intercepted console call data including method, arguments, and metadata.
     * @permission XHS.PERM.LOGGING.CONSOLE_INTERCEPT - Required to receive log data.
     * @performance This hook is executed synchronously; preserve performance by avoiding heavy tasks.
     * @security Sensitive data may be present in logs; handle with extreme care.
     * @default Disabled by default for security.
     */
    onConsoleIntercept?(log: InterceptedConsoleCall): void | Promise<void>;

    // Route registration (optional)
    registerRoutes?(app: XyPrissApp): void;

    // Middleware (optional)
    middleware?: any | any[];
    middlewarePriority?: "first" | "normal" | "last";

    /**
     * Hook for plugin management
     * Only called if the plugin has MANAGE_PLUGINS permission
     */
    managePlugins?(manager: PluginManagement): void | Promise<void>;

    /**
     * Advanced Ops Hook: Request and configure auxiliary servers (e.g., for Admin UI, Docs)
     * Requires strict Ops permissions to bind to new ports.
     * @permission XHS.PERM.OPS.AUXILIARY_SERVER
     */
    onAuxiliaryServerDeploy?(
        ops: OpsServerManager,
        server: XyPrissServer,
    ): void | Promise<void>;
}

export type PluginCreator = (config?: any) => XyPrissPlugin;

export interface PluginConfig {
    // Built-in plugins
    // compression?: any;
    // rateLimit?: any;
    // proxy?: any;
    connection?: any;

    // Custom plugins registration
    register?: Array<XyPrissPlugin | PluginCreator>;

    /** Route optimization plugin configuration */
    routeOptimization?: {
        enabled?: boolean;
        analysisInterval?: number;
        optimizationThreshold?: number;
        popularityWindow?: number;
        maxTrackedRoutes?: number;
        autoOptimization?: boolean;
        customRules?: Array<{
            pattern: string;
            minHits: number;
            maxResponseTime: number;
            cacheStrategy: "aggressive" | "moderate" | "conservative";
            preloadEnabled?: boolean;
        }>;
        onOptimization?: (route: string, optimization: string) => void;
        onAnalysis?: (stats: any[]) => void;
    };

    /** Server maintenance plugin configuration */
    serverMaintenance?: {
        enabled?: boolean;
        checkInterval?: number;
        errorThreshold?: number;
        memoryThreshold?: number;
        responseTimeThreshold?: number;
        logRetentionDays?: number;
        maxLogFileSize?: number;
        autoCleanup?: boolean;
        autoRestart?: boolean;
        onIssueDetected?: (issue: any) => void;
        onMaintenanceComplete?: (actions: string[]) => void;
    };

    /**
     * Allow lifecycle hooks (onServerStart, onServerReady, onServerStop) to execute
     * by default even if not explicitly whitelisted in allowedHooks.
     * @default false (Zero-Trust)
     */
    allowLifecycleByDefault?: boolean;
}


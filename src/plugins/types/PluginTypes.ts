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
    options?: ServerOptions;
    [key: string]: any; // Allow plugins to extend server
}

/**
 * Restricted XyPrissApp for plugins.
 * Only allows HTTP methods, middleware registration, and — conditionally — server configs.
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

    /**
     * The full server configuration options passed to `createServer()` by the host application.
     *
     * This property is **permission-gated** at runtime. The security facade will return
     * `undefined` unless the plugin has been explicitly granted the
     * `XHS.PERM.SECURITY.CONFIGS` permission in the host project's `allowedHooks`.
     *
     * Wildcards (`"*"`) do NOT grant this permission — it must be declared explicitly.
     *
     * Typical use cases:
     *  - Reading the server port or host for building absolute URLs in generated docs.
     *  - Detecting the runtime environment (`env: "production" | "development"`) to
     *    adapt plugin behavior without hardcoding values.
     *  - Accessing feature flags passed through custom server options.
     *
     * @permission XHS.PERM.SECURITY.CONFIGS
     *
     * @example
     * // Inside onAuxiliaryServerDeploy or onServerStart:
     * const port = server.app.configs?.server?.port ?? 3000;
     * const env  = server.app.configs?.env ?? "development";
     */
    configs?: ServerOptions;
}

/**
 * Restricted XyPrissServer for plugins.
 *
 * This is the facade object injected as the `server` argument in lifecycle hooks
 * such as `onServerStart`, `onServerReady`, and `onAuxiliaryServerDeploy`.
 * It intentionally exposes only a safe subset of the real server's capabilities.
 *
 * The engine's security layer intercepts every property access on `server.app`
 * and enforces per-plugin permission checks before delegating to the real
 * underlying application instance.
 */
export interface PluginServer {
    /**
     * The restricted application facade.
     *
     * Provides access to HTTP method registrars (`get`, `post`, etc.), `use()`,
     * and the conditional `configs` property. Any attempt to access properties
     * not in this interface will be silently blocked by the security layer.
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
    description: string;

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
     * Advanced Ops Hook — Deploy an Independent Auxiliary Server
     *
     * This hook enables a plugin to spawn a fully isolated XyPriss server instance
     * on a separate port, completely independent from the main application server.
     * It is the recommended pattern for deploying internal-only tooling such as:
     *
     *  - Admin dashboards and back-office UIs
     *  - API documentation servers (e.g., Swagger, Redoc)
     *  - Internal metrics scrapers (e.g., Prometheus exposition endpoint)
     *  - Dedicated WebSocket or SSE servers
     *  - Debug/introspection interfaces (development only)
     *
     * --- Execution Context ---
     * This hook is called once during the server initialization phase, after
     * `onServerStart` has fired on all plugins. The auxiliary server created here
     * operates as a completely separate process listener and does NOT share
     * middleware, routes, or request lifecycle with the main server.
     *
     * --- Security Model ---
     * This is a **privileged Ops hook**. It will not be called unless the plugin
     * has been explicitly granted the `XHS.PERM.OPS.AUXILIARY_SERVER` permission
     * in the host project's configuration. Attempting to use it without the
     * required permission will result in a silent no-op (the engine will block
     * the hook invocation before your code is reached).
     *
     * The `server` argument is a restricted facade of the main XyPrissServer
     * instance (a `PluginServer`). It exposes only the HTTP method registrars
     * (`get`, `post`, etc.) and `use()`, scoped to your plugin's namespace.
     * Direct access to `server.app` internals or low-level engine properties
     * is blocked by the security layer.
     *
     * --- Parameters ---
     * @param ops - The `OpsServerManager` context. Provides two capabilities:
     *
     *   `ops.createAuxiliaryServer(options: ServerOptions): XyPrissApp`
     *   Spawns and returns a new, fully configured XyPriss app instance bound
     *   to the port specified in `options.server.port`. All standard XyPriss
     *   features (routing, middleware, logging) are available on this instance.
     *   The performance and plugin subsystems are disabled by default to avoid
     *   recursive initialization.
     *
     *   `ops.getRouteRegistry(): RouteEntry[]`
     *   Returns a snapshot of all routes registered on the MAIN server at the
     *   time of the call. Useful for generating live documentation or dashboards
     *   that reflect the host application's actual API surface.
     *
     * @param server - A restricted facade of the main XyPrissServer. Exposes
     *   only the HTTP methods and `use()` of the main `app` instance, scoped
     *   to this plugin's namespace. Use this to cross-register a route on the
     *   main server (e.g., a redirect from `/docs` on the main port to the
     *   auxiliary docs port) without full access to internal engine state.
     *
     * @permission XHS.PERM.OPS.AUXILIARY_SERVER
     *   Must be declared in `xfpm.permissions` inside `package.json` AND
     *   explicitly listed in `allowedHooks` in the host project's plugin
     *   configuration. Wildcards (`"*"`) do NOT grant this privileged hook.
     *
     * @example
     * // Use case 1: Spawn a dedicated Swagger documentation server
     * async onAuxiliaryServerDeploy(ops, server) {
     *     const routes = ops.getRouteRegistry();
     *     const openApiSpec = generateOpenApiSpec(routes);
     *
     *     const docsApp = ops.createAuxiliaryServer({
     *         server: { port: 9001, host: "127.0.0.1" },
     *         logging: { enabled: true, level: "warn" },
     *     });
     *
     *     docsApp.get("/openapi.json", (req, res) => {
     *         res.json(openApiSpec);
     *     });
     *
     *     docsApp.get("/", (req, res) => {
     *         res.send(renderSwaggerUI("/openapi.json"));
     *     });
     *
     *     // Optionally register a redirect on the main server (scoped to plugin namespace)
     *     server.app.get("/my-plugin/docs", (req, res) => {
     *         res.redirect("http://localhost:9001");
     *     });
     * }
     *
     * @example
     * // Use case 2: Internal Prometheus metrics endpoint (never exposed publicly)
     * async onAuxiliaryServerDeploy(ops, _server) {
     *     const metricsApp = ops.createAuxiliaryServer({
     *         server: { port: 9090, host: "127.0.0.1" },
     *         logging: { enabled: false },
     *     });
     *
     *     metricsApp.get("/metrics", (req, res) => {
     *         res.setHeader("Content-Type", "text/plain; version=0.0.4");
     *         res.send(collectMetrics());
     *     });
     * }
     */
    onAuxiliaryServerDeploy?(
        ops: OpsServerManager,
        server: PluginServer,
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


import { SecureCacheAdapter } from "xypriss-security";
import { RequestHandler, XyPrissApp, ServerOptions } from ".";
import { Server as HttpServer } from "http";
import { RedirectOptions, RedirectServerInstance, RedirectStats } from ".";
import { XyPrissMiddlewareAPI } from "./middleware-api.types";
import { MultiServerInstance } from "../server/components/multi-server/MultiServerManager";
import { ConsoleInterceptionConfig } from "../server/components/fastapi/console/types";

/**
 * XyPriss application interface with advanced features.
 *
 * Extends the standard application with high-performance caching,
 * performance optimization, security features, clustering, and
 * comprehensive monitoring capabilities.
 *
 * @interface XyPrissApp
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 *
 * @example
 * ```typescript
 * import { createServer } from 'xypriss';
 *
 * const app = createServer({
 *   cache: { strategy: 'hybrid' },
 *   performance: { optimizationEnabled: true }
 * });
 *
 * // Use enhanced route methods with caching
 * app.getWithCache('/api/users', {
 *   cache: { ttl: 300, tags: ['users'] },
 *   security: { auth: true }
 * }, async (req, res) => {
 *   const users = await getUsersFromDB();
 *   res.success(users);
 * });
 *
 * // Start the server
 * await app.start();
 * ```
 */
export interface XyApp {
    // Core HTTP methods
    get(path: string, ...handlers: RequestHandler[]): void;
    post(path: string, ...handlers: RequestHandler[]): void;
    put(path: string, ...handlers: RequestHandler[]): void;
    delete(path: string, ...handlers: RequestHandler[]): void;
    patch(path: string, ...handlers: RequestHandler[]): void;
    options(path: string, ...handlers: RequestHandler[]): void;
    head(path: string, ...handlers: RequestHandler[]): void;
    connect(path: string, ...handlers: RequestHandler[]): void;
    trace(path: string, ...handlers: RequestHandler[]): void;
    all(path: string, ...handlers: RequestHandler[]): void;

    /**
     * Register a route-level redirect from one path to another path or external URL.
     *
     * This is a convenience API for creating permanent (301) or temporary (302)
     * redirects at the route level. It is more efficient than registering a full
     * route handler for simple redirection use cases.
     *
     * @param from - The source path to redirect from (e.g., "/old-page").
     * @param to - The destination path or full URL (e.g., "/new-page" or "https://example.com").
     * @param statusCode - HTTP status code to use (default: 301). Accepts 301 or 302.
     *
     * @example
     * ```typescript
     * // Permanent redirect to a new internal path
     * app.redirect("/old-api", "/v2/api");
     *
     * // Temporary redirect to an external URL
     * app.redirect("/promo", "https://promo.example.com", 302);
     * ```
     */
    redirect(from: string, to: string, statusCode?: 301 | 302): void;

    // Middleware
    use(...args: any[]): void;

    // Settings
    set(setting: string, val: any): void;
    getSetting(setting: string): any;
    enabled(setting: string): boolean;
    disabled(setting: string): boolean;
    enable(setting: string): void;
    disable(setting: string): void;

    // Template engine
    engine(
        ext: string,
        fn: (
            path: string,
            options: object,
            callback: (e: any, rendered?: string) => void,
        ) => void,
    ): XyPrissApp;

    // Routing
    param(
        name: string,
        handler: (
            req: any,
            res: any,
            next: any,
            value: any,
            name: string,
        ) => void,
    ): void;
    path(): string;
    render(
        view: string,
        options?: object,
        callback?: (err: Error | null, html?: string) => void,
    ): void;
    route(path: string): any;

    // Properties
    locals: Record<string, any>;
    mountpath: string;
    settings: Record<string, any>;

    /**
     * Secure cache adapter for high-performance data access.
     *
     * Provides access to the underlying cache system with
     * encryption, compression, and intelligent strategies.
     */
    cache?: SecureCacheAdapter;

    /**
     * XyPriss Encrypted Memory Store (XEMS) runner for this instance.
     * Provides access to isolated or persistent memory storage.
     */
    xems?: any;

    /**
     * Server configuration options.
     *
     * Provides access to the configuration options passed to createServer.
     */
    configs?: ServerOptions;

    /**
     * Invalidate cache entries by pattern.
     *
     * @param pattern - Cache key pattern to invalidate
     * @returns Promise that resolves when invalidation is complete
     *
     * @example
     * ```typescript
     * // Invalidate all user-related cache entries
     * await app.invalidateCache('users:*');
     * ```
     */
    invalidateCache: (pattern: string) => Promise<void>;

    /**
     * Get comprehensive cache statistics.
     *
     * @returns Promise that resolves to cache statistics
     *
     * @example
     * ```typescript
     * const stats = await app.getCacheStats();
     * console.log(`Hit rate: ${stats.hitRate * 100}%`);
     * ```
     */
    getCacheStats: () => Promise<any>;

    /**
     * Warm up cache with predefined data.
     *
     * @param data - Array of cache entries to preload
     * @returns Promise that resolves when warmup is complete
     *
     * @example
     * ```typescript
     * await app.warmUpCache([
     *   { key: 'config:app', value: appConfig, ttl: 3600 },
     *   { key: 'users:popular', value: popularUsers, ttl: 1800 }
     * ]);
     * ```
     */
    warmUpCache: (
        data: Array<{ key: string; value: any; ttl?: number }>,
    ) => Promise<void>;

    /**
     * Start the XyPriss application server.
     *
     * @param callback - Callback function called when server starts (optional)
     * @returns Promise that resolves to HTTP server instance or server instance directly
     *
     * @example
     * ```typescript
     * // Start with auto port detection
     * const server = await app.start();
     *
     * // Start on specific port with callback
     * app.start(async () => {
     *   console.log('Server started on port 3000');
     * });
     * ```
     */
    start: (
        callback?: () => void,
    ) => Promise<HttpServer> | HttpServer | Promise<void> | void;

    /**
     * Stop the XyPriss server.
     *
     * @returns Promise that resolves when server is stopped
     *
     * @example
     * ```typescript
     * await app.stop();
     * console.log('Server stopped');
     * ```
     */
    stop?: () => Promise<void>;

    /**
     * Wait for server to be fully ready.
     *
     * @returns Promise that resolves when server is ready to accept requests
     *
     * @example
     * ```typescript
     * await app.start(3000);
     * await app.waitForReady();
     * console.log('Server is ready!');
     * ```
     */
    waitForReady: () => Promise<void>;

    /**
     * Get the current server port.
     *
     * @returns The port number the server is listening on
     *
     * @example
     * ```typescript
     * const currentPort = app.getPort();
     * console.log(`Server running on port ${currentPort}`);
     * ```
     */
    getPort: () => number;

    /**
     * Get the HTTP server instance.
     *
     * @returns The underlying HTTP server instance
     *
     * @example
     * ```typescript
     * const httpServer = app.getHttpServer();
     * console.log(`Server address: ${httpServer.address()}`);
     * ```
     */
    getHttpServer?: () => any;

    /**
     * Force close a specific port.
     *
     * @param port - Port number to force close
     * @returns Promise that resolves to true if port was closed successfully
     *
     * @example
     * ```typescript
     * const closed = await app.forceClosePort(3000);
     * if (closed) {
     *   console.log('Port 3000 closed successfully');
     * }
     * ```
     */
    forceClosePort: (port: number) => Promise<boolean>;

    /**
     * Create a redirect from one port to another.
     *
     * @param fromPort - Source port to redirect from
     * @param toPort - Target port to redirect to
     * @param options - Redirect configuration options
     * @returns Promise that resolves to redirect instance or boolean
     *
     * @example
     * ```typescript
     * // Redirect HTTP to HTTPS
     * const redirect = await app.redirectFromPort(80, 443, {
     *   mode: 'redirect',
     *   redirectStatusCode: 301,
     *   enableLogging: true
     * });
     * ```
     */
    redirectFromPort: (
        fromPort: number,
        toPort: number,
        options?: RedirectOptions,
    ) => Promise<RedirectServerInstance | boolean>;

    /**
     * Get a specific redirect instance.
     *
     * @param fromPort - Source port of the redirect
     * @returns Redirect instance or null if not found
     *
     * @example
     * ```typescript
     * const redirect = app.getRedirectInstance(80);
     * if (redirect) {
     *   console.log(`Redirecting from ${redirect.fromPort} to ${redirect.toPort}`);
     * }
     * ```
     */
    getRedirectInstance: (fromPort: number) => RedirectServerInstance | null;

    /**
     * Get the server plugin manager for route optimization and maintenance.
     *
     * @returns Server plugin manager instance or undefined if not initialized
     *
     * @example
     * ```typescript
     * const pluginManager = app.getServerPluginManager();
     * if (pluginManager) {
     *   const routeStats = pluginManager.getRouteOptimizationPlugin()?.getRouteStats();
     *   const healthMetrics = pluginManager.getServerMaintenancePlugin()?.getHealthMetrics();
     * }
     * ```
     */
    getServerPluginManager?: () => any;

    /**
     * Server plugin manager instance (for internal use).
     * Provides access to route optimization and server maintenance plugins.
     */
    serverPluginManager?: any;

    /**
     * Get all active redirect instances.
     *
     * @returns Array of all redirect instances
     *
     * @example
     * ```typescript
     * const redirects = app.getAllRedirectInstances();
     * redirects.forEach(redirect => {
     *   console.log(`${redirect.fromPort} -> ${redirect.toPort}`);
     * });
     * ```
     */
    getAllRedirectInstances: () => RedirectServerInstance[];

    /**
     * Disconnect a specific redirect.
     *
     * @param fromPort - Source port of the redirect to disconnect
     * @returns Promise that resolves to true if disconnected successfully
     *
     * @example
     * ```typescript
     * const disconnected = await app.disconnectRedirect(80);
     * if (disconnected) {
     *   console.log('Redirect from port 80 disconnected');
     * }
     * ```
     */
    disconnectRedirect: (fromPort: number) => Promise<boolean>;

    /**
     * Disconnect all active redirects.
     *
     * @returns Promise that resolves to true if all redirects were disconnected
     *
     * @example
     * ```typescript
     * const allDisconnected = await app.disconnectAllRedirects();
     * console.log(`All redirects disconnected: ${allDisconnected}`);
     * ```
     */
    disconnectAllRedirects: () => Promise<boolean>;

    /**
     * Get statistics for a specific redirect.
     *
     * @param fromPort - Source port of the redirect
     * @returns Redirect statistics or null if not found
     *
     * @example
     * ```typescript
     * const stats = app.getRedirectStats(80);
     * if (stats) {
     *   console.log(`Requests redirected: ${stats.totalRequests}`);
     * }
     * ```
     */
    getRedirectStats: (fromPort: number) => RedirectStats | null;

    // Console interception methods
    getConsoleInterceptor: () => any;
    enableConsoleInterception: () => Promise<void>;
    disableConsoleInterception: () => Promise<void>;
    getConsoleStats: () => Promise<any>;
    updateConsoleConfig: (
        config: Partial<ConsoleInterceptionConfig>,
    ) => Promise<void>;

    // Console encryption methods
    enableConsoleEncryption: (key?: string) => void;
    disableConsoleEncryption: () => void;
    getRouterStats?: () => any;
    getRouterInfo?: () => any;
    warmUpRoutes?: () => Promise<void>;
    resetRouterStats?: () => void;

    /**
     * Access the middleware management API.
     *
     * @param config - Optional middleware configuration
     * @returns Middleware API interface for fluent middleware management
     *
     * @example
     * ```typescript
     * app.middleware()
     *   .register(authMiddleware, { priority: 'critical' })
     *   .register(loggingMiddleware, { priority: 'high' })
     *   .enable('auth-middleware')
     *   .optimize();
     * ```
     */
    middleware: () => XyPrissMiddlewareAPI; // (config?: MiddlewareConfiguration)

    /**
     * Internal upload manager instance for file uploads
     */
    upload?: any;

    /**
     * Create single file upload middleware
     *
     * @param fieldname - Name of the form field
     * @returns Middleware for single file upload
     *
     * @example
     * ```typescript
     * app.post('/upload', app.uploadSingle('file'), (req, res) => {
     *   console.log(req.file);
     *   res.send('File uploaded');
     * });
     * ```
     */
    uploadSingle: (fieldname: string) => any;

    /**
     * Create array file upload middleware
     *
     * @param fieldname - Name of the form field
     * @param maxCount - Maximum number of files (optional)
     * @returns Middleware for array file upload
     *
     * @example
     * ```typescript
     * app.post('/upload', app.uploadArray('files', 5), (req, res) => {
     *   console.log(req.files);
     *   res.send('Files uploaded');
     * });
     * ```
     */
    uploadArray?: (fieldname: string, maxCount?: number) => any;

    /**
     * Create fields file upload middleware
     *
     * @param fields - Array of field configurations
     * @returns Middleware for multiple fields upload
     *
     * @example
     * ```typescript
     * app.post('/upload', app.uploadFields([
     *   { name: 'avatar', maxCount: 1 },
     *   { name: 'gallery', maxCount: 8 }
     * ]), (req, res) => {
     *   console.log(req.files);
     *   res.send('Files uploaded');
     * });
     * ```
     */
    uploadFields?: (fields: any[]) => any;

    /**
     * Create any file upload middleware
     *
     * @returns Middleware that accepts any files
     *
     * @example
     * ```typescript
     * app.post('/upload', app.uploadAny(), (req, res) => {
     *   console.log(req.files);
     *   res.send('Files uploaded');
     * });
     * ```
     */
    uploadAny?: () => any;

    /**
     * Scale up the cluster by adding workers.
     *
     * @param count - Number of workers to add (optional, defaults to optimal count)
     * @returns Promise that resolves when scaling is complete
     *
     * @example
     * ```typescript
     * // Add 2 workers
     * await app.scaleUp?.(2);
     *
     * // Add optimal number of workers
     * await app.scaleUp?.();
     * ```
     */
    scaleUp?: (count?: number) => Promise<void>;

    /**
     * Scale down the cluster by removing workers.
     *
     * @param count - Number of workers to remove (optional)
     * @returns Promise that resolves when scaling is complete
     *
     * @example
     * ```typescript
     * // Remove 1 worker
     * await app.scaleDown?.(1);
     * ```
     */
    scaleDown?: (count?: number) => Promise<void>;

    /**
     * Automatically scale the cluster based on current load.
     *
     * @returns Promise that resolves when auto-scaling is complete
     *
     * @example
     * ```typescript
     * await app.autoScale?.();
     * ```
     */
    autoScale?: () => Promise<void>;

    /**
     * Get comprehensive cluster metrics.
     *
     * @returns Promise that resolves to cluster metrics
     *
     * @example
     * ```typescript
     * const metrics = await app.getClusterMetrics?.();
     * console.log(`Active workers: ${metrics.activeWorkers}`);
     * ```
     */
    getClusterMetrics?: () => Promise<any>;

    /**
     * Get cluster health status.
     *
     * @returns Promise that resolves to cluster health information
     *
     * @example
     * ```typescript
     * const health = await app.getClusterHealth?.();
     * console.log(`Cluster status: ${health.status}`);
     * ```
     */
    getClusterHealth?: () => Promise<any>;

    /**
     * Get all worker processes.
     *
     * @returns Array of worker process information
     *
     * @example
     * ```typescript
     * const workers = app.getAllWorkers?.();
     * workers?.forEach(worker => {
     *   console.log(`Worker ${worker.id}: ${worker.status}`);
     * });
     * ```
     */
    getAllWorkers?: () => any[];

    /**
     * Get the optimal worker count for current system.
     *
     * @returns Promise that resolves to optimal worker count
     *
     * @example
     * ```typescript
     * const optimal = await app.getOptimalWorkerCount?.();
     * console.log(`Optimal worker count: ${optimal}`);
     * ```
     */
    getOptimalWorkerCount?: () => Promise<number>;

    /**
     * Restart the entire cluster.
     *
     * @returns Promise that resolves when cluster restart is complete
     *
     * @example
     * ```typescript
     * await app.restartCluster?.();
     * console.log('Cluster restarted successfully');
     * ```
     */
    restartCluster?: () => Promise<void>;

    /**
     * Stop the cluster.
     *
     * @param graceful - Whether to perform graceful shutdown
     * @returns Promise that resolves when cluster is stopped
     *
     * @example
     * ```typescript
     * // Graceful shutdown
     * await app.stopCluster?.(true);
     *
     * // Force shutdown
     * await app.stopCluster?.(false);
     * ```
     */
    stopCluster?: (graceful?: boolean) => Promise<void>;

    /**
     * Broadcast message to all workers.
     *
     * @param message - Message to broadcast
     * @returns Promise that resolves when message is sent
     *
     * @example
     * ```typescript
     * await app.broadcastToWorkers?.({
     *   type: 'config-update',
     *   data: newConfig
     * });
     * ```
     */
    broadcastToWorkers?: (message: any) => Promise<void>;

    /**
     * Send message to a random worker.
     *
     * @param message - Message to send
     * @returns Promise that resolves when message is sent
     *
     * @example
     * ```typescript
     * await app.sendToRandomWorker?.({
     *   type: 'task',
     *   data: taskData
     * });
     * ```
     */
    sendToRandomWorker?: (message: any) => Promise<void>;

    // Plugin management methods
    registerPlugin?: (plugin: any) => Promise<void>;
    unregisterPlugin?: (pluginId: string) => Promise<void>;
    getPlugin?: (pluginId: string) => any;
    getAllPlugins?: () => any[];
    getPluginsByType?: (type: any) => any[];
    getPluginStats?: (pluginId?: string) => any;
    getPluginRegistryStats?: () => any;
    getPluginEngineStats?: () => any;
    initializeBuiltinPlugins?: () => Promise<void>;
    getServerStats?: () => Promise<any>;

    // Multi-server methods (available when multiServer.enabled is true)
    startAllServers?: () => Promise<void>;
    stopAllServers?: () => Promise<void>;
    getServers?: () => MultiServerInstance[];
    getServer?: (id: string) => MultiServerInstance | undefined;
    /**
     * Get the registry of all registered routes in the application.
     * Consolidates routes from mounted routers and direct app methods.
     *
     * @returns Array of route registry entries
     */
    getRouteRegistry?: () => any[];
}


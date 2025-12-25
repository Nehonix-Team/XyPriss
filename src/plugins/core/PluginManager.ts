/**
 * Plugin Manager
 * Manages plugin registration, lifecycle, and execution
 */

import { Logger } from "../../../shared/logger";
import type { ServerOptions, UltraFastApp } from "../../types/types";
import type {
    XyPrissPlugin,
    XyPrissServer,
    PluginCreator,
} from "../types/PluginTypes";

export class PluginManager {
    private plugins: Map<string, XyPrissPlugin> = new Map();
    private pluginOrder: string[] = [];
    private server: XyPrissServer;
    private logger: Logger;
    private initialized: boolean = false;
    private hooksIntegrator?: any; // Will be initialized after construction

    // Real-time metrics for performance tracking
    private metrics = {
        startTime: Date.now(),
        requests: {
            total: 0,
            timings: new Map<string, number[]>(),
        },
        errors: {
            total: 0,
            byRoute: new Map<string, { count: number; lastError: string }>(),
        },
        connections: {
            active: 0,
            total: 0,
        },
    };

    // Performance metrics interval
    private metricsInterval: NodeJS.Timeout | null = null;
    private metricsIntervalMs = 30000; // 30 seconds

    constructor(server: XyPrissServer) {
        this.server = server;
        this.logger = new Logger();

        // Start periodic performance metrics collection
        this.startPerformanceMetricsCollection();

        // Initialize HooksIntegrator (lazy loaded to avoid circular dependency)
        this.initializeHooksIntegrator();
    }

    /**
     * Initialize the HooksIntegrator
     */
    private async initializeHooksIntegrator(): Promise<void> {
        try {
            const { HooksIntegrator } = await import("./HooksIntegrator");
            this.hooksIntegrator = new HooksIntegrator(this, this.logger);
            this.logger.debug("plugins", "HooksIntegrator initialized");
        } catch (error) {
            this.logger.error(
                "plugins",
                "Failed to initialize HooksIntegrator:",
                error
            );
        }
    }

    /**
     * Get the HooksIntegrator instance
     */
    getHooksIntegrator(): any {
        return this.hooksIntegrator;
    }

    /**
     * Register a plugin
     */
    register(plugin: XyPrissPlugin | PluginCreator, config?: any): void {
        // If it's a function, call it to get the plugin
        const pluginInstance =
            typeof plugin === "function" ? plugin(config) : plugin;

        // Validate plugin
        if (!pluginInstance.name || !pluginInstance.version) {
            throw new Error("Plugin must have name and version");
        }

        // Check for duplicates
        if (this.plugins.has(pluginInstance.name)) {
            this.logger.warn(
                "plugins",
                `Plugin '${pluginInstance.name}' already registered, skipping`
            );
            return;
        }

        // Store plugin
        this.plugins.set(pluginInstance.name, pluginInstance);

        // Call onRegister hook
        if (pluginInstance.onRegister) {
            pluginInstance.onRegister(this.server, config);
        }

        this.logger.info(
            "plugins",
            `Registered plugin: xypriss::ext/${pluginInstance.name}@${pluginInstance.version}`
        );

        // If already initialized, fully initialize this plugin immediately
        if (this.initialized) {
            // Resolve dependencies for this plugin
            this.resolveDependencies();

            // Register routes for this plugin
            if (pluginInstance.registerRoutes) {
                try {
                    pluginInstance.registerRoutes(this.server.app);
                    this.logger.debug(
                        "plugins",
                        `Registered routes for late plugin: ${pluginInstance.name}`
                    );
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error registering routes for ${pluginInstance.name}:`,
                        error
                    );
                }
            }

            // Apply middleware for this plugin
            if (pluginInstance.middleware || pluginInstance.onRequest) {
                const priority = pluginInstance.middlewarePriority || "normal";
                const middleware = [];

                if (pluginInstance.middleware) {
                    const mw = Array.isArray(pluginInstance.middleware)
                        ? pluginInstance.middleware
                        : [pluginInstance.middleware];
                    middleware.push(...mw);
                }

                if (pluginInstance.onRequest) {
                    middleware.push(
                        pluginInstance.onRequest.bind(pluginInstance)
                    );
                }

                // Apply middleware based on priority
                middleware.forEach((mw) => this.server.app.use(mw));

                this.logger.debug(
                    "plugins",
                    `Applied middleware for late plugin: ${pluginInstance.name}`
                );
            }

            // Call onServerStart hook
            if (pluginInstance.onServerStart) {
                Promise.resolve(
                    pluginInstance.onServerStart(this.server)
                ).catch((error) => {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginInstance.name}.onServerStart:`,
                        error
                    );
                });
            }

            // Call onServerReady hook if server is ready
            if (pluginInstance.onServerReady) {
                Promise.resolve(
                    pluginInstance.onServerReady(this.server)
                ).catch((error) => {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginInstance.name}.onServerReady:`,
                        error
                    );
                });
            }
        }
    }

    /**
     * Initialize all plugins (resolve dependencies and set execution order)
     */
    async initialize(): Promise<void> {
        this.resolveDependencies();
        this.initialized = true; // Set before calling hooks so late-registered plugins are detected
        await this.executeHook("onServerStart");
    }

    /**
     * Execute a lifecycle hook on all plugins
     */
    async executeHook(
        hookName: keyof XyPrissPlugin,
        ...args: any[]
    ): Promise<void> {
        for (const pluginName of this.pluginOrder) {
            const plugin = this.plugins.get(pluginName);
            if (plugin && typeof plugin[hookName] === "function") {
                try {
                    // For server lifecycle hooks, pass the server instance
                    if (
                        [
                            "onServerStart",
                            "onServerReady",
                            "onServerStop",
                        ].includes(hookName)
                    ) {
                        await (plugin[hookName] as any)(this.server, ...args);
                    } else {
                        await (plugin[hookName] as any)(...args);
                    }
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.${hookName}:`,
                        error
                    );
                    // If it's a critical lifecycle hook, rethrow to stop server startup
                    if (hookName === "onServerStart") {
                        throw error;
                    }
                }
            }
        }
    }

    /**
     * Register routes from all plugins
     */
    registerRoutes(app: UltraFastApp): void {
        for (const pluginName of this.pluginOrder) {
            const plugin = this.plugins.get(pluginName);
            if (plugin?.registerRoutes) {
                try {
                    plugin.registerRoutes(app);
                    this.logger.debug(
                        "plugins",
                        `Registered routes for: ${pluginName}`
                    );
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error registering routes for ${pluginName}:`,
                        error
                    );
                }
            }
        }
    }

    /**
     * Apply middleware from all plugins
     */
    applyMiddleware(app: UltraFastApp): void {
        const priorities = { first: [], normal: [], last: [] } as any;

        for (const pluginName of this.pluginOrder) {
            const plugin = this.plugins.get(pluginName);
            if (plugin?.middleware) {
                const priority = plugin.middlewarePriority || "normal";
                const middleware = Array.isArray(plugin.middleware)
                    ? plugin.middleware
                    : [plugin.middleware];
                priorities[priority].push(...middleware);
            }

            // Add onRequest as middleware
            if (plugin?.onRequest) {
                priorities.normal.push(plugin.onRequest.bind(plugin));
            }

            // Add onResponse as middleware (using res.on('finish'))
            if (plugin?.onResponse) {
                priorities.normal.push((req: any, res: any, next: any) => {
                    res.on("finish", () => {
                        try {
                            plugin.onResponse!(req, res);
                        } catch (error) {
                            this.logger.error(
                                "plugins",
                                `Error in ${pluginName}.onResponse:`,
                                error
                            );
                        }
                    });
                    next();
                });
            }
        }

        // Apply in order: first, normal, last
        [...priorities.first, ...priorities.normal, ...priorities.last].forEach(
            (mw) => app.use(mw)
        );
    }

    /**
     * Apply error handlers from all plugins
     * Wraps route methods to catch errors and call plugin error handlers
     */
    applyErrorHandlers(app: UltraFastApp): void {
        const errorPlugins = Array.from(this.plugins.values()).filter(
            (p) => p.onError
        );

        if (errorPlugins.length === 0) {
            return;
        }

        // Store original route methods
        const originalGet = app.get?.bind(app);
        const originalPost = app.post?.bind(app);
        const originalPut = app.put?.bind(app);
        const originalDelete = app.delete?.bind(app);
        const originalPatch = app.patch?.bind(app);

        // Helper to wrap handlers with error catching
        const wrapHandler = (handler: any) => {
            return async (req: any, res: any, next?: any) => {
                try {
                    const result = handler(req, res, next);
                    if (result && typeof result.catch === "function") {
                        await result;
                    }
                } catch (error: any) {
                    for (const plugin of errorPlugins) {
                        try {
                            await plugin.onError!(error, req, res, next);
                        } catch (handlerError) {
                            this.logger.error(
                                "plugins",
                                `Error in ${plugin.name}.onError:`,
                                handlerError
                            );
                        }
                    }
                    if (!res.headersSent) {
                        res.status(500).json({
                            error: "Internal Server Error",
                        });
                    }
                }
            };
        };

        // Wrap route methods
        if (originalGet) {
            app.get = function (path: any, ...handlers: any[]) {
                return originalGet(path, ...handlers.map(wrapHandler));
            };
        }

        if (originalPost) {
            app.post = function (path: any, ...handlers: any[]) {
                return originalPost(path, ...handlers.map(wrapHandler));
            };
        }

        if (originalPut) {
            app.put = function (path: any, ...handlers: any[]) {
                return originalPut(path, ...handlers.map(wrapHandler));
            };
        }

        if (originalDelete) {
            app.delete = function (path: any, ...handlers: any[]) {
                return originalDelete(path, ...handlers.map(wrapHandler));
            };
        }

        if (originalPatch) {
            app.patch = function (path: any, ...handlers: any[]) {
                return originalPatch(path, ...handlers.map(wrapHandler));
            };
        }

        this.logger.info(
            "plugins",
            `Error handlers applied for ${errorPlugins.length} plugin(s)`
        );
    }

    /**
     * Get a plugin by name
     */
    getPlugin(name: string): XyPrissPlugin | undefined {
        return this.plugins.get(name);
    }

    /**
     * Resolve dependencies and determine execution order
     */
    private resolveDependencies(): void {
        const visited = new Set<string>();
        const temp = new Set<string>();
        const order: string[] = [];

        const visit = (name: string) => {
            if (temp.has(name)) {
                throw new Error(`Circular dependency detected: ${name}`);
            }
            if (visited.has(name)) {
                return;
            }

            temp.add(name);
            const plugin = this.plugins.get(name);

            if (plugin?.dependencies) {
                for (const dep of plugin.dependencies) {
                    if (!this.plugins.has(dep)) {
                        throw new Error(
                            `Plugin '${name}' depends on '${dep}' which is not registered`
                        );
                    }
                    visit(dep);
                }
            }

            temp.delete(name);
            visited.add(name);
            order.push(name);
        };

        // Visit all plugins
        for (const name of this.plugins.keys()) {
            visit(name);
        }

        this.pluginOrder = order;
        this.logger.debug("plugins", "Plugin execution order:", order);
    }

    /**
     * Shutdown all plugins
     */
    async shutdown(): Promise<void> {
        // Stop performance metrics collection
        this.stopPerformanceMetricsCollection();
        await this.executeHook("onServerStop");
    }

    // ========== NEW HOOK TRIGGERS ==========

    /**
     * Trigger onSecurityThreat hook for all plugins
     */
    async triggerSecurityThreat(
        threat: any,
        req: any,
        res: any
    ): Promise<void> {
        this.logger.warn(
            "plugins",
            `Security threat detected: ${threat.type} (${threat.severity}) on ${threat.path}`
        );

        for (const pluginName of this.pluginOrder) {
            const plugin = this.plugins.get(pluginName);
            if (plugin?.onSecurityThreat) {
                try {
                    await plugin.onSecurityThreat(threat, req, res);
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.onSecurityThreat:`,
                        error
                    );
                }
            }
        }
    }

    /**
     * Trigger onRequestTiming hook for all plugins
     */
    async triggerRequestTiming(timing: any, req: any, res: any): Promise<void> {
        // Record metrics
        this.metrics.requests.total++;
        const routeKey = `${timing.method} ${timing.path}`;

        if (!this.metrics.requests.timings.has(routeKey)) {
            this.metrics.requests.timings.set(routeKey, []);
        }
        this.metrics.requests.timings.get(routeKey)!.push(timing.duration);

        // Limit history to 1000 entries per route
        const timings = this.metrics.requests.timings.get(routeKey)!;
        if (timings.length > 1000) {
            timings.shift();
        }

        for (const pluginName of this.pluginOrder) {
            const plugin = this.plugins.get(pluginName);
            if (plugin?.onRequestTiming) {
                try {
                    await plugin.onRequestTiming(timing, req, res);
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.onRequestTiming:`,
                        error
                    );
                }
            }
        }
    }

    /**
     * Trigger onRouteError hook for all plugins
     */
    async triggerRouteError(errorInfo: any, req: any, res: any): Promise<void> {
        this.logger.error(
            "plugins",
            `Route error on ${errorInfo.method} ${errorInfo.path}: ${errorInfo.error.message}`
        );

        // Record error metrics
        this.metrics.errors.total++;
        const routeKey = `${errorInfo.method} ${errorInfo.path}`;

        const existing = this.metrics.errors.byRoute.get(routeKey);
        if (existing) {
            existing.count++;
            existing.lastError = errorInfo.error.message;
        } else {
            this.metrics.errors.byRoute.set(routeKey, {
                count: 1,
                lastError: errorInfo.error.message,
            });
        }

        for (const pluginName of this.pluginOrder) {
            const plugin = this.plugins.get(pluginName);
            if (plugin?.onRouteError) {
                try {
                    await plugin.onRouteError(errorInfo, req, res);
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.onRouteError:`,
                        error
                    );
                }
            }
        }
    }

    /**
     * Trigger onPerformanceMetrics hook for all plugins
     */
    private async triggerPerformanceMetrics(): Promise<void> {
        const metrics = this.collectPerformanceMetrics();

        for (const pluginName of this.pluginOrder) {
            const plugin = this.plugins.get(pluginName);
            if (plugin?.onPerformanceMetrics) {
                try {
                    await plugin.onPerformanceMetrics(metrics, this.server);
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.onPerformanceMetrics:`,
                        error
                    );
                }
            }
        }
    }

    /**
     * Collect current performance metrics
     */
    private collectPerformanceMetrics(): any {
        const os = require("os");
        const memUsage = process.memoryUsage();
        const uptime = (Date.now() - this.metrics.startTime) / 1000;
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;

        // Calculate slowest routes
        const slowestRoutes = Array.from(
            this.metrics.requests.timings.entries()
        )
            .map(([route, timings]) => {
                const [method, ...pathParts] = route.split(" ");
                const path = pathParts.join(" ");
                const averageTime =
                    timings.reduce((a, b) => a + b, 0) / timings.length;
                return { path, method, averageTime, count: timings.length };
            })
            .sort((a, b) => b.averageTime - a.averageTime)
            .slice(0, 10);

        // Calculate routes with most errors
        const topErrorRoutes = Array.from(this.metrics.errors.byRoute.entries())
            .map(([route, data]) => {
                const [method, ...pathParts] = route.split(" ");
                const path = pathParts.join(" ");
                return {
                    path,
                    method,
                    count: data.count,
                    lastError: data.lastError,
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        // Calculate global average response time
        const allTimings: number[] = [];
        this.metrics.requests.timings.forEach((timings) =>
            allTimings.push(...timings)
        );
        const averageResponseTime =
            allTimings.length > 0
                ? allTimings.reduce((a, b) => a + b, 0) / allTimings.length
                : 0;

        const requestsPerSecond = this.metrics.requests.total / uptime;
        const errorRate = this.metrics.errors.total / uptime;

        return {
            timestamp: new Date(),
            uptime,
            memory: {
                used: usedMem,
                total: totalMem,
                percentage: (usedMem / totalMem) * 100,
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
            },
            cpu: {
                usage: this.getCPUUsage(),
                loadAverage: os.loadavg(),
            },
            requests: {
                total: this.metrics.requests.total,
                perSecond: requestsPerSecond,
                averageResponseTime,
                slowestRoutes,
            },
            errors: {
                total: this.metrics.errors.total,
                rate: errorRate,
                topRoutes: topErrorRoutes,
            },
            connections: {
                active: this.metrics.connections.active,
                total: this.metrics.connections.total,
            },
        };
    }

    /**
     * Calculate CPU usage (approximation)
     */
    private getCPUUsage(): number {
        const os = require("os");
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach((cpu: any) => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type as keyof typeof cpu.times];
            }
            totalIdle += cpu.times.idle;
        });

        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;
        const usage = 100 - ~~((100 * idle) / total);

        return usage;
    }

    /**
     * Start periodic performance metrics collection
     */
    private startPerformanceMetricsCollection(): void {
        this.metricsInterval = setInterval(() => {
            this.triggerPerformanceMetrics().catch((error) => {
                this.logger.error(
                    "plugins",
                    "Error triggering performance metrics:",
                    error
                );
            });
        }, this.metricsIntervalMs);

        this.logger.debug(
            "plugins",
            `Performance metrics collection started (interval: ${this.metricsIntervalMs}ms)`
        );
    }

    /**
     * Stop periodic performance metrics collection
     */
    private stopPerformanceMetricsCollection(): void {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
            this.logger.debug(
                "plugins",
                "Performance metrics collection stopped"
            );
        }
    }

    /**
     * Increment active connections counter
     */
    incrementActiveConnections(): void {
        this.metrics.connections.active++;
        this.metrics.connections.total++;
    }

    /**
     * Decrement active connections counter
     */
    decrementActiveConnections(): void {
        this.metrics.connections.active--;
    }
}


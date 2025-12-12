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

    constructor(server: XyPrissServer) {
        this.server = server;
        this.logger = new Logger();
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
                    await (plugin[hookName] as any)(...args);
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.${hookName}:`,
                        error
                    );
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
        await this.executeHook("onServerStop");
    }
}


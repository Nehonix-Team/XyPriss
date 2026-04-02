/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */

/**
 * Plugin Manager
 * Manages plugin registration, lifecycle, and execution
 */

import { Logger } from "../../shared/logger";
import { createServer } from "../../server/ServerFactory";
import type { ServerOptions, UltraFastApp } from "../../types/types";
import type {
    XyPrissPlugin,
    XyPrissServer,
    PluginCreator,
    PluginStats,
    PluginManagement,
    PluginServer,
    PluginUltraFastApp,
} from "../types/PluginTypes";
import { HOOK_ID_MAP } from "../const/PluginHookIds";
import { validatePlgInput } from "../../schemas/plugingSchema";
import { PermissionManager } from "./PermissionManager";

export class XyPluginManager {
    private plugins: Map<string, XyPrissPlugin> = new Map();
    private pluginOrder: string[] = [];
    private server: XyPrissServer;
    private logger: Logger;
    private initialized: boolean = false;
    private permissionManager: PermissionManager;

    constructor(server: XyPrissServer) {
        this.server = server;
        this.logger = new Logger();
        this.permissionManager = new PermissionManager(server, this.logger);
    }

    /**
     * Register a plugin
     */
    async register(
        plugin: XyPrissPlugin | PluginCreator,
        config?: any,
    ): Promise<void> {
        // If it's a function, call it to get the plugin
        const pluginInstance =
            typeof plugin === "function" ? plugin(config) : plugin;

        // Validate plugin
        if (!pluginInstance.name || !pluginInstance.version) {
            throw new Error("Plugin must have name and version");
        }

        const vldt = validatePlgInput({
            name: pluginInstance.name,
            version: pluginInstance.version,
        });

        if (typeof vldt === "string") {
            throw new Error(vldt);
        }

        // Check for duplicates
        if (this.plugins.has(pluginInstance.name)) {
            this.logger.warn(
                "plugins",
                `Plugin '${pluginInstance.name}' already registered, skipping`,
            );
            return;
        }

        // Check permission for onRegister if it exists
        if (pluginInstance.onRegister) {
            if (
                !this.permissionManager.checkPermission(
                    pluginInstance.name,
                    "onRegister",
                )
            ) {
                return;
            }
        }

        // Store plugin
        this.plugins.set(pluginInstance.name, pluginInstance);

        // Call onRegister hook
        if (pluginInstance.onRegister) {
            try {
                const result = pluginInstance.onRegister(
                    this.getRestrictedServer() as any,
                );
                if (result instanceof Promise) {
                    await result.catch((error) => {
                        this.logger.error(
                            "plugins",
                            `Async Error in ${pluginInstance.name}.onRegister:`,
                            error,
                        );
                    });
                }
            } catch (error) {
                this.logger.error(
                    "plugins",
                    `Error in ${pluginInstance.name}.onRegister:`,
                    error,
                );
            }
        }

        this.logger.info(
            "plugins",
            `Registered plugin: xypriss::ext/${pluginInstance.name}@${pluginInstance.version}`,
        );

        // If already initialized, fully initialize this plugin immediately
        if (this.initialized) {
            // Resolve dependencies for this plugin
            this.resolveDependencies();

            // Register routes for this plugin
            if (pluginInstance.registerRoutes) {
                try {
                    if (
                        this.permissionManager.checkPermission(
                            pluginInstance.name,
                            "registerRoutes",
                        )
                    ) {
                        pluginInstance.registerRoutes(this.server.app);
                        this.logger.debug(
                            "plugins",
                            `Registered routes for late plugin: ${pluginInstance.name}`,
                        );
                    }
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error registering routes for ${pluginInstance.name}:`,
                        error,
                    );
                }
            }

            // Apply middleware for this plugin
            if (pluginInstance.middleware || pluginInstance.onRequest) {
                if (
                    this.permissionManager.checkPermission(
                        pluginInstance.name,
                        "middleware",
                    )
                ) {
                    const priority =
                        pluginInstance.middlewarePriority || "normal";
                    const middleware = [];

                    if (pluginInstance.middleware) {
                        const mw = Array.isArray(pluginInstance.middleware)
                            ? pluginInstance.middleware
                            : [pluginInstance.middleware];
                        middleware.push(...mw);
                    }

                    if (pluginInstance.onRequest) {
                        middleware.push(
                            pluginInstance.onRequest.bind(pluginInstance),
                        );
                    }

                    // Apply middleware based on priority
                    middleware.forEach((mw) => this.server.app.use(mw));

                    this.logger.debug(
                        "plugins",
                        `Applied middleware for late plugin: ${pluginInstance.name}`,
                    );
                }
            }

            // Call onServerStart hook
            if (pluginInstance.onServerStart) {
                if (
                    this.permissionManager.checkPermission(
                        pluginInstance.name,
                        "onServerStart",
                    )
                ) {
                    Promise.resolve(
                        pluginInstance.onServerStart(
                            this.getRestrictedServer() as any,
                        ),
                    ).catch((error) => {
                        this.logger.error(
                            "plugins",
                            `Error in ${pluginInstance.name}.onServerStart:`,
                            error,
                        );
                    });
                }
            }

            // Call onServerReady hook if server is ready
            if (pluginInstance.onServerReady) {
                if (
                    this.permissionManager.checkPermission(
                        pluginInstance.name,
                        "onServerReady",
                    )
                ) {
                    Promise.resolve(
                        pluginInstance.onServerReady(
                            this.getRestrictedServer() as any,
                        ),
                    ).catch((error) => {
                        this.logger.error(
                            "plugins",
                            `Error in ${pluginInstance.name}.onServerReady:`,
                            error,
                        );
                    });
                }
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

        // Execute management hook for plugins with permission
        for (const pluginName of this.pluginOrder) {
            const plugin = this.plugins.get(pluginName);
            if (
                plugin &&
                typeof plugin.managePlugins === "function" &&
                this.permissionManager.checkPermission(
                    pluginName,
                    "managePlugins",
                )
            ) {
                try {
                    await plugin.managePlugins({
                        getStats: () => this.getPluginStats(),
                        setPermission: (
                            p: string,
                            h: string,
                            a: boolean,
                            by?: string,
                        ) =>
                            this.setPluginPermission(p, h, a, by || pluginName),
                        toggle: (p: string, e: boolean, by?: string) =>
                            this.togglePlugin(p, e, by || pluginName),
                    });
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.managePlugins:`,
                        error,
                    );
                }
            }
        }

        // Execute Ops hook for plugins with permission to deploy auxiliary servers
        for (const pluginName of this.pluginOrder) {
            const plugin = this.plugins.get(pluginName);
            if (
                plugin &&
                typeof plugin.onAuxiliaryServerDeploy === "function" &&
                this.permissionManager.checkPermission(
                    pluginName,
                    "onAuxiliaryServerDeploy",
                )
            ) {
                try {
                    await plugin.onAuxiliaryServerDeploy(
                        {
                            createAuxiliaryServer: (options: ServerOptions) =>
                                createServer({
                                    ...options,
                                    isAuxiliary: true,
                                    performance: { optimizationEnabled: false }, // Avoid aggressive precompiling for UI assets
                                    plugins: { register: [] }, // Disable plugins to prevent infinite recursion
                                    logging: { enabled: true, level: "info" },
                                }),
                            getRouteRegistry: () =>
                                (this.server.app as any).getRouteRegistry(),
                        },
                        this.server,
                    );
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.onAuxiliaryServerDeploy:`,
                        error,
                    );
                }
            }
        }
    }

    /**
     * Disable a plugin globally
     */
    public togglePlugin(
        pluginName: string,
        enabled: boolean,
        requestedBy?: string,
    ): void {
        const caller = requestedBy || "system";
        if (enabled) {
            this.permissionManager.enablePlugin(pluginName);
            this.logger.info(
                "plugins",
                `Plugin '${pluginName}' enabled by '${caller}'`,
            );
        } else {
            this.permissionManager.disablePlugin(pluginName);
            this.logger.info(
                "plugins",
                `Plugin '${pluginName}' disabled by '${caller}'`,
            );
        }
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
                    // Check permission (logs error if denied)
                    if (
                        this.permissionManager.checkPermission(
                            pluginName,
                            hookName as string,
                        )
                    ) {
                        // For server lifecycle hooks, pass the server instance
                        if (
                            [
                                "onServerStart",
                                "onServerReady",
                                "onServerStop",
                            ].includes(hookName)
                        ) {
                            await (plugin[hookName] as any)(
                                this.getRestrictedServer(),
                                ...args,
                            );
                        } else {
                            await (plugin[hookName] as any)(...args);
                        }
                    }
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginName}.${hookName}:`,
                        error,
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
     * Trigger a security attack hook on all plugins
     */
    triggerSecurityAttack(attackData: any, req: any, res: any): void {
        this.executeHook(
            "onSecurityAttack",
            attackData,
            this.permissionManager.maskRequest(req),
            res,
        ).catch(() => {});
    }

    /**
     * Trigger a response time hook on all plugins
     */
    triggerResponseTime(responseTime: number, req: any, res: any): void {
        this.executeHook(
            "onResponseTime",
            responseTime,
            this.permissionManager.maskRequest(req),
            res,
        ).catch(() => {});
    }

    /**
     * Trigger a route error hook on all plugins
     */
    triggerRouteError(error: Error, req: any, res: any): void {
        this.executeHook(
            "onRouteError",
            error,
            this.permissionManager.maskRequest(req),
            res,
        ).catch(() => {});
    }

    /**
     * Trigger a rate limit hook on all plugins
     */
    triggerRateLimit(limitData: any, req: any, res: any): void {
        this.executeHook(
            "onRateLimit",
            limitData,
            this.permissionManager.maskRequest(req),
            res,
        ).catch(() => {});
    }

    /**
     * Register routes from all plugins
     */
    registerRoutes(app: UltraFastApp): void {
        for (const pluginName of this.pluginOrder) {
            const plugin = this.plugins.get(pluginName);
            if (plugin?.registerRoutes) {
                try {
                    if (
                        this.permissionManager.checkPermission(
                            pluginName,
                            "registerRoutes",
                        )
                    ) {
                        plugin.registerRoutes(app);
                        this.logger.debug(
                            "plugins",
                            `Registered routes for: ${pluginName}`,
                        );
                    }
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error registering routes for ${pluginName}:`,
                        error,
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

            // Check middleware permission
            if (plugin?.middleware) {
                try {
                    if (
                        this.permissionManager.checkPermission(
                            pluginName,
                            "middleware",
                        )
                    ) {
                        const priority = plugin.middlewarePriority || "normal";
                        const middleware = Array.isArray(plugin.middleware)
                            ? plugin.middleware
                            : [plugin.middleware];
                        priorities[priority].push(...middleware);
                    }
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error applying middleware for ${pluginName}:`,
                        error,
                    );
                }
            }

            // Add onRequest as middleware
            if (plugin?.onRequest) {
                try {
                    if (
                        this.permissionManager.checkPermission(
                            pluginName,
                            "onRequest",
                        )
                    ) {
                        priorities.normal.push(
                            async (req: any, res: any, next: any) => {
                                if (
                                    this.permissionManager.isPluginDisabled(
                                        pluginName,
                                        "onRequest",
                                    )
                                ) {
                                    return next();
                                }
                                let nextCalled = false;
                                const wrappedNext = (err?: any) => {
                                    nextCalled = true;
                                    next(err);
                                };

                                try {
                                    const wasEndedBefore = res.writableEnded;
                                    await plugin.onRequest!(
                                        this.permissionManager.maskRequest(req),
                                        res,
                                        wrappedNext,
                                    );

                                    if (
                                        !wasEndedBefore &&
                                        res.writableEnded &&
                                        nextCalled
                                    ) {
                                        this.logger.error(
                                            "plugins",
                                            `Logic Error in ${pluginName}.onRequest: Plugin sent a response but also called next(). ` +
                                                `This is invalid and will cause subsequent route handlers to be skipped.`,
                                        );
                                    }
                                } catch (error) {
                                    this.logger.error(
                                        "plugins",
                                        `Error in ${pluginName}.onRequest:`,
                                        error,
                                    );
                                    // Only call next(error) if response hasn't been sent
                                    if (!res.writableEnded) {
                                        next(error);
                                    }
                                }
                            },
                        );
                    }
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error applying onRequest for ${pluginName}:`,
                        error,
                    );
                }
            }

            // Add onResponse as middleware (using res.end interception or similar)
            if (plugin?.onResponse) {
                try {
                    if (
                        this.permissionManager.checkPermission(
                            pluginName,
                            "onResponse",
                        )
                    ) {
                        priorities.normal.push(
                            (req: any, res: any, next: any) => {
                                const self = this;
                                const originalEnd = res.end;
                                res.end = (async (...args: any[]) => {
                                    if (
                                        !self.permissionManager?.isPluginDisabled(
                                            pluginName,
                                            "onResponse",
                                        )
                                    ) {
                                        try {
                                            await plugin.onResponse!(
                                                self.permissionManager.maskRequest(
                                                    req,
                                                ),
                                                res,
                                            );
                                        } catch (error) {
                                            self.logger.error(
                                                "plugins",
                                                `Error in ${pluginName}.onResponse:`,
                                                error,
                                            );
                                        }
                                    }
                                    return originalEnd.apply(res, args);
                                }) as any;
                                next();
                            },
                        );
                    }
                } catch (error) {
                    this.logger.error(
                        "plugins",
                        `Error applying onResponse for ${pluginName}:`,
                        error,
                    );
                }
            }
        }

        // Apply in order: first, normal, last
        [...priorities.first, ...priorities.normal, ...priorities.last].forEach(
            (mw) => app.use(mw),
        );
    }

    /**
     * Apply error handlers from all plugins
     * Wraps route methods to catch errors and call plugin error handlers
     */
    applyErrorHandlers(app: UltraFastApp): void {
        const errorPlugins = Array.from(this.plugins.values()).filter(
            (p) => p.onError,
        );

        if (errorPlugins.length === 0) return;

        // Add a global error handler to the app
        app.use(async (err: any, req: any, res: any, next: any) => {
            for (const plugin of errorPlugins) {
                if (
                    this.permissionManager.checkPermission(
                        plugin.name,
                        "onError",
                    )
                ) {
                    if (
                        this.permissionManager.isPluginDisabled(
                            plugin.name,
                            "onError",
                        )
                    ) {
                        continue;
                    }

                    try {
                        await plugin.onError!(
                            err,
                            this.permissionManager.maskRequest(req),
                            res,
                            next,
                        );
                        // If the plugin sent a response, stop calling other handlers
                        if (res.writableEnded) return;
                    } catch (error) {
                        this.logger.error(
                            "plugins",
                            `Error in ${plugin.name}.onError:`,
                            error,
                        );
                    }
                }
            }

            // If no plugin handled the error, call the next error handler
            if (!res.writableEnded) {
                next(err);
            }
        });
    }

    /**
     * Get a plugin by name
     */
    getPlugin(name: string): XyPrissPlugin | undefined {
        return this.plugins.get(name);
    }

    /**
     * Get statistics for all registered plugins
     */
    getPluginStats(): PluginStats[] {
        const stats: PluginStats[] = [];
        const permissions = this.server.app.configs?.pluginPermissions || [];

        for (const [name, plugin] of this.plugins.entries()) {
            const pluginPerm = permissions.find((p) => p.name === name);

            // Determine allowed hooks
            let allowedHooks: string[] | "*" = pluginPerm?.allowedHooks || "*";

            // If allowedHooks is '*', it means all hooks EXCEPT management hooks by default
            if (allowedHooks === "*") {
                const actualHooks: string[] = [];
                const denied = pluginPerm?.deniedHooks || [];
                for (const internalName in HOOK_ID_MAP) {
                    if (typeof (plugin as any)[internalName] === "function") {
                        const id = HOOK_ID_MAP[internalName];
                        if (
                            id !== HOOK_ID_MAP.managePlugins &&
                            !denied.includes(id)
                        ) {
                            actualHooks.push(id);
                        }
                    }
                }
                allowedHooks = actualHooks.length > 0 ? actualHooks : "*";
            } else if (Array.isArray(allowedHooks)) {
                const denied = pluginPerm?.deniedHooks || [];
                allowedHooks = allowedHooks.filter((h) => !denied.includes(h));
            }

            stats.push({
                name: plugin.name,
                version: plugin.version,
                description: plugin.description || "",
                enabled: !this.permissionManager.isPluginDisabled(name, "any"),
                permissions: {
                    allowedHooks,
                    deniedHooks: pluginPerm?.deniedHooks || [],
                    policy: pluginPerm?.policy || "allow",
                },
                dependencies: plugin.dependencies || [],
            });
        }
        return stats;
    }

    /**
     * Set permission for a plugin hook
     */
    setPluginPermission(
        pluginName: string,
        hookId: string,
        allowed: boolean,
        by: string = "system",
    ): void {
        this.logger.warn(
            "plugins",
            `Permission '${hookId}' for plugin '${pluginName}' ${
                allowed ? "granted" : "revoked"
            } by ${by}`,
        );
        if (!this.server.app.configs) {
            this.server.app.configs = {};
        }
        if (!this.server.app.configs.pluginPermissions) {
            this.server.app.configs.pluginPermissions = [];
        }

        let pluginPerm = this.server.app.configs.pluginPermissions.find(
            (p: any) => p.name === pluginName,
        );

        if (!pluginPerm) {
            pluginPerm = {
                name: pluginName,
                allowedHooks: allowed ? [hookId] : [],
                deniedHooks: allowed ? [] : [hookId],
                policy: "allow",
            };
            this.server.app.configs.pluginPermissions.push(pluginPerm);
            return;
        }

        if (allowed) {
            if (pluginPerm.deniedHooks) {
                pluginPerm.deniedHooks = pluginPerm.deniedHooks.filter(
                    (h: string) => h !== hookId,
                );
            }
            if (Array.isArray(pluginPerm.allowedHooks)) {
                if (!pluginPerm.allowedHooks.includes(hookId)) {
                    pluginPerm.allowedHooks.push(hookId);
                }
            } else if (pluginPerm.allowedHooks === "*") {
                // Already allowed
            } else {
                pluginPerm.allowedHooks = [hookId];
            }
        } else {
            if (!pluginPerm.deniedHooks) pluginPerm.deniedHooks = [];
            if (!pluginPerm.deniedHooks.includes(hookId)) {
                pluginPerm.deniedHooks.push(hookId);
            }
            if (Array.isArray(pluginPerm.allowedHooks)) {
                pluginPerm.allowedHooks = pluginPerm.allowedHooks.filter(
                    (h: string) => h !== hookId,
                );
            }
        }
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
            if (visited.has(name)) return;

            temp.add(name);
            const plugin = this.plugins.get(name);

            if (plugin?.dependencies) {
                for (const dep of plugin.dependencies) {
                    if (!this.plugins.has(dep)) {
                        throw new Error(
                            `Plugin '${name}' depends on '${dep}' which is not registered`,
                        );
                    }
                    visit(dep);
                }
            }

            temp.delete(name);
            visited.add(name);
            order.push(name);
        };

        for (const name of this.plugins.keys()) visit(name);

        this.pluginOrder = order;
        this.logger.debug("plugins", "Plugin execution order:", order);
    }

    /**
     * Shutdown all plugins
     */
    async shutdown(): Promise<void> {
        await this.executeHook("onServerStop");
    }

    /**
     * Create a restricted proxy of the server for plugins.
     * This limits access to only allowed methods on the app instance.
     */
    private getRestrictedServer(): PluginServer {
        const allowedAppMethods = [
            "get",
            "post",
            "put",
            "delete",
            "patch",
            "options",
            "head",
            "connect",
            "trace",
            "all",
            "use",
        ];

        // Proxy for the app instance
        const appProxy = new Proxy(this.server.app, {
            get(target: any, prop: string | symbol) {
                if (
                    typeof prop === "string" &&
                    allowedAppMethods.includes(prop)
                ) {
                    const value = target[prop];
                    return typeof value === "function"
                        ? value.bind(target)
                        : value;
                }

                // Block other properties
                return undefined;
            },
        });

        // Proxy for the server instance
        return new Proxy(this.server, {
            get(_target: any, prop: string | symbol) {
                if (prop === "app") {
                    return appProxy;
                }

                // Allow other properties on the server itself if they were intended?
                // The user said: "seules choses qu'ils doivent pouvoir faire et utiliser dans l'instance server
                // doit être les méthodes http ... et la méthode de middleware 'use'"
                // This suggests we should also block other server properties.
                return undefined;
            },
        }) as unknown as PluginServer;
    }
}


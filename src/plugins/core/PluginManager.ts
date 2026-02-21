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

import { Logger } from "../../../shared/logger";
import type { ServerOptions, UltraFastApp } from "../../types/types";
import type {
    XyPrissPlugin,
    XyPrissServer,
    PluginCreator,
    PluginStats,
    PluginManagement,
} from "../types/PluginTypes";
import { HOOK_ID_MAP } from "../const/PluginHookIds";
import { validatePlgInput } from "../../schemas/plugingSchema";

export class PluginManager {
    private plugins: Map<string, XyPrissPlugin> = new Map();
    private pluginOrder: string[] = [];
    private server: XyPrissServer;
    private logger: Logger;
    private initialized: boolean = false;
    private disabledPlugins: Set<string> = new Set();

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

        const vldt = validatePlgInput({
            name: pluginInstance.name,
            version: pluginInstance.version,
        });

        if (typeof vldt === "string") {
            // this.logger.error("plugins", vldt);
            // return;
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
            if (!this.checkPermission(pluginInstance.name, "onRegister")) {
                return;
            }
        }

        // Store plugin
        this.plugins.set(pluginInstance.name, pluginInstance);

        // Call onRegister hook
        if (pluginInstance.onRegister) {
            try {
                pluginInstance.onRegister(this.server, config);
            } catch (error) {
                this.logger.error(
                    "plugins",
                    `Error in ${pluginInstance.name}.onRegister:`,
                    error,
                );
                throw error;
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
                    pluginInstance.registerRoutes(this.server.app);
                    this.logger.debug(
                        "plugins",
                        `Registered routes for late plugin: ${pluginInstance.name}`,
                    );
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

            // Call onServerStart hook
            if (pluginInstance.onServerStart) {
                Promise.resolve(
                    pluginInstance.onServerStart(this.server),
                ).catch((error) => {
                    this.logger.error(
                        "plugins",
                        `Error in ${pluginInstance.name}.onServerStart:`,
                        error,
                    );
                });
            }

            // Call onServerReady hook if server is ready
            if (pluginInstance.onServerReady) {
                Promise.resolve(
                    pluginInstance.onServerReady(this.server),
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
                this.checkPermission(pluginName, "managePlugins")
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
    }

    /**
     * Check if a plugin is disabled and log a warning if it is
     */
    private isPluginDisabled(
        pluginName: string,
        internalHookName: string,
    ): boolean {
        if (this.disabledPlugins.has(pluginName)) {
            const hookId = HOOK_ID_MAP[internalHookName] || internalHookName;
            this.logger.error(
                "plugins",
                `Plugin '${pluginName}' is disabled but tried to execute hook '${hookId}'. ` +
                    `Ignoring request. Please enable it if you want to use its features.`,
            );
            return true;
        }
        return false;
    }

    /**
     * Check if a plugin is allowed to execute a specific hook
     */
    private checkPermission(
        pluginName: string,
        internalHookName: string,
    ): boolean {
        if (this.isPluginDisabled(pluginName, internalHookName)) {
            return false;
        }

        const hookId = HOOK_ID_MAP[internalHookName] || internalHookName;
        const permissions = this.server.app.configs?.pluginPermissions;

        // Special case: Privileged hooks are denied by default unless explicitly allowed
        const isPrivilegedHook = [
            HOOK_ID_MAP.managePlugins,
            HOOK_ID_MAP.onConsoleIntercept,
        ].includes(hookId);

        // If no permissions configured
        if (!permissions || permissions.length === 0) {
            if (isPrivilegedHook) {
                this.logger.error(
                    "plugins",
                    `Plugin '${pluginName}' is denied access to privileged hook '${hookId}'. ` +
                        `Explicit permission is required in server configuration.`,
                );
                return false;
            }
            return true;
        }

        const pluginPerm = permissions.find((p) => p.name === pluginName);

        // If plugin not listed in permissions
        if (!pluginPerm) {
            if (isPrivilegedHook) {
                this.logger.error(
                    "plugins",
                    `Plugin '${pluginName}' is denied access to privileged hook '${hookId}'. ` +
                        `Explicit permission is required in server configuration.`,
                );
                return false;
            }
            return true;
        }

        // Check explicitly denied hooks first (they override everything)
        if (pluginPerm.deniedHooks?.includes(hookId)) {
            this.logger.error(
                "plugins",
                `Plugin '${pluginName}' is explicitly denied access to hook '${hookId}'.`,
            );
            return false;
        }

        const policy = pluginPerm.policy || "allow";
        const allowedHooks = pluginPerm.allowedHooks || "*";

        // If policy is "deny", it's a whitelist
        if (policy === "deny") {
            if (allowedHooks === "*") return true;
            if (Array.isArray(allowedHooks) && allowedHooks.includes(hookId)) {
                return true;
            }

            // throw new Error(
            //     `Plugin '${pluginName}' is denied access to hook '${hookId}' by 'deny' policy. ` +
            //         `Add it to 'allowedHooks' to grant access.`
            // );

            this.logger.error(
                "plugins",
                `Plugin '${pluginName}' is denied access to hook '${hookId}' by 'deny' policy. ` +
                    `Add it to 'allowedHooks' to grant access.`,
            );
            return false;
        }

        // If policy is "allow", it's a blacklist (if we had deniedHooks)
        // or just "allow all except privileged hooks"
        if (isPrivilegedHook) {
            if (allowedHooks === "*") return true;
            if (Array.isArray(allowedHooks) && allowedHooks.includes(hookId)) {
                return true;
            }

            this.logger.error(
                "plugins",
                `Plugin '${pluginName}' is denied access to privileged hook '${hookId}'. ` +
                    `Privileged hooks must be explicitly listed even with 'allow' policy.`,
            );
            return false;
        }

        return true;
    }

    /**
     * Creates a masked version of the request object for security in plugin hooks.
     * Prevents plugins from accessing sensitive data like body, query, and cookies.
     *
     * @param req - The original request object
     * @returns A proxied version of the request with sensitive fields masked
     */
    private maskRequest(req: any): any {
        if (!req) return req;

        const maskedMessage =
            "Access to sensitive request data is restricted in this hook for security reasons.";
        const sensitiveFields = ["body", "query", "cookies", "params"];

        return new Proxy(req, {
            get(target, prop) {
                if (
                    typeof prop === "string" &&
                    sensitiveFields.includes(prop)
                ) {
                    return maskedMessage;
                }
                const value = target[prop];
                if (typeof value === "function") {
                    return value.bind(target);
                }
                return value;
            },
            ownKeys(target) {
                return Reflect.ownKeys(target);
            },
            getOwnPropertyDescriptor(target, prop) {
                if (
                    typeof prop === "string" &&
                    sensitiveFields.includes(prop)
                ) {
                    return {
                        value: maskedMessage,
                        enumerable: true,
                        configurable: true,
                        writable: false,
                    };
                }
                return Reflect.getOwnPropertyDescriptor(target, prop);
            },
        });
    }

    /**
     * Execute a lifecycle hook on all plugins
     */
    async executeHook(
        hookName: keyof XyPrissPlugin,
        ...args: any[]
    ): Promise<void> {
        this.logger.debug(
            "plugins",
            `Executing hook: ${hookName} on ${this.pluginOrder.length} plugins`,
        );
        for (const pluginName of this.pluginOrder) {
            const plugin = this.plugins.get(pluginName);
            if (plugin && typeof plugin[hookName] === "function") {
                this.logger.debug(
                    "plugins",
                    `Calling ${pluginName}.${hookName}`,
                );
                try {
                    // Check permission (logs error if denied)
                    if (this.checkPermission(pluginName, hookName as string)) {
                        // For server lifecycle hooks, pass the server instance
                        if (
                            [
                                "onServerStart",
                                "onServerReady",
                                "onServerStop",
                            ].includes(hookName)
                        ) {
                            await (plugin[hookName] as any)(
                                this.server,
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
            this.maskRequest(req),
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
            this.maskRequest(req),
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
            this.maskRequest(req),
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
            this.maskRequest(req),
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
                    if (this.checkPermission(pluginName, "registerRoutes")) {
                        plugin.registerRoutes(app);
                    }
                    this.logger.debug(
                        "plugins",
                        `Registered routes for: ${pluginName}`,
                    );
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
                    if (this.checkPermission(pluginName, "middleware")) {
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
                    if (this.checkPermission(pluginName, "onRequest")) {
                        priorities.normal.push(
                            async (req: any, res: any, next: any) => {
                                if (
                                    this.isPluginDisabled(
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
                                        this.maskRequest(req),
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

            // Add onResponse as middleware (using res.on('finish'))
            if (plugin?.onResponse) {
                try {
                    if (this.checkPermission(pluginName, "onResponse")) {
                        priorities.normal.push(
                            (req: any, res: any, next: any) => {
                                res.on("finish", async () => {
                                    try {
                                        if (
                                            this.isPluginDisabled(
                                                pluginName,
                                                "onResponse",
                                            )
                                        ) {
                                            return;
                                        }
                                        await plugin.onResponse!(
                                            this.maskRequest(req),
                                            res,
                                        );
                                    } catch (error) {
                                        this.logger.error(
                                            "plugins",
                                            `Error in ${pluginName}.onResponse:`,
                                            error,
                                        );
                                    }
                                });
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
                            // Check if plugin is enabled before calling onError
                            if (this.isPluginDisabled(plugin.name, "onError")) {
                                continue;
                            }
                            await plugin.onError!(
                                error,
                                this.maskRequest(req),
                                res,
                                next,
                            );
                        } catch (handlerError) {
                            this.logger.error(
                                "plugins",
                                `Error in ${plugin.name}.onError:`,
                                handlerError,
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
            `Error handlers applied for ${errorPlugins.length} plugin(s)`,
        );
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
            // Let's return the list of actual hooks the plugin has that are allowed
            if (allowedHooks === "*") {
                const actualHooks: string[] = [];
                const denied = pluginPerm?.deniedHooks || [];
                for (const internalName in HOOK_ID_MAP) {
                    if (typeof (plugin as any)[internalName] === "function") {
                        const id = HOOK_ID_MAP[internalName];
                        // Management hooks are only allowed if explicitly listed
                        // And explicitly denied hooks are excluded
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
                // Also filter denied hooks from the explicit allowed list
                const denied = pluginPerm?.deniedHooks || [];
                allowedHooks = allowedHooks.filter((h) => !denied.includes(h));
            }

            stats.push({
                name: plugin.name,
                version: plugin.version,
                description: plugin.description,
                enabled: !this.disabledPlugins.has(name),
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
                allowedHooks: allowed ? [hookId] : "*",
                deniedHooks: allowed ? [] : [hookId],
                policy: "allow",
            };
            this.server.app.configs.pluginPermissions.push(pluginPerm);
            return;
        }

        // If plugin already has an entry
        if (allowed) {
            // Remove from deniedHooks if it was there
            if (pluginPerm.deniedHooks) {
                pluginPerm.deniedHooks = pluginPerm.deniedHooks.filter(
                    (h: string) => h !== hookId,
                );
            }

            // Add to allowedHooks if it's not "*"
            if (Array.isArray(pluginPerm.allowedHooks)) {
                if (!pluginPerm.allowedHooks.includes(hookId)) {
                    pluginPerm.allowedHooks.push(hookId);
                }
            }
        } else {
            // Deny hook
            if (!pluginPerm.deniedHooks) {
                pluginPerm.deniedHooks = [];
            }
            if (!pluginPerm.deniedHooks.includes(hookId)) {
                pluginPerm.deniedHooks.push(hookId);
            }

            // Also remove from allowedHooks if it's there
            if (Array.isArray(pluginPerm.allowedHooks)) {
                pluginPerm.allowedHooks = pluginPerm.allowedHooks.filter(
                    (h: string) => h !== hookId,
                );
            }
        }
    }

    /**
     * Toggle plugin enabled/disabled state
     */
    togglePlugin(
        pluginName: string,
        enabled: boolean,
        by: string = "system",
    ): void {
        if (enabled) {
            this.disabledPlugins.delete(pluginName);
            this.logger.warn(
                "plugins",
                `Plugin '${pluginName}' enabled by ${by}`,
            );
        } else {
            this.disabledPlugins.add(pluginName);
            this.logger.warn(
                "plugins",
                `Plugin '${pluginName}' disabled by ${by}`,
            );
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
            if (visited.has(name)) {
                return;
            }

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


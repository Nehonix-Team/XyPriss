/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************** */

import { Logger } from "../../../shared/logger";
import type { PermissionManager } from "../PermissionManager";
import type { PluginRegistry } from "./PluginRegistry";
import type { XyPrissPlugin } from "../../types/PluginTypes";
import { XyPrissApp } from "../../..";

/**
 * Plugin Interceptor
 * Handles middleware application, route registration, and error handling
 */
export class PluginInterceptor {
    private registry: PluginRegistry;
    private permissionManager: PermissionManager;
    private logger: Logger;

    constructor(
        registry: PluginRegistry,
        permissionManager: PermissionManager,
        logger: Logger,
    ) {
        this.registry = registry;
        this.permissionManager = permissionManager;
        this.logger = logger;
    }

    /**
     * Register routes from all plugins
     */
    public registerRoutes(app: XyPrissApp): void {
        const order = this.registry.getOrder();
        for (const uid of order) {
            const plugin = this.registry.get(uid);
            if (plugin) {
                this.registerPluginRoutes(plugin, app);
            }
        }
    }

    /**
     * Register routes for a specific plugin
     */
    public registerPluginRoutes(
        plugin: XyPrissPlugin,
        app: XyPrissApp,
        isLate: boolean = false,
    ): void {
        if (plugin.registerRoutes) {
            try {
                if (
                    this.permissionManager.checkPermission(
                        plugin.name,
                        "registerRoutes",
                    )
                ) {
                    plugin.registerRoutes(app);
                    this.logger.debug(
                        "plugins",
                        `Registered routes for ${isLate ? "late " : ""}plugin: ${plugin.name}`,
                    );
                }
            } catch (error) {
                this.logger.error(
                    "plugins",
                    `Error registering routes for ${plugin.name}:`,
                    error,
                );
            }
        }
    }

    /**
     * Apply middleware from all plugins
     */
    public applyMiddleware(app: XyPrissApp): void {
        const order = this.registry.getOrder();
        console.log(
            `[PluginInterceptor] applyMiddleware called with ${order.length} plugins: ${order.join(", ")}`,
        );
        const priorities = { first: [], normal: [], last: [] } as any;

        for (const uid of order) {
            const plugin = this.registry.get(uid);
            if (plugin) {
                this.collectPluginMiddleware(plugin, priorities);
            }
        }

        // Apply in order: first, normal, last
        [...priorities.first, ...priorities.normal, ...priorities.last].forEach(
            (mw) => app.use(mw),
        );
    }

    /**
     * Apply middleware for a specific plugin (used for late registration)
     */
    public applyPluginMiddleware(plugin: XyPrissPlugin, app: XyPrissApp): void {
        const priorities = { first: [], normal: [], last: [] } as any;
        this.collectPluginMiddleware(plugin, priorities);

        const middleware = [
            ...priorities.first,
            ...priorities.normal,
            ...priorities.last,
        ];
        middleware.forEach((mw) => app.use(mw));

        if (middleware.length > 0) {
            this.logger.debug(
                "plugins",
                `Applied middleware for late plugin: ${plugin.name}`,
            );
        }
    }

    /**
     * Collect middleware from a plugin into the priorities object
     */
    private collectPluginMiddleware(
        plugin: XyPrissPlugin,
        priorities: any,
    ): void {
        // Standard middleware
        if (plugin.middleware) {
            try {
                if (
                    this.permissionManager.checkPermission(
                        plugin.name,
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
                    `Error applying middleware for ${plugin.name}:`,
                    error,
                );
            }
        }

        // onRequest hook
        if (plugin.onRequest) {
            try {
                if (
                    this.permissionManager.checkPermission(
                        plugin.name,
                        "onRequest",
                    )
                ) {
                    priorities.normal.push(
                        async (req: any, res: any, next: any) => {
                            if (
                                this.permissionManager.isPluginDisabled(
                                    plugin.name,
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
                                    this.permissionManager.maskRequest(
                                        req,
                                        plugin.name,
                                    ),
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
                                        `Logic Error in ${plugin.name}.onRequest: Plugin sent a response but also called next(). ` +
                                            `This is invalid and will cause subsequent route handlers to be skipped.`,
                                    );
                                }
                            } catch (error) {
                                this.logger.error(
                                    "plugins",
                                    `Error in ${plugin.name}.onRequest:`,
                                    error,
                                );
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
                    `Error applying onRequest for ${plugin.name}:`,
                    error,
                );
            }
        }

        // onResponse hook
        if (plugin.onResponse) {
            try {
                if (
                    this.permissionManager.checkPermission(
                        plugin.name,
                        "onResponse",
                    )
                ) {
                    priorities.normal.push((req: any, res: any, next: any) => {
                        const originalEnd = res.end;
                        res.end = (async (...args: any[]) => {
                            if (
                                !this.permissionManager?.isPluginDisabled(
                                    plugin.name,
                                    "onResponse",
                                )
                            ) {
                                try {
                                    await plugin.onResponse!(
                                        this.permissionManager.maskRequest(
                                            req,
                                            plugin.name,
                                        ),
                                        res,
                                    );
                                } catch (error) {
                                    this.logger.error(
                                        "plugins",
                                        `Error in ${plugin.name}.onResponse:`,
                                        error,
                                    );
                                }
                            }
                            return originalEnd.apply(res, args);
                        }) as any;
                        next();
                    });
                }
            } catch (error) {
                this.logger.error(
                    "plugins",
                    `Error applying onResponse for ${plugin.name}:`,
                    error,
                );
            }
        }
    }

    /**
     * Apply error handlers from all plugins
     */
    public applyErrorHandlers(app: XyPrissApp): void {
        const errorPlugins = this.registry
            .getAll()
            .filter((p) => typeof p.onError === "function");

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
                            this.permissionManager.maskRequest(
                                req,
                                plugin.name,
                            ),
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
}


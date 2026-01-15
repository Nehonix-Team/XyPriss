/**
 * Ultra-Fast Plugin Execution Engine
 *
 * High-performance plugin execution engine designed to achieve <1ms overhead
 * while maintaining security and comprehensive error handling.
 */

import { EventEmitter } from "events";
import { func } from "../../../mods/security/src/components/fortified-function";
import { NehoID } from "nehoid";
import {
    BasePlugin,
    PluginType,
    PluginExecutionContext,
    PluginExecutionResult,
    PluginEvent,
    PluginEventType,
} from "./types/PluginTypes";
import { PluginRegistry } from "./PluginRegistry";
import { HOOK_ID_MAP } from "../const/PluginHookIds";
import { SecureCacheAdapter } from "../../cache";
import { Request, Response, NextFunction } from "../../types";
import { InterceptedConsoleCall } from "../../server/components/fastapi/console/types";
import { Logger } from "../../../shared/logger";

/**
 * Ultra-fast plugin execution engine with intelligent optimization
 */
export class PluginEngine extends EventEmitter {
    private registry: PluginRegistry;
    private cache: SecureCacheAdapter;
    private logger: Logger;
    private warnedPermissions: Set<string> = new Set();
    private executionPool: Map<string, Promise<PluginExecutionResult>> =
        new Map();
    private warmupCache: Map<string, boolean> = new Map();

    // Performance optimization: Object pooling for contexts
    private contextPool: PluginExecutionContext[] = [];
    private readonly MAX_POOL_SIZE = 100;

    // Circuit breaker for failing plugins
    private circuitBreakers: Map<
        string,
        {
            failures: number;
            lastFailure: number;
            isOpen: boolean;
        }
    > = new Map();

    private permissions: any[] = [];

    constructor(
        registry: PluginRegistry,
        cache: SecureCacheAdapter,
        permissions: any[] = []
    ) {
        super();
        this.registry = registry;
        this.cache = cache;
        this.permissions = permissions;
        this.logger = new Logger();

        // Listen to registry events
        this.setupRegistryEventHandlers();
    }

    /**
     * Execute plugins for a specific type with ultra-fast performance
     */
    public async executePlugins(
        type: PluginType,
        req: Request,
        res: Response,
        next: NextFunction
    ): Promise<boolean> {
        const startTime = performance.now();
        const executionId = NehoID.generate({ prefix: "plug.exec", size: 8 });

        try {
            // Get plugins for this type (pre-sorted by priority)
            const plugins = this.registry.getPluginsByType(type);

            if (plugins.length === 0) {
                return true; // Continue execution if no plugins
            }

            // Create or reuse execution context
            const context = this.createExecutionContext(
                req,
                res,
                next,
                executionId,
                startTime
            );

            // Execute plugins based on type strategy
            const success = await this.executePluginChain(plugins, context);

            // Update performance metrics
            const totalExecutionTime = performance.now() - startTime;
            this.updatePerformanceMetrics(type, totalExecutionTime, success);

            // Return context to pool
            this.returnContextToPool(context);

            return success;
        } catch (error: any) {
            const executionTime = performance.now() - startTime;
            this.handleExecutionError(type, executionId, error, executionTime);
            return false;
        }
    }

    /**
     * Set permissions for plugins
     */
    public setPermissions(permissions: any[]): void {
        this.permissions = permissions;
    }

    /**
     * Check if a plugin has permission for a specific hook
     */
    private checkPermission(plugin: BasePlugin, hookName: string): boolean {
        // If no permissions configured, privileged hooks are denied
        const hookId = HOOK_ID_MAP[hookName] || hookName;
        const isPrivileged = [
            HOOK_ID_MAP.managePlugins,
            HOOK_ID_MAP.onConsoleIntercept,
        ].includes(hookId);

        const pluginId = plugin.id;
        const pluginName = plugin.name;

        if (!this.permissions || this.permissions.length === 0) {
            if (isPrivileged) {
                this.logPermissionError(
                    pluginId,
                    hookId,
                    "privileged hook denied by default"
                );
                return false;
            }
            return true;
        }

        const pluginPerm = this.permissions.find(
            (p) =>
                p.name === pluginId ||
                p.id === pluginId ||
                p.name === pluginName ||
                p.id === pluginName
        );

        let allowed = true;
        let reason = "";

        if (!pluginPerm) {
            if (isPrivileged) {
                allowed = false;
                reason =
                    "privileged hook denied (no explicit permission found for this plugin)";
            }
        } else if (pluginPerm.deniedHooks?.includes(hookId)) {
            allowed = false;
            reason = "hook explicitly denied";
        } else {
            const policy = pluginPerm.policy || "allow";
            const allowedHooks = pluginPerm.allowedHooks || "*";

            if (policy === "deny") {
                if (allowedHooks === "*") {
                    allowed = true;
                } else {
                    allowed =
                        Array.isArray(allowedHooks) &&
                        allowedHooks.includes(hookId);
                    if (!allowed)
                        reason = "hook not in allowed list (deny policy)";
                }
            } else {
                // policy === "allow"
                if (isPrivileged) {
                    if (allowedHooks === "*") {
                        allowed = true;
                    } else {
                        allowed =
                            Array.isArray(allowedHooks) &&
                            allowedHooks.includes(hookId);
                        if (!allowed)
                            reason =
                                "privileged hook requires explicit allowance";
                    }
                }
            }
        }

        if (!allowed) {
            this.logPermissionError(pluginId, hookId, reason);
            return false;
        }

        return true;
    }

    private logPermissionError(
        pluginId: string,
        hookId: string,
        reason: string
    ): void {
        const warnKey = `${pluginId}:${hookId}`;
        if (!this.warnedPermissions.has(warnKey)) {
            this.logger.error(
                "plugins",
                `Security Error: Plugin '${pluginId}' attempted to use hook '${hookId}' but permission was denied (${reason}).`
            );
            this.warnedPermissions.add(warnKey);
        }
    }

    /**
     * Trigger console log hook on all registered plugins
     */
    public triggerConsoleLogHook(log: InterceptedConsoleCall): void {
        const plugins = this.registry.getAllPlugins();

        plugins.forEach((plugin) => {
            const hook = (plugin as any).onConsoleIntercept;
            if (typeof hook !== "function") return;

            // Check permission for onConsoleIntercept
            if (!this.checkPermission(plugin, "onConsoleIntercept")) {
                return;
            }
            try {
                // Execute synchronously to avoid log ordering issues
                hook.call(plugin, log);
            } catch (error) {
                this.emitPluginEvent(PluginEventType.PLUGIN_ERROR, plugin.id, {
                    hook: "onConsoleIntercept",
                    error,
                });
            }
        });
    }

    /**
     * Execute a single plugin with comprehensive error handling
     */
    public async executePlugin(
        plugin: BasePlugin,
        context: PluginExecutionContext
    ): Promise<PluginExecutionResult> {
        const startTime = performance.now();

        try {
            // Check circuit breaker
            if (this.isCircuitBreakerOpen(plugin.id)) {
                return {
                    success: false,
                    executionTime: 0,
                    error: new Error(
                        `Circuit breaker open for plugin ${plugin.id}`
                    ),
                    shouldContinue: true,
                };
            }

            // Warm up plugin if needed
            await this.warmupPlugin(plugin, context);

            // Execute plugin with timeout
            const result = await this.executeWithTimeout(plugin, context);

            const executionTime = performance.now() - startTime;
            result.executionTime = executionTime;

            // Update plugin statistics
            this.registry.updateStats(plugin.id, executionTime, result.success);

            // Reset circuit breaker on success
            if (result.success) {
                this.resetCircuitBreaker(plugin.id);
            } else {
                this.updateCircuitBreaker(plugin.id);
            }

            // Emit execution event
            this.emitPluginEvent(PluginEventType.PLUGIN_EXECUTED, plugin.id, {
                executionTime,
                success: result.success,
                type: plugin.type,
            });

            return result;
        } catch (error: any) {
            const executionTime = performance.now() - startTime;

            // Update circuit breaker
            this.updateCircuitBreaker(plugin.id);

            // Update error statistics
            this.registry.updateStats(plugin.id, executionTime, false);

            // Emit error event
            this.emitPluginEvent(PluginEventType.PLUGIN_ERROR, plugin.id, {
                error: error.message,
                executionTime,
                type: plugin.type,
            });

            return {
                success: false,
                executionTime,
                error,
                shouldContinue: true,
            };
        }
    }

    /**
     * Execute plugin chain with intelligent optimization
     */
    private async executePluginChain(
        plugins: BasePlugin[],
        context: PluginExecutionContext
    ): Promise<boolean> {
        // For critical performance plugins, execute in parallel
        if (plugins.length > 0 && plugins[0].type === PluginType.PERFORMANCE) {
            return await this.executePluginsParallel(plugins, context);
        }

        // For security and cache plugins, execute sequentially
        return await this.executePluginsSequential(plugins, context);
    }

    /**
     * Execute plugins sequentially (for security, cache operations)
     */
    private async executePluginsSequential(
        plugins: BasePlugin[],
        context: PluginExecutionContext
    ): Promise<boolean> {
        for (const plugin of plugins) {
            const result = await this.executePlugin(plugin, context);

            if (!result.success && plugin.type === PluginType.SECURITY) {
                // Security plugins must succeed
                return false;
            }

            if (!result.shouldContinue) {
                // Plugin requested to stop execution
                return false;
            }

            // Store plugin result data
            if (result.data) {
                context.pluginData.set(plugin.id, result.data);
            }

            // Handle cache data
            if (result.cacheData) {
                await this.cache.set(
                    result.cacheData.key,
                    result.cacheData.value,
                    { ttl: result.cacheData.ttl }
                );
            }
        }

        return true;
    }

    /**
     * Execute plugins in parallel (for performance monitoring)
     */
    private async executePluginsParallel(
        plugins: BasePlugin[],
        context: PluginExecutionContext
    ): Promise<boolean> {
        const promises = plugins.map((plugin) =>
            this.executePlugin(plugin, context)
        );
        const results = await Promise.allSettled(promises);

        let allSuccessful = true;

        results.forEach((result, index) => {
            if (result.status === "fulfilled") {
                const pluginResult = result.value;
                if (!pluginResult.success) {
                    allSuccessful = false;
                }

                // Store plugin result data
                if (pluginResult.data) {
                    context.pluginData.set(
                        plugins[index].id,
                        pluginResult.data
                    );
                }
            } else {
                allSuccessful = false;
            }
        });

        return allSuccessful;
    }

    /**
     * Execute plugin with timeout protection
     */
    private async executeWithTimeout(
        plugin: BasePlugin,
        context: PluginExecutionContext
    ): Promise<PluginExecutionResult> {
        const timeoutMs = plugin.maxExecutionTime;

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.emitPluginEvent(
                    PluginEventType.PLUGIN_TIMEOUT,
                    plugin.id,
                    {
                        timeout: timeoutMs,
                        type: plugin.type,
                    }
                );
                reject(
                    new Error(
                        `Plugin ${plugin.id} timed out after ${timeoutMs}ms`
                    )
                );
            }, timeoutMs);

            // Execute plugin
            const execution = plugin.isAsync
                ? (plugin.execute(context) as Promise<PluginExecutionResult>)
                : Promise.resolve(
                      plugin.execute(context) as PluginExecutionResult
                  );

            execution
                .then((result) => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch((error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }

    /**
     * Create optimized execution context with object pooling
     */
    private createExecutionContext(
        req: Request,
        res: Response,
        next: NextFunction,
        executionId: string,
        startTime: number
    ): PluginExecutionContext {
        // Try to reuse context from pool
        let context = this.contextPool.pop();

        if (!context) {
            context = {
                req,
                res,
                next,
                startTime,
                executionId,
                cache: this.cache,
                pluginData: new Map(),
                security: {
                    isAuthenticated: false,
                    roles: [],
                    permissions: [],
                },
                metrics: {
                    requestStartTime: startTime,
                    pluginExecutionTimes: new Map(),
                    cacheHits: 0,
                    cacheMisses: 0,
                },
            };
        } else {
            // Reset reused context
            context.req = req;
            context.res = res;
            context.next = next;
            context.startTime = startTime;
            context.executionId = executionId;
            context.pluginData.clear();
            context.metrics.pluginExecutionTimes.clear();
            context.metrics.requestStartTime = startTime;
            context.metrics.cacheHits = 0;
            context.metrics.cacheMisses = 0;
        }

        return context;
    }

    /**
     * Return context to pool for reuse
     */
    private returnContextToPool(context: PluginExecutionContext): void {
        if (this.contextPool.length < this.MAX_POOL_SIZE) {
            // Clear sensitive data before returning to pool
            context.pluginData.clear();
            context.metrics.pluginExecutionTimes.clear();
            this.contextPool.push(context);
        }
    }

    /**
     * Warm up plugin for optimal performance
     */
    private async warmupPlugin(
        plugin: BasePlugin,
        context: PluginExecutionContext
    ): Promise<void> {
        if (this.warmupCache.has(plugin.id)) {
            return; // Already warmed up
        }

        if (plugin.warmup) {
            try {
                await plugin.warmup(context);
                this.warmupCache.set(plugin.id, true);
            } catch (error) {
                // Warmup failure is not critical
                console.warn(`Plugin ${plugin.id} warmup failed:`, error);
            }
        }
    }

    /**
     * Circuit breaker management
     */
    private isCircuitBreakerOpen(pluginId: string): boolean {
        const breaker = this.circuitBreakers.get(pluginId);
        if (!breaker) return false;

        // Reset circuit breaker after 60 seconds
        if (breaker.isOpen && Date.now() - breaker.lastFailure > 60000) {
            breaker.isOpen = false;
            breaker.failures = 0;
        }

        return breaker.isOpen;
    }

    private updateCircuitBreaker(pluginId: string): void {
        const breaker = this.circuitBreakers.get(pluginId) || {
            failures: 0,
            lastFailure: 0,
            isOpen: false,
        };

        breaker.failures++;
        breaker.lastFailure = Date.now();

        // Open circuit breaker after 5 failures
        if (breaker.failures >= 5) {
            breaker.isOpen = true;
        }

        this.circuitBreakers.set(pluginId, breaker);
    }

    private resetCircuitBreaker(pluginId: string): void {
        this.circuitBreakers.delete(pluginId);
    }

    /**
     * Setup registry event handlers
     */
    private setupRegistryEventHandlers(): void {
        this.registry.on(
            PluginEventType.PLUGIN_UNREGISTERED,
            (event: PluginEvent) => {
                // Clean up plugin-specific data
                this.circuitBreakers.delete(event.pluginId);
                this.warmupCache.delete(event.pluginId);
            }
        );
    }

    /**
     * Update performance metrics
     */
    private updatePerformanceMetrics(
        type: PluginType,
        executionTime: number,
        success: boolean
    ): void {
        // Emit performance metrics for monitoring
        this.emit("performance", {
            type,
            executionTime,
            success,
            timestamp: Date.now(),
        });
    }

    /**
     * Handle execution errors
     */
    private handleExecutionError(
        type: PluginType,
        executionId: string,
        error: Error,
        executionTime: number
    ): void {
        console.error(
            `Plugin execution error [${type}] [${executionId}]:`,
            error
        );

        this.emit("error", {
            type,
            executionId,
            error,
            executionTime,
            timestamp: Date.now(),
        });
    }

    /**
     * Emit plugin event
     */
    private emitPluginEvent(
        type: PluginEventType,
        pluginId: string,
        data?: any
    ): void {
        const event: PluginEvent = {
            type,
            pluginId,
            timestamp: new Date(),
            data,
        };

        this.emit(type, event);
    }

    /**
     * Get engine statistics (ultra-fast optimized)
     */
    public getEngineStats(): {
        contextPoolSize: number;
        circuitBreakersOpen: number;
        warmedUpPlugins: number;
        activeExecutions: number;
    } {
        // Ultra-fast: Count open circuit breakers without creating arrays
        let circuitBreakersOpen = 0;
        this.circuitBreakers.forEach((breaker) => {
            if (breaker.isOpen) circuitBreakersOpen++;
        });

        return {
            contextPoolSize: this.contextPool.length,
            circuitBreakersOpen,
            warmedUpPlugins: this.warmupCache.size,
            activeExecutions: this.executionPool.size,
        };
    }
}


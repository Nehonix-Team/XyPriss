/**
 * Network Plugin Base Class
 *
 * Abstract base class for all network-related plugins in XyPriss
 * Provides common functionality and interfaces for network operations
 */

import { performance } from "perf_hooks";
import {
    PluginType,
    PluginPriority,
    PluginExecutionContext,
    PluginExecutionResult,
} from "../../types/PluginTypes";
import {
    NetworkPlugin as INetworkPlugin,
    NetworkExecutionContext,
    NetworkExecutionResult,
    NetworkCategory,
    NetworkHealthStatus,
    NetworkPluginConfig,
} from "../types/NetworkTypes";

/**
 * Abstract base class for network plugins
 * Provides common functionality and enforces network plugin contracts
 */
export abstract class NetworkPlugin implements INetworkPlugin {
    // Base plugin properties
    public readonly type = PluginType.NETWORK;
    public readonly priority = PluginPriority.NORMAL;
    public readonly isAsync = true;
    public readonly isCacheable = false; // Network operations typically shouldn't be cached
    public readonly maxExecutionTime = 1000; // 1ms max for network operations

    // Network-specific properties (to be implemented by subclasses)
    public abstract readonly id: string;
    public abstract readonly name: string;
    public abstract readonly version: string;
    public abstract readonly networkCategory: NetworkCategory;

    // Configuration and state
    protected config: NetworkPluginConfig;
    protected isInitialized = false;
    protected healthStatus: NetworkHealthStatus;
    protected performanceMetrics: {
        totalExecutions: number;
        totalExecutionTime: number;
        averageExecutionTime: number;
        errorCount: number;
        lastExecution: Date;
    };

    constructor(config: NetworkPluginConfig = {} as NetworkPluginConfig) {
        this.config = config;
        this.healthStatus = {
            healthy: true,
            status: "healthy",
            metrics: {
                responseTime: 0,
                errorRate: 0,
                throughput: 0,
                connections: 0,
            },
            lastCheck: new Date(),
        };
        this.performanceMetrics = {
            totalExecutions: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            errorCount: 0,
            lastExecution: new Date(),
        };
    }

    /**
     * Initialize the network plugin
     */
    public async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        try {
            // Validate configuration
            if (
                this.validateNetworkConfig &&
                !this.validateNetworkConfig(this.config)
            ) {
                throw new Error(
                    `Invalid configuration for network plugin ${this.id}`,
                );
            }

            // Perform plugin-specific initialization
            await this.initializeNetwork();

            // Perform initial health check
            await this.updateHealthStatus();

            this.isInitialized = true;
        } catch (error: any) {
            throw new Error(
                `Failed to initialize network plugin ${this.id}: ${error.message}`,
            );
        }
    }

    /**
     * Execute the plugin (implements BasePlugin interface)
     */
    public async execute(
        context: PluginExecutionContext,
    ): Promise<PluginExecutionResult> {
        const startTime = performance.now();
        const isXhscRunning = process.env.XYPRISS_IPC_PATH !== undefined;
        if (isXhscRunning) {
            console.log(
                `[NETWORK] operation [${this.id}] is optimized by Go backend`,
            );
        }
        console.log(`🥰 executing ${this.name}....`);

        try {
            // Convert to network execution context
            const networkContext = this.createNetworkContext(context);

            // Execute network-specific logic
            const result = await this.executeNetwork(networkContext);

            // Update performance metrics
            const executionTime = performance.now() - startTime;
            this.updatePerformanceMetrics(executionTime, true);

            return {
                success: result.success,
                executionTime,
                shouldContinue: result.shouldContinue,
                data: result.data,
                error: result.error,
            };
        } catch (error: any) {
            const executionTime = performance.now() - startTime;
            this.updatePerformanceMetrics(executionTime, false);

            return {
                success: false,
                executionTime,
                shouldContinue: true, // Continue with other plugins on network errors
                error,
            };
        }
    }

    /**
     * Abstract method for network-specific execution
     * Must be implemented by subclasses
     */
    public abstract executeNetwork(
        context: NetworkExecutionContext,
    ): Promise<NetworkExecutionResult>;

    /**
     * Plugin-specific initialization (to be overridden by subclasses)
     */
    protected async initializeNetwork(): Promise<void> {
        // Default implementation - can be overridden
    }

    /**
     * Create network execution context from base context
     */
    protected createNetworkContext(
        context: PluginExecutionContext,
    ): NetworkExecutionContext {
        const { req } = context;

        return {
            ...context,
            connection: {
                remoteAddress: req.ip || req.socket?.remoteAddress,
                remotePort: req.socket?.remotePort,
                localAddress: req.socket?.localAddress,
                localPort: req.socket?.localPort,
                encrypted: req.secure || false,
                protocol: req.httpVersion
                    ? `http/${req.httpVersion}`
                    : "http/1.1",
            },
            timing: {
                startTime: Date.now(),
            },
            networkMetrics: {
                bytesReceived: parseInt(req.get("content-length") || "0"),
                bytesSent: 0, // Will be updated after response
            },
        };
    }

    /**
     * Update performance metrics
     */
    protected updatePerformanceMetrics(
        executionTime: number,
        success: boolean,
    ): void {
        this.performanceMetrics.totalExecutions++;
        this.performanceMetrics.totalExecutionTime += executionTime;
        this.performanceMetrics.averageExecutionTime =
            this.performanceMetrics.totalExecutionTime /
            this.performanceMetrics.totalExecutions;

        if (!success) {
            this.performanceMetrics.errorCount++;
        }

        this.performanceMetrics.lastExecution = new Date();
    }

    /**
     * Update health status
     */
    protected async updateHealthStatus(): Promise<void> {
        try {
            if (this.checkNetworkHealth) {
                this.healthStatus = await this.checkNetworkHealth();
            } else {
                // Default health check based on performance metrics
                const errorRate =
                    this.performanceMetrics.errorCount /
                    Math.max(this.performanceMetrics.totalExecutions, 1);

                this.healthStatus = {
                    healthy:
                        errorRate < 0.1 &&
                        this.performanceMetrics.averageExecutionTime <
                            this.maxExecutionTime,
                    status:
                        errorRate < 0.05
                            ? "healthy"
                            : errorRate < 0.1
                              ? "degraded"
                              : "unhealthy",
                    metrics: {
                        responseTime:
                            this.performanceMetrics.averageExecutionTime,
                        errorRate,
                        throughput: this.performanceMetrics.totalExecutions,
                        connections: 0, // Plugin-specific
                    },
                    lastCheck: new Date(),
                };
            }
        } catch (error: any) {
            this.healthStatus = {
                healthy: false,
                status: "unhealthy",
                metrics: {
                    responseTime: 0,
                    errorRate: 1,
                    throughput: 0,
                    connections: 0,
                },
                issues: [`Health check failed: ${error.message}`],
                lastCheck: new Date(),
            };
        }
    }

    /**
     * Get plugin configuration
     */
    public getConfig(): NetworkPluginConfig {
        return { ...this.config };
    }

    /**
     * Update plugin configuration
     */
    public updateConfig(newConfig: Partial<NetworkPluginConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get health status
     */
    public getHealthStatus(): NetworkHealthStatus {
        return { ...this.healthStatus };
    }

    /**
     * Get performance metrics
     */
    public getPerformanceMetrics() {
        return { ...this.performanceMetrics };
    }

    /**
     * Cleanup resources (to be overridden by subclasses if needed)
     */
    public async destroy(): Promise<void> {
        this.isInitialized = false;
    }

    // Optional lifecycle methods (can be overridden by subclasses)
    public async onConnectionOpen?(
        context: NetworkExecutionContext,
    ): Promise<void>;
    public async onConnectionClose?(
        context: NetworkExecutionContext,
    ): Promise<void>;
    public async onRequestStart?(
        context: NetworkExecutionContext,
    ): Promise<void>;
    public async onRequestEnd?(context: NetworkExecutionContext): Promise<void>;

    // Optional configuration validation (can be overridden by subclasses)
    public validateNetworkConfig?(config: any): boolean;

    // Optional health check (can be overridden by subclasses)
    public checkNetworkHealth?(): Promise<NetworkHealthStatus>;
}


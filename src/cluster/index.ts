
/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license NOSL
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
 * XyPrissJS Express Cluster Module
 *  cluster management system with advanced monitoring and auto-scaling
 *
 * @version 1.0.0
 * @author XyPrissJS Team
 */
 
import {
    ClusterBuilder,
    ClusterConfig,
    RobustClusterManager,
} from "../types/cluster";
import {
    buildCluster,
    ClusterFactory,
    clusterFactory,
    createClusterForEnvironment,
} from "./modules/ClusterFactory";

// Core cluster management
export { ClusterManager } from "./cluster-manager";
export { WorkerManager } from "./modules/WorkerManager";
export { HealthMonitor } from "./modules/HealthMonitor";
export { LoadBalancer } from "./modules/strategy/LoadBalancer";
export { IPCManager } from "./modules/IPCManager";
export { MetricsCollector } from "./modules/MetricsCollector";
export { AutoScaler } from "./modules/AutoScaler";

// Factory and builder patterns
export {
    ClusterFactory,
    ClusterConfigBuilder,
    ClusterBuilderFactoryImpl,
    clusterFactory,
    clusterBuilderFactory,
    createCluster,
    createClusterForEnvironment,
    buildCluster,
} from "./modules/ClusterFactory";

// Type definitions (re-export from types)
export type {
    ClusterConfig,
    RobustClusterManager,
    ClusterMetrics,
    WorkerMetrics,
    ClusterState,
    ClusterEvents,
    WorkerPool,
    LoadBalancer as LoadBalancerInterface,
    HealthChecker,
    AutoScaler as AutoScalerInterface,
    ClusterFactory as ClusterFactoryInterface,
    ClusterBuilder,
    ClusterBuilderFactory,
    ClusterServerOptions,
    ClusterMiddleware,
    ClusterConfiguration,
} from "../types/cluster";

/**
 * Quick start functions for common use cases
 */

/**
 * Create a development cluster with sensible defaults
 * - 2 workers
 * - Auto-scaling disabled
 * - Debug logging enabled
 * - Hot reload enabled
 */
export function createDevelopmentCluster(): RobustClusterManager {
    return createClusterForEnvironment("development");
}

/**
 * Create a production cluster with maximum performance and security
 * - Auto worker count based on CPU cores
 * - Auto-scaling enabled
 * - Full security features
 * - Circuit breaker and resilience features
 */
export function createProductionCluster(): RobustClusterManager {
    return createClusterForEnvironment("production");
}

/**
 * Create a test cluster with minimal overhead
 * - Single worker
 * - Monitoring disabled
 * - Auto-scaling disabled
 */
export function createTestCluster(): RobustClusterManager {
    return createClusterForEnvironment("test");
}

/**
 * Create an API server cluster optimized for REST APIs
 * - Least-connections load balancing
 * - Aggressive auto-scaling
 * - Fast health checks
 */
export function createApiCluster(): RobustClusterManager {
    return clusterFactory.create(clusterFactory.getRecommendedConfig("api"));
}

/**
 * Create a web server cluster optimized for web applications
 * - Round-robin load balancing with session affinity
 * - Moderate auto-scaling
 * - Sticky sessions enabled
 */
export function createWebCluster(): RobustClusterManager {
    return clusterFactory.create(clusterFactory.getRecommendedConfig("web"));
}

/**
 * Create a microservice cluster optimized for containerized environments
 * - Resource-constrained configuration
 * - Conservative auto-scaling
 * - Lightweight monitoring
 */
export function createMicroserviceCluster(): RobustClusterManager {
    return clusterFactory.create(
        clusterFactory.getRecommendedConfig("microservice")
    );
}

/**
 * Create a worker cluster optimized for background processing
 * - CPU-based worker count
 * - Weighted load balancing
 * - High restart tolerance
 */
export function createWorkerCluster(): RobustClusterManager {
    return clusterFactory.create(clusterFactory.getRecommendedConfig("worker"));
}

/**
 * Builder pattern for custom cluster configuration
 *
 * @example
 * ```typescript
 * const cluster = clusterBuilder()
 *   .withWorkers(4)
 *   .withAutoScaling({
 *     enabled: true,
 *     minWorkers: 2,
 *     maxWorkers: 8
 *   })
 *   .withLoadBalancing("least-connections")
 *   .enableProductionMode()
 *   .create();
 *
 * await cluster.start();
 * ```
 */
export function clusterBuilder(): ClusterBuilder {
    return buildCluster();
}

/**
 * Validate cluster configuration
 *
 * @example
 * ```typescript
 * const config = { workers: 4, autoScaling: { enabled: true } };
 * const validation = validateClusterConfig(config);
 *
 * if (!validation.valid) {
 *   console.error("Configuration errors:", validation.errors);
 * }
 * ```
 */
export function validateClusterConfig(config: ClusterConfig): {
    valid: boolean;
    errors: string[];
} {
    return clusterFactory.validateConfig(config);
}

/**
 * Get recommended configuration for specific server type
 *
 * @example
 * ```typescript
 * const apiConfig = getRecommendedConfig("api");
 * const cluster = createCluster(apiConfig);
 * ```
 */
export function getRecommendedConfig(
    serverType: "api" | "web" | "microservice" | "worker"
): ClusterConfig {
    return clusterFactory.getRecommendedConfig(serverType);
}

/**
 * Merge multiple cluster configurations
 *
 * @example
 * ```typescript
 * const baseConfig = getRecommendedConfig("api");
 * const customConfig = { workers: 8 };
 * const finalConfig = mergeClusterConfigs(baseConfig, customConfig);
 * ```
 */
export function mergeClusterConfigs(
    base: ClusterConfig,
    ...overrides: Partial<ClusterConfig>[]
): ClusterConfig {
    let result = base;
    for (const override of overrides) {
        result = clusterFactory.mergeConfigs(result, override);
    }
    return result;
}

/**
 * Set global default configuration for all clusters
 *
 * @example
 * ```typescript
 * setClusterDefaults({
 *   monitoring: { logLevel: "debug" },
 *   security: { encryptIPC: true }
 * });
 * ```
 */
export function setClusterDefaults(config: Partial<ClusterConfig>): void {
    ClusterFactory.setDefaults(config);
}

/**
 * Cluster middleware for Express integration
 * Provides cluster information and utilities to Express routes
 */
export function createClusterMiddleware(cluster: RobustClusterManager) {
    return (req: any, res: any, next: any) => {
        // Add cluster utilities to request object
        req.cluster = {
            workerId: process.env.WORKER_ID || "master",
            isMainProcess: !process.env.WORKER_ID,
            isMaster: !process.env.WORKER_ID,
            sendToMaster: async (message: any) => {
                if (process.send) {
                    process.send(message);
                }
            },
            sendToWorker: async (workerId: string, message: any) => {
                await cluster.sendToWorker(workerId, message);
            },
            broadcast: async (message: any) => {
                await cluster.broadcast(message);
            },
            getMetrics: async () => {
                return await cluster.getMetrics();
            },
            getHealth: async () => {
                return await cluster.getHealthStatus();
            },
        };

        // Add cluster headers
        res.set("X-Cluster-Worker", req.cluster.workerId);
        res.set(
            "X-Cluster-Process",
            req.cluster.isMainProcess ? "master" : "worker"
        );

        next();
    };
}

/**
 * Express server integration with cluster support
 * Automatically detects if running in cluster mode and provides utilities
 */
export function withClusterSupport(app: any, cluster?: RobustClusterManager) {
    // Add cluster middleware if cluster is provided
    if (cluster) {
        app.use(createClusterMiddleware(cluster));
    }

    // Add cluster health endpoint
    app.get("/cluster/health", async (req: any, res: any) => {
        try {
            if (cluster) {
                const health = await cluster.getHealthStatus();
                const metrics = await cluster.getAggregatedMetrics();

                res.json({
                    status: "healthy",
                    cluster: {
                        enabled: true,
                        workers: Object.keys(health).length,
                        healthy: Object.values(health).filter((h) => h).length,
                        metrics,
                    },
                });
            } else {
                res.json({
                    status: "healthy",
                    cluster: {
                        enabled: false,
                        workers: 1,
                        healthy: 1,
                    },
                });
            }
        } catch (error: any) {
            res.status(503).json({
                status: "error",
                error: error.message,
            });
        }
    });

    // Add cluster metrics endpoint
    app.get("/cluster/metrics", async (req: any, res: any) => {
        try {
            if (cluster) {
                const format = req.query.format || "json";
                const metrics = await cluster.exportMetrics(format as any);

                if (format === "prometheus") {
                    res.set("Content-Type", "text/plain");
                    res.send(metrics);
                } else if (format === "csv") {
                    res.set("Content-Type", "text/csv");
                    res.send(metrics);
                } else {
                    res.json(JSON.parse(metrics));
                }
            } else {
                res.json({ error: "Cluster not enabled" });
            }
        } catch (error: any) {
            res.status(500).json({
                error: error.message,
            });
        }
    });

    return app;
}

/**
 * Default export for convenience
 */
export default {
    createDevelopmentCluster,
    createProductionCluster,
    createTestCluster,
    createApiCluster,
    createWebCluster,
    createMicroserviceCluster,
    createWorkerCluster,
    clusterBuilder,
    validateClusterConfig,
    getRecommendedConfig,
    mergeClusterConfigs,
    setClusterDefaults,
    createClusterMiddleware,
    withClusterSupport,
};


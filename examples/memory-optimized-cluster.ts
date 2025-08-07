/**
 * Memory-optimized cluster configurations for different environments
 */

import { createServer } from "../src";

// Set environment variables for security module
process.env.ENC_SECRET_KEY = "dae5a3943d538d0b8c43866ee11df27c96cb26941e255113278ba293b28a2789";
process.env.ENC_SECRET_SEED = "b7f4c99888ea948f8a4bd24a5c0dc088ece8828846d787a71abcccd9048c6919";
process.env.ENC_SECRET_SALT = "b07af8f0c9138d730928cf9437116fa661e2b0c51b6799585611ef88db95fe91";

/**
 * Configuration for low memory environments (< 4GB RAM)
 * Optimized for minimal resource usage while maintaining functionality
 */
export const lowMemoryConfig = {
    cluster: {
        enabled: true,
        config: {
            workers: 2, // Conservative worker count
            resources: {
                maxMemoryPerWorker: "256MB", // Small per-worker limit
                
                memoryManagement: {
                    enabled: true,
                    maxTotalMemory: "1.5GB", // Total cluster limit
                    memoryCheckInterval: 20000, // Check every 20 seconds
                    memoryWarningThreshold: 60, // Early warning
                    memoryCriticalThreshold: 75, // Early critical
                    autoScaleOnMemory: true,
                    memoryLeakDetection: true,
                    garbageCollectionHint: true,
                    lowMemoryMode: true, // Enable optimizations
                    memoryReservation: "512MB", // Reserve for system
                    swapUsageLimit: 5, // Minimal swap usage
                },

                performanceOptimization: {
                    enabled: true,
                    lowMemoryMode: true,
                    reducedLogging: true,
                    compactMetrics: true,
                    lazyWorkerInit: true,
                    workerPooling: true,
                    memoryPooling: true,
                    disableDebugFeatures: true,
                    minimalFootprint: true,
                    efficientDataStructures: true,
                },

                enforcement: {
                    enabled: true,
                    enforceHardLimits: false, // Graceful handling
                    softLimitWarnings: true,
                    gracefulDegradation: true,
                    resourceThrottling: true,
                    alertOnLimitReached: true,
                },
            },

            autoScaling: {
                enabled: true,
                minWorkers: 1,
                maxWorkers: 3, // Limited scaling
                memoryBasedScaling: true,
                aggressiveMemoryScaling: true,
                scaleDownThreshold: { memory: 25 },
                scaleUpThreshold: { memory: 70 },
                cooldownPeriod: 60000, // 1 minute cooldown
            },
        },
    },
    
    logging: {
        enabled: true,
        types: { debug: false }, // Reduce logging
        components: { cluster: true },
    },
};

/**
 * Configuration for medium memory environments (4-8GB RAM)
 * Balanced between performance and resource usage
 */
export const mediumMemoryConfig = {
    cluster: {
        enabled: true,
        config: {
            workers: "auto", // Let system optimize
            resources: {
                maxMemoryPerWorker: "512MB",
                
                memoryManagement: {
                    enabled: true,
                    maxTotalMemory: "4GB",
                    memoryCheckInterval: 30000,
                    memoryWarningThreshold: 75,
                    memoryCriticalThreshold: 90,
                    autoScaleOnMemory: true,
                    memoryLeakDetection: true,
                    garbageCollectionHint: false,
                    lowMemoryMode: false,
                    memoryReservation: "1GB",
                    swapUsageLimit: 10,
                },

                performanceOptimization: {
                    enabled: true,
                    lowMemoryMode: false,
                    reducedLogging: false,
                    compactMetrics: true,
                    lazyWorkerInit: false,
                    workerPooling: true,
                    memoryPooling: true,
                    disableDebugFeatures: false,
                    minimalFootprint: false,
                    efficientDataStructures: true,
                },

                enforcement: {
                    enabled: true,
                    enforceHardLimits: false,
                    softLimitWarnings: true,
                    gracefulDegradation: true,
                    resourceThrottling: false,
                    alertOnLimitReached: true,
                },
            },

            autoScaling: {
                enabled: true,
                minWorkers: 2,
                maxWorkers: 6,
                memoryBasedScaling: true,
                aggressiveMemoryScaling: false,
                scaleDownThreshold: { memory: 30 },
                scaleUpThreshold: { memory: 80 },
                cooldownPeriod: 45000,
            },
        },
    },
    
    logging: {
        enabled: true,
        types: { debug: true },
        components: { cluster: true },
    },
};

/**
 * Configuration for high memory environments (> 8GB RAM)
 * Optimized for performance with generous resource allocation
 */
export const highMemoryConfig = {
    cluster: {
        enabled: true,
        config: {
            workers: "auto",
            resources: {
                maxMemoryPerWorker: "1GB", // Generous per-worker limit
                
                memoryManagement: {
                    enabled: true,
                    maxTotalMemory: "8GB",
                    memoryCheckInterval: 60000, // Less frequent checks
                    memoryWarningThreshold: 85,
                    memoryCriticalThreshold: 95,
                    autoScaleOnMemory: true,
                    memoryLeakDetection: true,
                    garbageCollectionHint: true,
                    lowMemoryMode: false,
                    memoryReservation: "2GB",
                    swapUsageLimit: 15,
                },

                performanceOptimization: {
                    enabled: true,
                    lowMemoryMode: false,
                    reducedLogging: false,
                    compactMetrics: false,
                    lazyWorkerInit: false,
                    workerPooling: true,
                    memoryPooling: true,
                    disableDebugFeatures: false,
                    minimalFootprint: false,
                    efficientDataStructures: false, // Use standard structures
                },

                enforcement: {
                    enabled: true,
                    enforceHardLimits: true, // Can afford to be strict
                    softLimitWarnings: true,
                    gracefulDegradation: false,
                    resourceThrottling: false,
                    alertOnLimitReached: true,
                },
            },

            autoScaling: {
                enabled: true,
                minWorkers: 2,
                maxWorkers: 12, // More aggressive scaling
                memoryBasedScaling: false, // CPU-based scaling preferred
                aggressiveMemoryScaling: false,
                scaleDownThreshold: { memory: 40, cpu: 20 },
                scaleUpThreshold: { memory: 85, cpu: 70 },
                cooldownPeriod: 30000,
            },
        },
    },
    
    logging: {
        enabled: true,
        types: { debug: true },
        components: { cluster: true },
    },
};

/**
 * Create server with memory-optimized configuration based on available RAM
 */
export function createMemoryOptimizedServer() {
    const totalMemoryGB = require('os').totalmem() / (1024 * 1024 * 1024);
    
    let config;
    if (totalMemoryGB < 4) {
        console.log(`🔧 Low memory environment detected (${totalMemoryGB.toFixed(1)}GB). Using low memory configuration.`);
        config = lowMemoryConfig;
    } else if (totalMemoryGB < 8) {
        console.log(`⚖️ Medium memory environment detected (${totalMemoryGB.toFixed(1)}GB). Using balanced configuration.`);
        config = mediumMemoryConfig;
    } else {
        console.log(`🚀 High memory environment detected (${totalMemoryGB.toFixed(1)}GB). Using high performance configuration.`);
        config = highMemoryConfig;
    }

    const app = createServer(config);

    // Add memory monitoring endpoints
    app.get("/memory/status", async (req, res) => {
        try {
            const recommendations = app.getMemoryRecommendations();
            const optimalWorkers = app.getOptimalWorkerCountForMemory();
            const metrics = await app.getClusterMetrics();
            const health = await app.getClusterHealth();

            res.json({
                memory: {
                    totalSystemMemory: `${totalMemoryGB.toFixed(1)}GB`,
                    configuration: totalMemoryGB < 4 ? "low" : totalMemoryGB < 8 ? "medium" : "high",
                    recommendations: recommendations.recommendations,
                    suggestedWorkerCount: recommendations.suggestedWorkerCount,
                    optimalWorkerCount: optimalWorkers,
                    canEnableLowMemoryMode: recommendations.canEnableLowMemoryMode,
                    currentMetrics: metrics,
                    health: health,
                    workers: app.getAllWorkers().map(w => ({
                        id: w.id,
                        port: w.port,
                        status: w.status,
                        health: w.health.status,
                        uptime: Date.now() - w.startTime,
                        restarts: w.restarts,
                    })),
                },
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            res.status(500).json({
                error: "Failed to get memory status",
                message: (error as Error).message,
            });
        }
    });

    // Memory optimization endpoint
    app.post("/memory/optimize", async (req, res) => {
        try {
            const recommendations = app.getMemoryRecommendations();
            
            if (recommendations.canEnableLowMemoryMode) {
                app.enableLowMemoryMode();
            }

            const currentWorkers = app.getAllWorkers().length;
            const optimalWorkers = recommendations.suggestedWorkerCount;

            if (currentWorkers > optimalWorkers) {
                const scaleDown = currentWorkers - optimalWorkers;
                await app.scaleDown(scaleDown);
            }

            res.json({
                message: "Memory optimization applied",
                actions: {
                    lowMemoryModeEnabled: recommendations.canEnableLowMemoryMode,
                    workersScaledDown: Math.max(0, currentWorkers - optimalWorkers),
                },
                newWorkerCount: app.getAllWorkers().length,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            res.status(500).json({
                error: "Failed to optimize memory",
                message: (error as Error).message,
            });
        }
    });

    // Setup memory event handlers
    app.on("memory_alert", (alert) => {
        console.log(`🚨 Memory Alert [${alert.type.toUpperCase()}]: ${alert.message}`);
        
        if (alert.type === "critical") {
            console.log("🔥 Taking emergency action for critical memory usage");
        }
    });

    app.on("low_memory_mode", (data) => {
        if (data.enabled) {
            console.log("💾 Cluster entered low memory mode - optimizations active");
        } else {
            console.log("🎯 Cluster exited low memory mode - normal operation resumed");
        }
    });

    app.on("memory_throttling", (data) => {
        console.log(`⏳ Memory throttling activated: ${data.action}`);
    });

    return app;
}

// Example usage
if (require.main === module) {
    const app = createMemoryOptimizedServer();
    
    app.get("/", (req, res) => {
        res.json({
            message: "Memory-optimized XyPriss cluster",
            timestamp: new Date().toISOString(),
        });
    });

    app.start();
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
        console.log('\n🛑 Shutting down memory-optimized cluster gracefully...');
        try {
            await app.stopCluster(true);
            console.log('✅ Cluster stopped successfully');
            process.exit(0);
        } catch (error) {
            console.error('❌ Error stopping cluster:', error);
            process.exit(1);
        }
    });
}

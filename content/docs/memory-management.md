# Memory Management for XyPriss Clustering

XyPriss provides comprehensive memory management capabilities to help you control resource usage while maintaining performance, safety, and security in clustered environments.

## Overview

The memory management system provides:
- **Automatic Memory Monitoring**: Real-time tracking of system and worker memory usage
- **Intelligent Scaling**: Memory-based auto-scaling to prevent resource exhaustion
- **Memory Leak Detection**: Automatic detection and handling of memory leaks
- **Low Memory Mode**: Optimizations for resource-constrained environments
- **Configurable Limits**: Fine-grained control over memory usage

## Configuration Options

### Basic Memory Management

```typescript
import { createServer } from "xypriss";

const app = createServer({
    cluster: {
        enabled: true,
        config: {
            workers: "auto", // Will be optimized based on available memory
            resources: {
                maxMemoryPerWorker: "512MB", // Limit each worker to 512MB
                
                memoryManagement: {
                    enabled: true,
                    maxTotalMemory: "4GB", // Total cluster memory limit
                    memoryCheckInterval: 30000, // Check every 30 seconds
                    memoryWarningThreshold: 80, // Warning at 80% usage
                    memoryCriticalThreshold: 95, // Critical at 95% usage
                    autoScaleOnMemory: true, // Auto scale down on high memory
                    memoryLeakDetection: true, // Enable leak detection
                    lowMemoryMode: false, // Start in normal mode
                    memoryReservation: "1GB", // Reserve 1GB for system
                },
            },
        },
    },
});
```

### Advanced Memory Configuration

```typescript
const app = createServer({
    cluster: {
        enabled: true,
        config: {
            workers: 4,
            resources: {
                maxMemoryPerWorker: "256MB", // Conservative per-worker limit
                
                memoryManagement: {
                    enabled: true,
                    maxTotalMemory: "2GB", // Total limit for low-memory systems
                    memoryCheckInterval: 15000, // More frequent checks
                    memoryWarningThreshold: 70, // Earlier warnings
                    memoryCriticalThreshold: 85, // Earlier critical threshold
                    autoScaleOnMemory: true,
                    memoryLeakDetection: true,
                    garbageCollectionHint: true, // Send GC hints to workers
                    lowMemoryMode: true, // Start in low memory mode
                    memoryReservation: "512MB", // Less system reservation
                    swapUsageLimit: 5, // Limit swap usage to 5%
                },

                performanceOptimization: {
                    enabled: true,
                    lowMemoryMode: true, // Enable low memory optimizations
                    reducedLogging: true, // Reduce memory used by logs
                    compactMetrics: true, // Use compact metrics storage
                    lazyWorkerInit: true, // Initialize workers on-demand
                    workerPooling: true, // Reuse worker processes
                    memoryPooling: true, // Use memory pooling
                    disableDebugFeatures: true, // Disable debug features
                    minimalFootprint: true, // Minimize memory footprint
                    efficientDataStructures: true, // Use efficient data structures
                },

                enforcement: {
                    enabled: true,
                    enforceHardLimits: false, // Don't kill workers immediately
                    softLimitWarnings: true, // Log warnings for soft limits
                    gracefulDegradation: true, // Degrade gracefully
                    resourceThrottling: true, // Throttle instead of killing
                    alertOnLimitReached: true, // Send alerts
                },
            },

            autoScaling: {
                enabled: true,
                minWorkers: 1,
                maxWorkers: 6,
                memoryBasedScaling: true, // Prioritize memory-based scaling
                aggressiveMemoryScaling: true, // More aggressive scaling
                scaleDownThreshold: {
                    memory: 30, // Scale down if memory < 30%
                },
                scaleUpThreshold: {
                    memory: 80, // Scale up if memory > 80%
                },
            },
        },
    },
});
```

## Memory Management API

### Monitoring Memory Usage

```typescript
// Get memory recommendations
const recommendations = app.getMemoryRecommendations();
console.log("Memory recommendations:", recommendations.recommendations);
console.log("Suggested worker count:", recommendations.suggestedWorkerCount);

// Get optimal worker count for current memory
const optimalWorkers = app.getOptimalWorkerCountForMemory();
console.log("Optimal worker count:", optimalWorkers);

// Check cluster health including memory
const health = await app.getClusterHealth();
console.log("Cluster healthy:", health.healthy);
console.log("Memory details:", health.details);
```

### Manual Memory Management

```typescript
// Enable low memory mode manually
app.enableLowMemoryMode();

// Disable low memory mode
app.disableLowMemoryMode();

// Scale based on memory pressure
if (memoryUsage > 90) {
    await app.scaleDown(1);
}

// Get current cluster metrics including memory
const metrics = await app.getClusterMetrics();
console.log("Memory usage:", metrics.memoryUsage);
```

### Event Handling

```typescript
// Listen for memory events
app.on("memory_alert", (alert) => {
    console.log(`Memory Alert: ${alert.message}`);
    console.log(`Action: ${alert.action}`);
    
    if (alert.type === "critical") {
        // Handle critical memory situation
        console.log("Taking emergency action for critical memory usage");
    }
});

app.on("low_memory_mode", (data) => {
    if (data.enabled) {
        console.log("Cluster entered low memory mode");
        // Adjust application behavior for low memory
    } else {
        console.log("Cluster exited low memory mode");
        // Resume normal operation
    }
});

app.on("memory_throttling", (data) => {
    console.log("Memory throttling activated:", data.action);
    // Reduce application concurrency or processing
});
```

## Memory Optimization Strategies

### For Low Memory Environments (< 4GB RAM)

```typescript
const lowMemoryConfig = {
    cluster: {
        enabled: true,
        config: {
            workers: 2, // Fewer workers
            resources: {
                maxMemoryPerWorker: "256MB",
                memoryManagement: {
                    enabled: true,
                    maxTotalMemory: "1.5GB",
                    memoryWarningThreshold: 60,
                    memoryCriticalThreshold: 75,
                    lowMemoryMode: true,
                    memoryReservation: "512MB",
                },
                performanceOptimization: {
                    enabled: true,
                    lowMemoryMode: true,
                    reducedLogging: true,
                    compactMetrics: true,
                    minimalFootprint: true,
                    disableDebugFeatures: true,
                },
            },
        },
    },
};
```

### For High Memory Environments (> 16GB RAM)

```typescript
const highMemoryConfig = {
    cluster: {
        enabled: true,
        config: {
            workers: "auto", // Let system optimize
            resources: {
                maxMemoryPerWorker: "2GB",
                memoryManagement: {
                    enabled: true,
                    maxTotalMemory: "12GB",
                    memoryWarningThreshold: 85,
                    memoryCriticalThreshold: 95,
                    lowMemoryMode: false,
                    memoryReservation: "2GB",
                    garbageCollectionHint: true,
                },
                performanceOptimization: {
                    enabled: true,
                    lowMemoryMode: false,
                    workerPooling: true,
                    memoryPooling: true,
                },
            },
        },
    },
};
```

## Memory Monitoring Dashboard

### Create a Memory Status Endpoint

```typescript
app.get("/cluster/memory", async (req, res) => {
    const recommendations = app.getMemoryRecommendations();
    const optimalWorkers = app.getOptimalWorkerCountForMemory();
    const metrics = await app.getClusterMetrics();
    const health = await app.getClusterHealth();

    res.json({
        memory: {
            recommendations: recommendations.recommendations,
            suggestedWorkerCount: recommendations.suggestedWorkerCount,
            optimalWorkerCount: optimalWorkers,
            canEnableLowMemoryMode: recommendations.canEnableLowMemoryMode,
            currentUsage: metrics.memoryUsage,
            healthy: health.healthy,
            workers: app.getAllWorkers().map(w => ({
                id: w.id,
                status: w.status,
                health: w.health.status,
                // Memory stats would be added here
            })),
        },
        timestamp: new Date().toISOString(),
    });
});
```

## Best Practices

### 1. Start Conservative
```typescript
// Begin with conservative settings and adjust based on monitoring
const conservativeConfig = {
    maxMemoryPerWorker: "256MB", // Start small
    memoryWarningThreshold: 70, // Early warnings
    memoryCriticalThreshold: 85, // Early critical alerts
};
```

### 2. Monitor and Adjust
```typescript
// Regularly check memory recommendations
setInterval(async () => {
    const recommendations = app.getMemoryRecommendations();
    if (recommendations.recommendations.length > 0) {
        console.log("Memory recommendations:", recommendations.recommendations);
    }
}, 300000); // Every 5 minutes
```

### 3. Handle Memory Events
```typescript
// Always handle memory events gracefully
app.on("memory_alert", async (alert) => {
    switch (alert.type) {
        case "warning":
            // Log and monitor
            logger.warn("Memory usage high", alert);
            break;
        case "critical":
            // Take immediate action
            await app.scaleDown(1);
            break;
        case "leak_detected":
            // Restart affected worker
            logger.error("Memory leak detected", alert);
            break;
    }
});
```

### 4. Environment-Specific Configuration
```typescript
// Adjust configuration based on environment
const memoryConfig = process.env.NODE_ENV === 'production' 
    ? productionMemoryConfig 
    : developmentMemoryConfig;
```

## Troubleshooting

### High Memory Usage
1. Check `maxMemoryPerWorker` setting
2. Enable `memoryLeakDetection`
3. Reduce `workers` count
4. Enable `lowMemoryMode`
5. Increase `memoryCheckInterval` frequency

### Frequent Worker Restarts
1. Increase `memoryWarningThreshold`
2. Set `enforceHardLimits: false`
3. Enable `gracefulDegradation`
4. Check for memory leaks in application code

### Poor Performance
1. Disable `lowMemoryMode` if memory is available
2. Increase `maxMemoryPerWorker`
3. Reduce `memoryCheckInterval`
4. Enable `workerPooling` and `memoryPooling`

The memory management system provides comprehensive control over resource usage while maintaining the performance, safety, and security of your clustered XyPriss applications.

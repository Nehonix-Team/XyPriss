# Bun Clustering Support

XyPriss now includes native Bun clustering support that works seamlessly with Bun's runtime, providing high-performance multi-process scaling for your applications.

## Overview

When running on Bun, XyPriss automatically detects the runtime and uses a Bun-compatible cluster manager instead of Node.js's native cluster module. This provides:

- **Native Bun Process Spawning**: Uses Bun's `spawn()` API for optimal performance
- **Automatic Runtime Detection**: Seamlessly switches between Node.js and Bun clustering
- **Full API Compatibility**: Same clustering API works on both runtimes
- **Dynamic Scaling**: Scale workers up/down at runtime
- **Health Monitoring**: Automatic worker health checks and restart capabilities

## Features

### Automatic Runtime Detection
```typescript
// XyPriss automatically detects Bun and uses appropriate cluster manager
const app = createServer({
    cluster: {
        enabled: true,
        config: {
            workers: "auto", // Automatically determines optimal worker count
        },
    },
});
```

### Bun-Specific Optimizations
- **Process Spawning**: Uses Bun's native `spawn()` for faster worker creation
- **Memory Efficiency**: Optimized for Bun's memory management
- **Performance Monitoring**: Bun-specific metrics collection
- **Graceful Shutdown**: Proper cleanup of Bun subprocesses

## Configuration

### Basic Configuration
```typescript
import { createServer } from "xypriss";

const app = createServer({
    cluster: {
        enabled: true,
        config: {
            workers: 4,           // Number of workers (or "auto")
            autoRestart: true,    // Auto-restart failed workers
        },
    },
});
```

### Advanced Configuration
```typescript
const app = createServer({
    cluster: {
        enabled: true,
        config: {
            workers: "auto",      // Auto-detect optimal worker count
            autoRestart: true,    // Enable auto-restart
            maxRestarts: 5,       // Max restarts per worker
            healthCheckInterval: 30000, // Health check interval (ms)
        },
    },
});
```

## API Usage

### Cluster Management
```typescript
// Scale up workers
await app.scaleUp(2);

// Scale down workers  
await app.scaleDown(1);

// Get cluster metrics
const metrics = await app.getClusterMetrics();
console.log(`Active workers: ${metrics.activeWorkers}`);

// Check cluster health
const health = await app.getClusterHealth();
console.log(`Cluster healthy: ${health.healthy}`);

// Get all workers
const workers = app.getAllWorkers();
workers.forEach(worker => {
    console.log(`Worker ${worker.id} on port ${worker.port}: ${worker.status}`);
});
```

### Worker Information
```typescript
// In worker processes
if (process.env.WORKER_ID) {
    console.log(`Running as worker: ${process.env.WORKER_ID}`);
    console.log(`Worker port: ${process.env.WORKER_PORT}`);
}

// In master process
if (!process.env.WORKER_ID) {
    console.log("Running as cluster master");
}
```

## Runtime Differences

### Bun vs Node.js Clustering

| Feature | Bun Clustering | Node.js Clustering |
|---------|----------------|-------------------|
| Process Creation | `spawn()` API | `cluster.fork()` |
| IPC | Simplified | Full IPC support |
| Memory Sharing | Process isolation | Shared memory options |
| Performance | Optimized for Bun | Native Node.js |
| Startup Time | Faster | Standard |

### Bun-Specific Features
- **Faster Worker Spawning**: Bun's spawn API is optimized for quick process creation
- **Better Resource Management**: Automatic cleanup of subprocess resources
- **Simplified IPC**: Streamlined inter-process communication
- **Native Performance**: Leverages Bun's performance optimizations

## Monitoring and Metrics

### Cluster Status Endpoint
```typescript
app.get("/cluster/status", async (req, res) => {
    const metrics = await app.getClusterMetrics();
    const health = await app.getClusterHealth();
    const workers = app.getAllWorkers();

    res.json({
        cluster: {
            runtime: "Bun",
            metrics,
            health,
            workers: workers.map(w => ({
                id: w.id,
                port: w.port,
                status: w.status,
                health: w.health.status,
                uptime: Date.now() - w.startTime,
                restarts: w.restarts,
            })),
        },
    });
});
```

### Health Monitoring
```typescript
// Automatic health checks every 30 seconds
// Workers are marked unhealthy if:
// - Process has exited
// - No response to health checks
// - Consecutive failures exceed threshold

// Manual health check
const health = await app.getClusterHealth();
if (!health.healthy) {
    console.log("Cluster needs attention:", health.details);
}
```

## Best Practices

### Worker Count Optimization
```typescript
// For CPU-intensive tasks
const cpuWorkers = Math.max(1, navigator.hardwareConcurrency - 1);

// For I/O-intensive tasks  
const ioWorkers = navigator.hardwareConcurrency * 2;

// Auto-detection (recommended)
const app = createServer({
    cluster: {
        enabled: true,
        config: {
            workers: "auto", // Automatically optimizes based on system
        },
    },
});
```

### Error Handling
```typescript
// Handle cluster startup errors
try {
    await app.start();
} catch (error) {
    if (error.message.includes("cluster")) {
        console.log("Cluster failed to start, falling back to single process");
        // Fallback logic
    }
}

// Handle worker failures
app.on("worker:exit", (data) => {
    console.log(`Worker ${data.workerId} exited with code ${data.exitCode}`);
    // Custom restart logic if needed
});
```

### Graceful Shutdown
```typescript
process.on('SIGINT', async () => {
    console.log('Shutting down Bun cluster gracefully...');
    try {
        await app.stopCluster(true); // Graceful shutdown
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});
```

## Troubleshooting

### Common Issues

**Workers Not Starting**
- Check if ports are available (8086, 8087, etc.)
- Verify Bun is properly installed
- Check for permission issues

**High Memory Usage**
- Monitor worker count vs system resources
- Consider reducing worker count for memory-constrained environments
- Use `workers: "auto"` for automatic optimization

**Performance Issues**
- Profile worker distribution
- Check for bottlenecks in shared resources
- Monitor cluster metrics regularly

### Debug Mode
```typescript
const app = createServer({
    cluster: {
        enabled: true,
        config: {
            workers: 2,
        },
    },
    logging: {
        enabled: true,
        types: {
            debug: true, // Enable debug logging
        },
        components: {
            cluster: true, // Enable cluster-specific logs
        },
    },
});
```

## Migration from Node.js

Existing Node.js cluster configurations work seamlessly with Bun:

```typescript
// This configuration works on both Node.js and Bun
const app = createServer({
    cluster: {
        enabled: true,
        config: {
            workers: "auto",
            autoRestart: true,
        },
    },
});

// Runtime is automatically detected
// No code changes required!
```

The Bun cluster manager provides the same API as the Node.js version, ensuring seamless migration and compatibility across runtimes.

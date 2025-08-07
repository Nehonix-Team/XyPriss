# Cluster Service Troubleshooting Guide

## Common Issues and Solutions

### Worker Startup Issues

#### Workers Fail to Start

**Symptoms:**
- Workers timeout during startup
- "Worker failed to start within timeout" errors
- Workers immediately exit after spawning

**Causes and Solutions:**

1. **Insufficient Memory**
   ```
   Error: Insufficient memory for N workers. Required: XMB, Available: YMB
   ```
   - **Solution**: Reduce `maxMemoryPerWorker` or increase system memory
   - **Configuration**: Set conservative memory limits
   ```typescript
   resources: {
     maxMemoryPerWorker: '128MB', // Reduce from default
     memoryManagement: {
       memoryReservation: '256MB' // Reduce reservation
     }
   }
   ```

2. **Port Conflicts**
   ```
   Error: Port XXXX already in use
   ```
   - **Solution**: Configure port ranges or use dynamic port allocation
   - **Configuration**: Set base port and port range
   ```typescript
   // In cluster manager initialization
   const basePort = 8000; // Choose available port range
   ```

3. **Module Loading Issues**
   ```
   Error: Cannot find module 'xyz'
   ```
   - **Solution**: Ensure all dependencies are installed and accessible
   - **Check**: Verify NODE_PATH and module resolution

#### Workers Start but Immediately Crash

**Symptoms:**
- Workers start successfully but exit within seconds
- High restart counts in metrics
- Continuous restart loops

**Diagnostic Steps:**

1. **Check Worker Logs**
   ```typescript
   monitoring: {
     logWorkerEvents: true,
     logLevel: 'debug'
   }
   ```

2. **Examine Exit Codes**
   - Exit code 1: General error
   - Exit code 130: SIGINT (Ctrl+C)
   - Exit code 137: SIGKILL (out of memory)
   - Exit code 143: SIGTERM (graceful shutdown)

3. **Memory Analysis**
   ```typescript
   resources: {
     memoryManagement: {
       memoryLeakDetection: true,
       memoryCheckInterval: 10000 // Check every 10 seconds
     }
   }
   ```

### Memory Issues

#### Memory Leaks

**Symptoms:**
- Gradual memory increase over time
- Workers being killed for memory limit exceeded
- System becoming unresponsive

**Detection:**
```typescript
resources: {
  memoryManagement: {
    enabled: true,
    memoryLeakDetection: true,
    memoryWarningThreshold: 75,
    memoryCriticalThreshold: 90
  }
}
```

**Solutions:**

1. **Enable Garbage Collection Hints**
   ```typescript
   resources: {
     memoryManagement: {
       garbageCollectionHint: true
     }
   }
   ```

2. **Implement Periodic Worker Restart**
   ```typescript
   processManagement: {
     maxRestarts: 5,
     restartDelay: 5000,
     memoryThreshold: '256MB' // Restart when exceeded
   }
   ```

3. **Profile Memory Usage**
   - Use Node.js built-in profiler
   - Monitor heap snapshots
   - Analyze memory patterns

#### Out of Memory Errors

**Symptoms:**
- Workers killed with exit code 137
- "JavaScript heap out of memory" errors
- System swap usage high

**Solutions:**

1. **Increase Memory Limits**
   ```typescript
   resources: {
     maxMemoryPerWorker: '512MB', // Increase limit
     memoryManagement: {
       maxTotalMemory: '2GB' // Increase total limit
     }
   }
   ```

2. **Enable Low Memory Mode**
   ```typescript
   resources: {
     performanceOptimization: {
       lowMemoryMode: true
     }
   }
   ```

3. **Optimize Worker Count**
   ```typescript
   workers: 2, // Reduce worker count
   autoScaling: {
     enabled: false // Disable auto-scaling
   }
   ```

### IPC Communication Issues

#### Message Timeouts

**Symptoms:**
- "IPC message timeout" errors
- Slow response times
- Workers appear unresponsive

**Solutions:**

1. **Increase Timeout Values**
   ```typescript
   ipc: {
     timeout: 60000, // Increase to 60 seconds
     heartbeatInterval: 30000 // Increase heartbeat interval
   }
   ```

2. **Check Message Size**
   ```typescript
   ipc: {
     maxMessageSize: '2MB', // Increase if needed
     compression: true // Enable compression for large messages
   }
   ```

3. **Monitor IPC Health**
   ```typescript
   // Enable IPC logging
   logging: {
     components: {
       ipc: true
     }
   }
   ```

#### Connection Failures

**Symptoms:**
- "Worker connection failed" errors
- IPC statistics show failed connections
- Workers not receiving messages

**Diagnostic Steps:**

1. **Check Worker Registration**
   - Verify workers are properly registered with IPC manager
   - Check worker IDs are unique
   - Ensure subprocess handles are valid

2. **Verify Message Handlers**
   ```typescript
   // In worker code
   ipcManager.registerHandler('ping', async (message) => {
     return { status: 'alive', workerId: process.env.WORKER_ID };
   });
   ```

3. **Test Basic Communication**
   ```typescript
   // Test basic ping-pong
   await ipcManager.sendToWorker(workerId, 'ping', {});
   ```

### Performance Issues

#### High CPU Usage

**Symptoms:**
- CPU usage consistently above 80%
- Slow response times
- System becomes unresponsive

**Analysis:**

1. **Check Worker Distribution**
   ```typescript
   // Monitor worker CPU usage
   const metrics = await clusterManager.getMetrics();
   console.log('Worker CPU usage:', metrics.workers.map(w => w.cpu));
   ```

2. **Analyze Load Balancing**
   ```typescript
   loadBalancing: {
     strategy: 'least-connections', // Try different strategy
     healthyOnly: true
   }
   ```

**Solutions:**

1. **Optimize Worker Count**
   ```typescript
   workers: 'auto', // Let system determine optimal count
   autoScaling: {
     enabled: true,
     scaleUpThreshold: {
       cpu: 60 // Lower threshold for earlier scaling
     }
   }
   ```

2. **Enable CPU Optimization**
   ```typescript
   resources: {
     performanceOptimization: {
       cpuOptimization: true,
       ioOptimization: true
     }
   }
   ```

#### Slow Response Times

**Symptoms:**
- High response times in metrics
- Timeouts on client requests
- Queue buildup

**Solutions:**

1. **Adjust Auto-Scaling**
   ```typescript
   autoScaling: {
     enabled: true,
     scaleUpThreshold: {
       responseTime: 1000, // Scale up if response time > 1s
       queueLength: 50 // Scale up if queue > 50 requests
     }
   }
   ```

2. **Optimize Health Checks**
   ```typescript
   healthCheck: {
     interval: 15000, // More frequent checks
     timeout: 5000, // Faster timeout
     maxFailures: 2 // Faster failure detection
   }
   ```

### Health Check Issues

#### Health Checks Failing

**Symptoms:**
- Workers marked as unhealthy
- Health check timeouts
- Frequent worker restarts

**Solutions:**

1. **Adjust Health Check Configuration**
   ```typescript
   healthCheck: {
     enabled: true,
     interval: 30000,
     timeout: 15000, // Increase timeout
     maxFailures: 5, // Allow more failures
     gracePeriod: 120000 // Longer grace period for new workers
   }
   ```

2. **Implement Custom Health Checks**
   ```typescript
   // In worker application
   app.get('/health', (req, res) => {
     // Custom health logic
     const isHealthy = checkDatabaseConnection() && checkExternalServices();
     res.status(isHealthy ? 200 : 503).json({ status: isHealthy ? 'healthy' : 'unhealthy' });
   });
   ```

3. **Monitor Health Check Logs**
   ```typescript
   monitoring: {
     logWorkerEvents: true,
     logLevel: 'debug'
   }
   ```

### Auto-Scaling Issues

#### Excessive Scaling

**Symptoms:**
- Frequent scaling up and down
- Resource waste
- Unstable performance

**Solutions:**

1. **Increase Cooldown Periods**
   ```typescript
   autoScaling: {
     cooldownPeriod: 600000, // 10 minutes
     evaluationInterval: 120000 // 2 minutes
   }
   ```

2. **Adjust Thresholds**
   ```typescript
   autoScaling: {
     scaleUpThreshold: {
       cpu: 80, // Higher threshold
       consecutiveChecks: 5 // More checks required
     },
     scaleDownThreshold: {
       cpu: 20, // Lower threshold
       idleTime: 600, // Longer idle time
       consecutiveChecks: 10 // More checks required
     }
   }
   ```

#### Scaling Not Working

**Symptoms:**
- No scaling despite high load
- Manual scaling works but auto-scaling doesn't
- Scaling events not logged

**Diagnostic Steps:**

1. **Check Auto-Scaling Configuration**
   ```typescript
   autoScaling: {
     enabled: true, // Ensure it's enabled
     minWorkers: 1,
     maxWorkers: 8 // Ensure max is higher than current
   }
   ```

2. **Monitor Scaling Metrics**
   ```typescript
   const metrics = await clusterManager.getMetrics();
   console.log('Last scaling action:', metrics.lastScalingAction);
   ```

3. **Enable Scaling Logs**
   ```typescript
   monitoring: {
     logWorkerEvents: true,
     logLevel: 'info'
   }
   ```

## Diagnostic Tools

### Cluster Health Dashboard

```typescript
// Get comprehensive cluster status
const health = await clusterManager.getHealth();
const metrics = await clusterManager.getMetrics();
const workers = clusterManager.getWorkers();

console.log('Cluster Health:', health);
console.log('Cluster Metrics:', metrics);
console.log('Worker Status:', workers.map(w => ({
  id: w.id,
  status: w.status,
  memory: w.memoryUsage,
  cpu: w.cpuUsage
})));
```

### Memory Analysis

```typescript
// Analyze memory usage patterns
const memoryStats = await memoryManager.getSystemMemoryStats();
const recommendations = await memoryManager.getMemoryOptimizationRecommendations();

console.log('System Memory:', memoryStats);
console.log('Optimization Recommendations:', recommendations);
```

### IPC Diagnostics

```typescript
// Check IPC health
const ipcStats = ipcManager.getWorkerStats();
const ipcHealth = ipcManager.getStats();

console.log('IPC Worker Stats:', ipcStats);
console.log('IPC Health:', ipcHealth);
```

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Worker Health**
   - Worker count (active/total)
   - Worker restart frequency
   - Worker memory usage
   - Worker CPU usage

2. **System Resources**
   - Total memory usage
   - CPU utilization
   - Swap usage
   - File descriptor usage

3. **Performance Metrics**
   - Response times
   - Request throughput
   - Error rates
   - Queue depths

4. **IPC Metrics**
   - Message success rate
   - Message latency
   - Connection count
   - Message queue depth

### Alert Thresholds

```typescript
const alertThresholds = {
  memoryUsage: 85, // Alert if memory > 85%
  cpuUsage: 80, // Alert if CPU > 80%
  errorRate: 5, // Alert if error rate > 5%
  responseTime: 2000, // Alert if response time > 2s
  workerRestarts: 10, // Alert if restarts > 10/hour
  ipcFailureRate: 10 // Alert if IPC failure rate > 10%
};
```

## Best Practices for Troubleshooting

1. **Enable Comprehensive Logging**
   - Use structured logging with correlation IDs
   - Log all worker events and state changes
   - Include performance metrics in logs

2. **Monitor Continuously**
   - Set up automated monitoring and alerting
   - Use dashboards for real-time visibility
   - Track trends over time

3. **Test Configuration Changes**
   - Test in development environment first
   - Use gradual rollouts for production changes
   - Have rollback plans ready

4. **Document Issues and Solutions**
   - Keep a troubleshooting log
   - Document configuration changes
   - Share knowledge with team members

5. **Regular Health Checks**
   - Perform regular cluster health assessments
   - Review metrics and logs periodically
   - Proactively address potential issues

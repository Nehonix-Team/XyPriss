# Cluster Service Documentation

## Overview

The XyPriss Cluster Service provides enterprise-grade process clustering capabilities for Node.js and Bun applications. It enables horizontal scaling through worker process management, load balancing, health monitoring, and inter-process communication.

## Architecture

### Core Components

- **Cluster Manager**: Central orchestrator for worker lifecycle management
- **Process Monitor**: Real-time system and process resource monitoring
- **Memory Manager**: Advanced memory management with leak detection
- **IPC Manager**: Inter-process communication system
- **Load Balancer**: Request distribution across workers
- **Health Monitor**: Worker health checking and recovery

### Supported Runtimes

- **Node.js**: Full cluster module support with enhanced features
- **Bun**: Native subprocess-based clustering with IPC

## Configuration

### Basic Configuration

```typescript
import { createServer } from 'xypriss';

const app = createServer({
  cluster: {
    enabled: true,
    config: {
      workers: 'auto', // or specific number
      resources: {
        maxMemoryPerWorker: '256MB',
        maxCpuPerWorker: 50
      }
    }
  }
});
```

### Advanced Configuration

```typescript
const clusterConfig = {
  enabled: true,
  workers: 4,
  
  resources: {
    maxMemoryPerWorker: '512MB',
    maxCpuPerWorker: 75,
    memoryManagement: {
      enabled: true,
      memoryWarningThreshold: 80,
      memoryCriticalThreshold: 95,
      memoryLeakDetection: true,
      garbageCollectionHint: true
    }
  },
  
  processManagement: {
    respawn: true,
    maxRestarts: 3,
    restartDelay: 2000,
    gracefulShutdownTimeout: 30000,
    zombieDetection: true
  },
  
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 10000,
    maxFailures: 3,
    endpoint: '/health'
  },
  
  autoScaling: {
    enabled: true,
    minWorkers: 2,
    maxWorkers: 8,
    scaleUpThreshold: {
      cpu: 75,
      memory: 80,
      responseTime: 1500
    }
  }
};
```

## Resource Management

### Memory Management

The cluster service includes sophisticated memory management:

- **Memory Monitoring**: Real-time memory usage tracking per worker
- **Leak Detection**: Automatic detection of memory leaks with configurable thresholds
- **Garbage Collection**: Intelligent GC hints based on memory pressure
- **Memory Limits**: Hard and soft memory limits with enforcement policies

### CPU Management

- **CPU Monitoring**: Per-worker CPU usage tracking
- **CPU Limits**: Configurable CPU usage limits per worker
- **Load Distribution**: Intelligent request routing based on worker load

## Process Management

### Worker Lifecycle

1. **Initialization**: Worker spawning with environment setup
2. **Health Checking**: Continuous health monitoring
3. **Load Balancing**: Request distribution
4. **Scaling**: Dynamic worker scaling based on load
5. **Graceful Shutdown**: Proper cleanup and resource deallocation

### Restart Policies

- **Automatic Restart**: Failed workers are automatically restarted
- **Restart Limits**: Configurable maximum restart attempts
- **Backoff Strategy**: Exponential backoff for restart delays
- **Circuit Breaker**: Prevents cascading failures

## Inter-Process Communication

### Message Types

- **Broadcast**: Send messages to all workers
- **Unicast**: Send messages to specific workers
- **Request-Response**: Synchronous communication with correlation

### Usage Examples

```typescript
// Broadcast to all workers
await app.broadcastToWorkers({
  type: 'config-update',
  data: newConfiguration
});

// Send to random worker
await app.sendToRandomWorker({
  type: 'process-task',
  data: taskData
});
```

## Health Monitoring

### Health Checks

- **HTTP Health Endpoints**: Configurable health check endpoints
- **Process Health**: Memory, CPU, and resource monitoring
- **Custom Health Checks**: Application-specific health validation
- **Health Aggregation**: Cluster-wide health status

### Metrics Collection

- **System Metrics**: CPU, memory, disk, network usage
- **Application Metrics**: Request rates, response times, error rates
- **Worker Metrics**: Per-worker performance statistics
- **Cluster Metrics**: Overall cluster health and performance

## Auto-Scaling

### Scaling Triggers

- **CPU Utilization**: Scale based on CPU usage thresholds
- **Memory Pressure**: Scale based on memory consumption
- **Response Time**: Scale based on application response times
- **Queue Length**: Scale based on request queue depth

### Scaling Policies

- **Scale-Up**: Add workers when thresholds are exceeded
- **Scale-Down**: Remove workers during low utilization
- **Cooldown Periods**: Prevent rapid scaling oscillations
- **Min/Max Limits**: Enforce scaling boundaries

## Security

### Process Isolation

- **Worker Isolation**: Each worker runs in isolated environment
- **Resource Limits**: Enforce memory and CPU limits per worker
- **Module Restrictions**: Control which modules workers can access
- **Sandbox Mode**: Optional sandboxing for enhanced security

### IPC Security

- **Message Encryption**: Optional encryption for IPC messages
- **Message Validation**: Input validation for all IPC messages
- **Access Control**: Control which workers can communicate
- **Audit Logging**: Log all IPC communications for security analysis

## Monitoring and Observability

### Logging

- **Structured Logging**: JSON-formatted logs with correlation IDs
- **Log Levels**: Configurable logging levels per component
- **Log Aggregation**: Centralized logging from all workers
- **Performance Logging**: Detailed performance metrics

### Metrics Export

- **Prometheus**: Native Prometheus metrics export
- **Custom Exporters**: Support for custom metrics exporters
- **Real-time Metrics**: Live metrics streaming
- **Historical Data**: Metrics retention and historical analysis

## Error Handling

### Error Recovery

- **Graceful Degradation**: Continue operation with reduced capacity
- **Circuit Breaker**: Prevent cascading failures
- **Retry Logic**: Automatic retry with exponential backoff
- **Fallback Strategies**: Alternative processing paths

### Error Reporting

- **Error Aggregation**: Collect and aggregate errors across workers
- **Error Classification**: Categorize errors by type and severity
- **Alert Integration**: Integration with alerting systems
- **Error Analytics**: Analyze error patterns and trends

## Performance Optimization

### Load Balancing Strategies

- **Round Robin**: Distribute requests evenly across workers
- **Least Connections**: Route to worker with fewest active connections
- **Weighted Round Robin**: Distribute based on worker capacity
- **Health-Aware**: Route only to healthy workers

### Caching

- **Shared Cache**: Optional shared cache across workers
- **Cache Invalidation**: Coordinated cache invalidation
- **Cache Warming**: Proactive cache population
- **Cache Metrics**: Cache hit rates and performance

## Deployment Considerations

### Production Deployment

- **Resource Planning**: Calculate required resources based on load
- **Monitoring Setup**: Configure comprehensive monitoring
- **Alerting**: Set up alerts for critical conditions
- **Backup Strategies**: Plan for disaster recovery

### Development Environment

- **Single Worker Mode**: Simplified development setup
- **Debug Mode**: Enhanced debugging capabilities
- **Hot Reload**: Development-time code reloading
- **Testing Support**: Integration with testing frameworks

## Troubleshooting

### Common Issues

- **Memory Leaks**: Detection and resolution strategies
- **High CPU Usage**: Identification and optimization
- **Worker Crashes**: Analysis and prevention
- **Communication Failures**: IPC troubleshooting

### Diagnostic Tools

- **Health Dashboard**: Real-time cluster status
- **Performance Profiler**: Detailed performance analysis
- **Memory Analyzer**: Memory usage analysis
- **Log Analyzer**: Log analysis and correlation

## API Reference

### Cluster Manager API

```typescript
interface ClusterManager {
  start(): Promise<void>;
  stop(graceful?: boolean): Promise<void>;
  restart(): Promise<void>;
  scale(workerCount: number): Promise<void>;
  getMetrics(): Promise<ClusterMetrics>;
  getWorkers(): WorkerInfo[];
  getHealth(): Promise<HealthStatus>;
}
```

### Configuration Schema

```typescript
interface ClusterConfig {
  enabled?: boolean;
  workers?: number | 'auto';
  resources?: ResourceConfig;
  processManagement?: ProcessManagementConfig;
  healthCheck?: HealthCheckConfig;
  autoScaling?: AutoScalingConfig;
  monitoring?: MonitoringConfig;
  security?: SecurityConfig;
}
```

## Best Practices

### Configuration

- Start with conservative resource limits
- Enable health checks in production
- Use auto-scaling cautiously with proper testing
- Configure appropriate restart policies
- Enable comprehensive monitoring

### Monitoring

- Monitor key metrics: CPU, memory, response times
- Set up alerts for critical thresholds
- Use structured logging for better analysis
- Implement custom health checks for application logic
- Regular review of cluster performance

### Security

- Enable worker isolation in production
- Use resource limits to prevent resource exhaustion
- Implement proper error handling
- Regular security audits of cluster configuration
- Monitor for suspicious activity

### Performance

- Optimize worker count based on workload characteristics
- Use appropriate load balancing strategies
- Monitor and optimize memory usage
- Implement efficient IPC patterns
- Regular performance testing and optimization

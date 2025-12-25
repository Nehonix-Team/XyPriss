# XyPriss Cluster Service Documentation

## Overview

The XyPriss Cluster Service provides enterprise-grade process clustering capabilities for Node.js and Bun applications. This documentation covers all aspects of the cluster service, from basic configuration to advanced troubleshooting.

## Documentation Structure

### Core Documentation

- **[Cluster Service](./cluster-service.md)** - Complete overview of the cluster service architecture, features, and capabilities
- **[API Reference](./cluster-api-reference.md)** - Comprehensive API documentation for all cluster interfaces and classes
- **[Configuration Guide](./cluster-configuration-guide.md)** - Detailed configuration examples and best practices
- **[Troubleshooting Guide](./cluster-troubleshooting.md)** - Common issues, diagnostic tools, and solutions

## Quick Start

### Basic Setup

```typescript
import { createServer } from 'xypriss';

const app = createServer({
  cluster: {
    enabled: true,
    config: {
      workers: 'auto',
      resources: {
        maxMemoryPerWorker: '256MB',
        maxCpuPerWorker: 50
      }
    }
  }
});

await app.start(8080);
```

### Production Configuration

```typescript
const app = createServer({
  cluster: {
    enabled: true,
    config: {
      workers: 'auto',
      resources: {
        maxMemoryPerWorker: '512MB',
        maxCpuPerWorker: 75,
        memoryManagement: {
          enabled: true,
          memoryLeakDetection: true,
          garbageCollectionHint: true
        }
      },
      processManagement: {
        respawn: true,
        maxRestarts: 3,
        gracefulShutdownTimeout: 30000
      },
      healthCheck: {
        enabled: true,
        interval: 30000,
        timeout: 10000
      },
      autoScaling: {
        enabled: true,
        minWorkers: 2,
        maxWorkers: 8
      },
      security: {
        isolateWorkers: true,
        resourceLimits: true,
        preventForkBombs: true
      }
    }
  }
});
```

## Key Features

### Process Management
- Automatic worker spawning and lifecycle management
- Graceful shutdown and restart capabilities
- Zombie process detection and cleanup
- Resource limit enforcement

### Resource Management
- Memory usage monitoring and leak detection
- CPU usage tracking and optimization
- Automatic garbage collection hints
- Resource limit enforcement

### Health Monitoring
- Continuous health checks with configurable endpoints
- Worker health status tracking
- Automatic failover and recovery
- Comprehensive metrics collection

### Auto-Scaling
- Dynamic worker scaling based on load metrics
- Configurable scaling thresholds and policies
- Cooldown periods to prevent oscillation
- Resource-aware scaling decisions

### Inter-Process Communication
- Bidirectional master-worker communication
- Message correlation and response handling
- Heartbeat mechanism for health monitoring
- Event-driven architecture

### Security
- Worker process isolation
- Resource limit enforcement
- Module access control
- Optional IPC encryption

## Default Configuration

The cluster service comes with conservative default settings optimized for stability:

```typescript
{
  enabled: false, // Disabled by default
  config: {
    workers: 'auto',
    resources: {
      maxMemoryPerWorker: '256MB',
      maxCpuPerWorker: 50
    },
    processManagement: {
      respawn: true,
      maxRestarts: 3,
      restartDelay: 2000,
      gracefulShutdownTimeout: 30000
    },
    healthCheck: {
      enabled: true,
      interval: 30000,
      timeout: 10000,
      maxFailures: 3
    },
    autoScaling: {
      enabled: false, // Disabled by default
      minWorkers: 1,
      maxWorkers: 4
    },
    security: {
      isolateWorkers: true,
      resourceLimits: true,
      preventForkBombs: true,
      encryptIPC: false
    }
  }
}
```

## Environment-Specific Configurations

### Development
- Single or minimal workers
- Enhanced logging and debugging
- Relaxed resource limits
- Disabled auto-scaling

### Production
- Auto-detected worker count
- Strict resource limits
- Comprehensive monitoring
- Auto-scaling enabled
- Enhanced security

### Testing
- Single worker
- Minimal resource usage
- Disabled health checks
- No auto-scaling

## Monitoring and Observability

### Key Metrics
- Worker count and health status
- Memory and CPU usage per worker
- Request throughput and response times
- Error rates and restart frequency
- IPC message statistics

### Health Endpoints
- `/health/cluster` - Overall cluster health
- `/metrics/cluster` - Detailed cluster metrics
- `/workers` - Individual worker status

### Logging
- Structured logging with correlation IDs
- Configurable log levels per component
- Worker event logging
- Performance metrics logging

## Best Practices

### Configuration
1. Start with conservative resource limits
2. Enable comprehensive monitoring
3. Test configuration changes in development
4. Use environment-specific configurations
5. Document configuration decisions

### Monitoring
1. Monitor key metrics continuously
2. Set up appropriate alerting thresholds
3. Use structured logging for analysis
4. Implement custom health checks
5. Regular performance reviews

### Security
1. Enable worker isolation in production
2. Use resource limits to prevent exhaustion
3. Implement proper error handling
4. Regular security audits
5. Monitor for suspicious activity

### Performance
1. Optimize worker count based on workload
2. Use appropriate load balancing strategies
3. Monitor and optimize memory usage
4. Implement efficient IPC patterns
5. Regular performance testing

## Support and Troubleshooting

### Common Issues
- Worker startup failures
- Memory leaks and out-of-memory errors
- IPC communication timeouts
- Performance degradation
- Auto-scaling issues

### Diagnostic Tools
- Cluster health dashboard
- Memory usage analysis
- IPC diagnostics
- Performance profiling
- Log analysis

### Getting Help
1. Check the troubleshooting guide
2. Review configuration examples
3. Enable debug logging
4. Analyze metrics and logs
5. Consult API documentation

## Version Compatibility

The cluster service is compatible with:
- Node.js 16.x and later
- Bun 1.0 and later
- TypeScript 4.5 and later

## License

This cluster service is part of the XyPriss framework and follows the same licensing terms.

## Contributing

Contributions to the cluster service documentation and implementation are welcome. Please follow the project's contribution guidelines.

---

For detailed information on any aspect of the cluster service, please refer to the specific documentation files listed above.

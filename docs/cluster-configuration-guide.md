# Cluster Configuration Guide

## Configuration Overview

The XyPriss Cluster Service provides extensive configuration options for fine-tuning cluster behavior. This guide covers all configuration aspects with practical examples.

## Basic Configuration

### Minimal Setup

```typescript
import { createServer } from 'xypriss';

const app = createServer({
  cluster: {
    enabled: true
  }
});
```

This uses all default settings with automatic worker count detection.

### Simple Configuration

```typescript
const app = createServer({
  cluster: {
    enabled: true,
    config: {
      workers: 4,
      resources: {
        maxMemoryPerWorker: '512MB',
        maxCpuPerWorker: 75
      }
    }
  }
});
```

## Resource Configuration

### Memory Management

```typescript
const memoryConfig = {
  resources: {
    maxMemoryPerWorker: '256MB',
    memoryManagement: {
      enabled: true,
      maxTotalMemory: '2GB',
      memoryCheckInterval: 30000,
      memoryWarningThreshold: 75,
      memoryCriticalThreshold: 90,
      memoryLeakDetection: true,
      garbageCollectionHint: true,
      memoryReservation: '512MB'
    },
    enforcement: {
      enforceHardLimits: true,
      killOnMemoryExceed: true,
      killOnCpuExceed: false
    }
  }
};
```

### CPU Management

```typescript
const cpuConfig = {
  resources: {
    maxCpuPerWorker: 50, // 50% CPU per worker
    performanceOptimization: {
      cpuOptimization: true,
      ioOptimization: true,
      lowMemoryMode: false
    }
  }
};
```

## Process Management

### Basic Process Management

```typescript
const processConfig = {
  processManagement: {
    respawn: true,
    maxRestarts: 3,
    restartDelay: 2000,
    gracefulShutdownTimeout: 30000,
    killTimeout: 10000,
    zombieDetection: true
  }
};
```

### Advanced Process Management

```typescript
const advancedProcessConfig = {
  processManagement: {
    respawn: true,
    maxRestarts: 5,
    restartDelay: 1000,
    gracefulShutdownTimeout: 45000,
    killTimeout: 15000,
    zombieDetection: true,
    memoryThreshold: '512MB',
    cpuThreshold: 85
  }
};
```

## Health Monitoring

### Basic Health Checks

```typescript
const healthConfig = {
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 10000,
    maxFailures: 3,
    endpoint: '/health'
  }
};
```

### Advanced Health Monitoring

```typescript
const advancedHealthConfig = {
  healthCheck: {
    enabled: true,
    interval: 15000,
    timeout: 5000,
    maxFailures: 2,
    endpoint: '/api/health',
    retryDelay: 5000,
    gracePeriod: 60000
  }
};
```

## Auto-Scaling Configuration

### Conservative Auto-Scaling

```typescript
const conservativeScaling = {
  autoScaling: {
    enabled: true,
    minWorkers: 2,
    maxWorkers: 6,
    cooldownPeriod: 300000, // 5 minutes
    scaleStep: 1,
    evaluationInterval: 60000,
    scaleUpThreshold: {
      cpu: 80,
      memory: 85,
      responseTime: 2000,
      consecutiveChecks: 3
    },
    scaleDownThreshold: {
      cpu: 30,
      memory: 40,
      idleTime: 600, // 10 minutes
      consecutiveChecks: 5
    }
  }
};
```

### Aggressive Auto-Scaling

```typescript
const aggressiveScaling = {
  autoScaling: {
    enabled: true,
    minWorkers: 1,
    maxWorkers: 12,
    cooldownPeriod: 120000, // 2 minutes
    scaleStep: 2,
    evaluationInterval: 30000,
    scaleUpThreshold: {
      cpu: 60,
      memory: 70,
      responseTime: 1000,
      queueLength: 20,
      consecutiveChecks: 2
    },
    scaleDownThreshold: {
      cpu: 20,
      memory: 30,
      idleTime: 180, // 3 minutes
      consecutiveChecks: 3
    }
  }
};
```

## Load Balancing

### Round Robin (Default)

```typescript
const roundRobinConfig = {
  loadBalancing: {
    strategy: 'round-robin',
    stickySession: false,
    healthyOnly: true,
    retryFailedRequests: true,
    maxRetries: 2
  }
};
```

### Least Connections

```typescript
const leastConnectionsConfig = {
  loadBalancing: {
    strategy: 'least-connections',
    stickySession: false,
    healthyOnly: true,
    retryFailedRequests: true,
    maxRetries: 3
  }
};
```

## IPC Configuration

### Basic IPC

```typescript
const ipcConfig = {
  ipc: {
    enabled: true,
    broadcast: true,
    timeout: 30000,
    heartbeatInterval: 15000
  }
};
```

### Advanced IPC

```typescript
const advancedIpcConfig = {
  ipc: {
    enabled: true,
    broadcast: true,
    timeout: 45000,
    heartbeatInterval: 10000,
    maxMessageSize: '2MB',
    compression: true,
    encryption: false
  }
};
```

## Security Configuration

### Basic Security

```typescript
const securityConfig = {
  security: {
    enabled: true,
    isolateWorkers: true,
    resourceLimits: true,
    preventForkBombs: true
  }
};
```

### Enhanced Security

```typescript
const enhancedSecurityConfig = {
  security: {
    enabled: true,
    isolateWorkers: true,
    resourceLimits: true,
    preventForkBombs: true,
    encryptIPC: true,
    sandboxMode: true,
    allowedModules: ['fs', 'path', 'crypto'],
    blockedModules: ['child_process', 'cluster', 'vm']
  }
};
```

## Monitoring Configuration

### Basic Monitoring

```typescript
const monitoringConfig = {
  monitoring: {
    enabled: true,
    collectMetrics: true,
    metricsInterval: 60000,
    logLevel: 'info'
  }
};
```

### Comprehensive Monitoring

```typescript
const comprehensiveMonitoringConfig = {
  monitoring: {
    enabled: true,
    collectMetrics: true,
    metricsInterval: 30000,
    logLevel: 'debug',
    logWorkerEvents: true,
    logPerformance: true,
    retentionPeriod: 86400000, // 24 hours
    aggregateMetrics: true,
    exportMetrics: true
  }
};
```

## Error Handling

### Basic Error Handling

```typescript
const errorHandlingConfig = {
  errorHandling: {
    uncaughtException: 'restart',
    unhandledRejection: 'log',
    errorThreshold: 5,
    errorWindow: 300000
  }
};
```

### Advanced Error Handling

```typescript
const advancedErrorHandlingConfig = {
  errorHandling: {
    uncaughtException: 'restart',
    unhandledRejection: 'restart',
    errorThreshold: 3,
    errorWindow: 180000,
    backoffStrategy: 'exponential',
    maxBackoffDelay: 60000
  }
};
```

## Environment-Specific Configurations

### Development Configuration

```typescript
const developmentConfig = {
  enabled: true,
  workers: 2,
  resources: {
    maxMemoryPerWorker: '256MB',
    maxCpuPerWorker: 50
  },
  processManagement: {
    respawn: true,
    maxRestarts: 10,
    restartDelay: 1000
  },
  healthCheck: {
    enabled: true,
    interval: 10000,
    timeout: 5000
  },
  autoScaling: {
    enabled: false
  },
  monitoring: {
    enabled: true,
    logLevel: 'debug',
    logWorkerEvents: true
  },
  security: {
    enabled: false,
    isolateWorkers: false
  }
};
```

### Production Configuration

```typescript
const productionConfig = {
  enabled: true,
  workers: 'auto',
  resources: {
    maxMemoryPerWorker: '512MB',
    maxCpuPerWorker: 75,
    memoryManagement: {
      enabled: true,
      memoryLeakDetection: true,
      garbageCollectionHint: true
    },
    enforcement: {
      enforceHardLimits: true,
      killOnMemoryExceed: true
    }
  },
  processManagement: {
    respawn: true,
    maxRestarts: 3,
    restartDelay: 5000,
    gracefulShutdownTimeout: 30000
  },
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 10000,
    maxFailures: 2
  },
  autoScaling: {
    enabled: true,
    minWorkers: 2,
    maxWorkers: 8,
    cooldownPeriod: 300000
  },
  monitoring: {
    enabled: true,
    collectMetrics: true,
    logLevel: 'warn',
    exportMetrics: true
  },
  security: {
    enabled: true,
    isolateWorkers: true,
    resourceLimits: true,
    encryptIPC: true,
    sandboxMode: true
  }
};
```

### Testing Configuration

```typescript
const testingConfig = {
  enabled: true,
  workers: 1,
  resources: {
    maxMemoryPerWorker: '128MB',
    maxCpuPerWorker: 25
  },
  processManagement: {
    respawn: false,
    maxRestarts: 0
  },
  healthCheck: {
    enabled: false
  },
  autoScaling: {
    enabled: false
  },
  monitoring: {
    enabled: false
  },
  security: {
    enabled: false
  }
};
```

## Complete Configuration Example

```typescript
const completeConfig = {
  enabled: true,
  workers: 'auto',
  
  resources: {
    maxMemoryPerWorker: '512MB',
    maxCpuPerWorker: 75,
    priorityLevel: 'normal',
    memoryManagement: {
      enabled: true,
      maxTotalMemory: '4GB',
      memoryCheckInterval: 30000,
      memoryWarningThreshold: 80,
      memoryCriticalThreshold: 95,
      memoryLeakDetection: true,
      garbageCollectionHint: true,
      memoryReservation: '1GB'
    },
    enforcement: {
      enforceHardLimits: true,
      killOnMemoryExceed: true,
      killOnCpuExceed: false
    },
    performanceOptimization: {
      lowMemoryMode: false,
      cpuOptimization: true,
      ioOptimization: true
    }
  },
  
  processManagement: {
    respawn: true,
    maxRestarts: 3,
    restartDelay: 2000,
    gracefulShutdownTimeout: 30000,
    killTimeout: 10000,
    zombieDetection: true,
    memoryThreshold: '512MB',
    cpuThreshold: 85
  },
  
  healthCheck: {
    enabled: true,
    interval: 30000,
    timeout: 10000,
    maxFailures: 3,
    endpoint: '/health',
    retryDelay: 5000,
    gracePeriod: 60000
  },
  
  loadBalancing: {
    strategy: 'round-robin',
    stickySession: false,
    healthyOnly: true,
    retryFailedRequests: true,
    maxRetries: 2
  },
  
  ipc: {
    enabled: true,
    broadcast: true,
    timeout: 30000,
    heartbeatInterval: 15000,
    maxMessageSize: '1MB',
    compression: false
  },
  
  autoScaling: {
    enabled: true,
    minWorkers: 2,
    maxWorkers: 8,
    cooldownPeriod: 300000,
    scaleStep: 1,
    evaluationInterval: 60000,
    scaleUpThreshold: {
      cpu: 75,
      memory: 80,
      responseTime: 1500,
      queueLength: 100,
      consecutiveChecks: 3
    },
    scaleDownThreshold: {
      cpu: 25,
      memory: 30,
      idleTime: 300,
      consecutiveChecks: 5
    }
  },
  
  monitoring: {
    enabled: true,
    collectMetrics: true,
    metricsInterval: 60000,
    logLevel: 'info',
    logWorkerEvents: true,
    logPerformance: false,
    retentionPeriod: 86400000,
    aggregateMetrics: true,
    exportMetrics: false
  },
  
  errorHandling: {
    uncaughtException: 'restart',
    unhandledRejection: 'log',
    errorThreshold: 5,
    errorWindow: 300000,
    backoffStrategy: 'exponential',
    maxBackoffDelay: 30000
  },
  
  security: {
    enabled: true,
    isolateWorkers: true,
    resourceLimits: true,
    preventForkBombs: true,
    encryptIPC: false,
    sandboxMode: false,
    allowedModules: [],
    blockedModules: ['child_process', 'cluster']
  }
};
```

## Configuration Validation

The cluster service automatically validates configuration on startup. Invalid configurations will throw detailed error messages indicating the specific issues.

## Best Practices

1. **Start Conservative**: Begin with conservative settings and adjust based on monitoring data
2. **Monitor First**: Enable comprehensive monitoring before enabling auto-scaling
3. **Test Thoroughly**: Test configuration changes in development before production deployment
4. **Resource Planning**: Calculate resource requirements based on expected load
5. **Security Considerations**: Enable security features appropriate for your environment
6. **Documentation**: Document configuration changes and their rationale

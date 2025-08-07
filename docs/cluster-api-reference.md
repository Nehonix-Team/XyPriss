# Cluster Service API Reference

## Core Interfaces

### ClusterConfig

Primary configuration interface for cluster settings.

```typescript
interface ClusterConfig {
  enabled?: boolean;
  workers?: number | 'auto';
  resources?: ResourceConfig;
  processManagement?: ProcessManagementConfig;
  healthCheck?: HealthCheckConfig;
  loadBalancing?: LoadBalancingConfig;
  ipc?: IPCConfig;
  autoScaling?: AutoScalingConfig;
  monitoring?: MonitoringConfig;
  errorHandling?: ErrorHandlingConfig;
  security?: SecurityConfig;
}
```

### ResourceConfig

Resource allocation and management configuration.

```typescript
interface ResourceConfig {
  maxMemoryPerWorker?: string;
  maxCpuPerWorker?: number;
  priorityLevel?: 'low' | 'normal' | 'high';
  memoryManagement?: {
    enabled?: boolean;
    maxTotalMemory?: string;
    memoryCheckInterval?: number;
    memoryWarningThreshold?: number;
    memoryCriticalThreshold?: number;
    memoryLeakDetection?: boolean;
    garbageCollectionHint?: boolean;
    memoryReservation?: string;
  };
  enforcement?: {
    enforceHardLimits?: boolean;
    killOnMemoryExceed?: boolean;
    killOnCpuExceed?: boolean;
  };
  performanceOptimization?: {
    lowMemoryMode?: boolean;
    cpuOptimization?: boolean;
    ioOptimization?: boolean;
  };
}
```

### ProcessManagementConfig

Worker process lifecycle management configuration.

```typescript
interface ProcessManagementConfig {
  respawn?: boolean;
  maxRestarts?: number;
  restartDelay?: number;
  gracefulShutdownTimeout?: number;
  killTimeout?: number;
  zombieDetection?: boolean;
  memoryThreshold?: string;
  cpuThreshold?: number;
}
```

### HealthCheckConfig

Health monitoring configuration.

```typescript
interface HealthCheckConfig {
  enabled?: boolean;
  interval?: number;
  timeout?: number;
  maxFailures?: number;
  endpoint?: string;
  retryDelay?: number;
  gracePeriod?: number;
}
```

### AutoScalingConfig

Automatic scaling configuration.

```typescript
interface AutoScalingConfig {
  enabled?: boolean;
  minWorkers?: number;
  maxWorkers?: number;
  cooldownPeriod?: number;
  scaleStep?: number;
  evaluationInterval?: number;
  scaleUpThreshold?: {
    cpu?: number;
    memory?: number;
    responseTime?: number;
    queueLength?: number;
    consecutiveChecks?: number;
  };
  scaleDownThreshold?: {
    cpu?: number;
    memory?: number;
    idleTime?: number;
    consecutiveChecks?: number;
  };
}
```

## Cluster Manager

### BunClusterManager

Main cluster manager for Bun runtime environments.

```typescript
class BunClusterManager extends EventEmitter {
  constructor(config: ClusterConfig, basePort: number);
  
  // Lifecycle management
  start(): Promise<void>;
  stop(graceful?: boolean): Promise<void>;
  restart(): Promise<void>;
  
  // Worker management
  spawnWorker(workerId?: string): Promise<BunWorker>;
  stopWorker(workerId: string, graceful?: boolean): Promise<void>;
  restartWorker(workerId: string): Promise<void>;
  
  // Scaling operations
  scale(targetWorkerCount: number): Promise<void>;
  scaleUp(count?: number): Promise<void>;
  scaleDown(count?: number): Promise<void>;
  
  // Information and metrics
  getWorkers(): BunWorker[];
  getWorkerById(workerId: string): BunWorker | undefined;
  getMetrics(): Promise<BunClusterMetrics>;
  getHealth(): Promise<ClusterHealth>;
  
  // Configuration
  updateConfig(config: Partial<ClusterConfig>): Promise<void>;
  getConfig(): ClusterConfig;
  
  // IPC integration
  setIPCManager(ipcManager: BunIPCManager): void;
}
```

### Events

The cluster manager emits various events for monitoring and integration:

```typescript
interface ClusterEvents {
  'worker:started': (data: { workerId: string; port: number; timestamp: number }) => void;
  'worker:stopped': (data: { workerId: string; timestamp: number }) => void;
  'worker:error': (data: { workerId: string; error: Error; timestamp: number }) => void;
  'worker:restart': (data: { workerId: string; reason: string; timestamp: number }) => void;
  'cluster:started': (data: { workerCount: number; timestamp: number }) => void;
  'cluster:stopped': (data: { timestamp: number }) => void;
  'cluster:scaled': (data: { oldCount: number; newCount: number; timestamp: number }) => void;
  'health:changed': (data: { status: string; details: any; timestamp: number }) => void;
  'metrics:updated': (data: { metrics: ClusterMetrics; timestamp: number }) => void;
}
```

## IPC Manager

### BunIPCManager

Inter-process communication manager for Bun workers.

```typescript
class BunIPCManager extends EventEmitter {
  constructor();
  
  // Worker registration
  registerWorker(workerId: string, subprocess: any): void;
  unregisterWorker(workerId: string): void;
  
  // Message sending (master)
  sendToWorker(workerId: string, type: string, data: any): Promise<any>;
  broadcastToWorkers(type: string, data: any): Promise<IPCResponse[]>;
  sendToRandomWorker(type: string, data: any): Promise<any>;
  
  // Message sending (worker)
  sendToMaster(type: string, data: any): Promise<any>;
  
  // Message handling
  registerHandler(type: string, handler: (message: IPCMessage) => Promise<any>): void;
  unregisterHandler(type: string): void;
  
  // Statistics and monitoring
  getWorkerStats(): { total: number; alive: number; dead: number };
  
  // Cleanup
  destroy(): void;
}
```

### IPC Message Types

```typescript
interface IPCMessage {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  from: 'master' | 'worker';
  to?: string;
  correlationId?: string;
}

interface IPCResponse {
  id: string;
  correlationId: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}
```

## Memory Manager

### MemoryManager

Advanced memory management and monitoring.

```typescript
class MemoryManager extends EventEmitter {
  constructor(config: MemoryConfig);
  
  // Memory monitoring
  getSystemMemoryStats(): Promise<MemoryStats>;
  getWorkerMemoryStats(workerId: string, pid: number): Promise<WorkerMemoryStats>;
  
  // Memory management
  checkMemoryLimits(workerId: string, currentMemory: number): MemoryLimitResult;
  detectMemoryLeak(workerId: string, currentMemory: number): boolean;
  suggestGarbageCollection(workerId: string): boolean;
  
  // Optimization
  calculateOptimalWorkerCount(systemStats?: MemoryStats): Promise<number>;
  getMemoryOptimizationRecommendations(): Promise<MemoryOptimizationResult>;
  
  // Monitoring lifecycle
  startMonitoring(interval?: number): void;
  stopMonitoring(): void;
  
  // Cleanup
  destroy(): void;
}
```

### Memory Statistics

```typescript
interface MemoryStats {
  totalMemory: number;
  freeMemory: number;
  usedMemory: number;
  availableMemory: number;
  usagePercentage: number;
  swapTotal: number;
  swapFree: number;
  swapPercentage: number;
}

interface WorkerMemoryStats {
  workerId: string;
  pid: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
  cpuUsage: number;
  uptime: number;
  timestamp: number;
}
```

## Process Monitor

### ProcessMonitor

System and process monitoring capabilities.

```typescript
class ProcessMonitor extends EventEmitter {
  constructor();
  
  // System monitoring
  getSystemStats(): Promise<SystemStats>;
  
  // Process monitoring
  getProcessStats(pid: number): Promise<ProcessStats>;
  
  // Monitoring lifecycle
  startMonitoring(interval?: number): void;
  stopMonitoring(): void;
  
  // Cleanup
  destroy(): void;
}
```

### System and Process Statistics

```typescript
interface SystemStats {
  cpu: {
    cores: number;
    usage: number;
    loadAverage: number[];
  };
  memory: {
    total: number;
    free: number;
    used: number;
    available: number;
    usagePercentage: number;
  };
  swap: {
    total: number;
    free: number;
    used: number;
    usagePercentage: number;
  };
  uptime: number;
  timestamp: number;
}

interface ProcessStats {
  pid: number;
  memory: {
    rss: number;
    vms: number;
    heapTotal?: number;
    heapUsed?: number;
    external?: number;
  };
  cpu: {
    usage: number;
    totalTime: number;
  };
  threads: number;
  fileDescriptors: number;
  uptime: number;
  timestamp: number;
}
```

## Cluster Factory

### ClusterFactory

Factory for creating and configuring cluster managers.

```typescript
class ClusterFactory {
  static getInstance(): ClusterFactory;
  
  // Creation methods
  create(config: ClusterConfig): RobustClusterManager;
  createWithDefaults(): RobustClusterManager;
  createForEnvironment(env: 'development' | 'production' | 'test'): RobustClusterManager;
  
  // Configuration utilities
  validateConfig(config: ClusterConfig): { valid: boolean; errors: string[] };
  getRecommendedConfig(serverType: 'api' | 'web' | 'microservice' | 'worker'): ClusterConfig;
  mergeConfigs(base: ClusterConfig, override: Partial<ClusterConfig>): ClusterConfig;
  
  // Intelligent defaults
  getIntelligentDefaults(): ClusterConfig;
  getEnvironmentConfig(env: 'development' | 'production' | 'test'): ClusterConfig;
}
```

## Builder Pattern

### ClusterBuilder

Fluent API for building cluster configurations.

```typescript
interface ClusterBuilder {
  withWorkers(count: number | 'auto'): ClusterBuilder;
  withHealthCheck(config: Partial<HealthCheckConfig>): ClusterBuilder;
  withAutoScaling(config: Partial<AutoScalingConfig>): ClusterBuilder;
  withLoadBalancing(strategy: string, options?: any): ClusterBuilder;
  withMonitoring(config: Partial<MonitoringConfig>): ClusterBuilder;
  withSecurity(config: Partial<SecurityConfig>): ClusterBuilder;
  withResilience(config: Partial<ResilienceConfig>): ClusterBuilder;
  enableDevelopmentMode(): ClusterBuilder;
  enableProductionMode(): ClusterBuilder;
  build(): ClusterConfig;
  create(): RobustClusterManager;
}
```

### Usage Example

```typescript
import { buildCluster } from 'xypriss/cluster';

const cluster = buildCluster()
  .withWorkers('auto')
  .withHealthCheck({ interval: 30000, timeout: 10000 })
  .withAutoScaling({
    enabled: true,
    minWorkers: 2,
    maxWorkers: 8
  })
  .withSecurity({ isolateWorkers: true })
  .enableProductionMode()
  .create();
```

## Error Types

### ClusterError

Base error class for cluster-related errors.

```typescript
class ClusterError extends Error {
  constructor(message: string, code?: string, details?: any);
  
  readonly code?: string;
  readonly details?: any;
  readonly timestamp: number;
}
```

### Specific Error Types

```typescript
class WorkerStartupError extends ClusterError {}
class WorkerCommunicationError extends ClusterError {}
class ResourceExhaustionError extends ClusterError {}
class ConfigurationError extends ClusterError {}
class HealthCheckError extends ClusterError {}
```

## Constants and Enums

### Worker States

```typescript
enum WorkerState {
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}
```

### Cluster States

```typescript
enum ClusterState {
  INITIALIZING = 'initializing',
  STARTING = 'starting',
  RUNNING = 'running',
  SCALING = 'scaling',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}
```

### Default Values

```typescript
const DEFAULT_VALUES = {
  WORKER_TIMEOUT: 60000,
  HEALTH_CHECK_INTERVAL: 30000,
  HEALTH_CHECK_TIMEOUT: 10000,
  RESTART_DELAY: 2000,
  MAX_RESTARTS: 3,
  GRACEFUL_SHUTDOWN_TIMEOUT: 30000,
  IPC_TIMEOUT: 30000,
  MEMORY_CHECK_INTERVAL: 30000,
  METRICS_INTERVAL: 60000
} as const;
```

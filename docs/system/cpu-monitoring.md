# CPU Monitoring

**Version Compatibility:** XyPriss v6.0.0 and above

## Overview

The CPU Monitoring API provides real-time access to processor information and usage statistics. This API enables applications to monitor system load, track resource consumption, and make intelligent decisions based on CPU availability.

## API Reference

### `$cpu(cores?: boolean): CpuUsage | CpuInfo[]`

Retrieves CPU statistics. Returns either global usage summary or detailed per-core information.

**Parameters:**

-   `cores` - (Optional) If `true`, returns detailed per-core information. Default: `false`

**Returns:**

-   `CpuUsage` - Global CPU usage statistics (when `cores` is `false`)
-   `CpuInfo[]` - Array of per-core information (when `cores` is `true`)

## Return Types

### CpuUsage

Global CPU usage statistics.

```typescript
interface CpuUsage {
    overall: number; // Overall CPU usage percentage (0-100)
    per_core: number[]; // Usage percentage for each core
    timestamp: number; // Unix timestamp of measurement
}
```

### CpuInfo

Detailed information for a single CPU core.

```typescript
interface CpuInfo {
    name: string; // Core identifier
    vendor_id: string; // CPU vendor (e.g., "GenuineIntel", "AuthenticAMD")
    brand: string; // CPU brand name
    frequency: number; // Current frequency in MHz
    usage: number; // Current usage percentage (0-100)
    core_count: number; // Number of logical cores
}
```

## Usage Examples

### Basic CPU Usage

```typescript
// Get overall CPU usage
const cpu = __sys__.$cpu() as CpuUsage;

console.log(`CPU Usage: ${cpu.overall.toFixed(2)}%`);
console.log(`Cores: ${cpu.per_core.length}`);
console.log(`Timestamp: ${new Date(cpu.timestamp * 1000).toISOString()}`);
```

**Example Output:**

```
CPU Usage: 23.45%
Cores: 8
Timestamp: 2026-01-12T13:54:45.000Z
```

### Per-Core Information

```typescript
// Get detailed core information
const cores = __sys__.$cpu(true) as CpuInfo[];

cores.forEach((core, index) => {
    console.log(`Core ${index}:`);
    console.log(`  Brand: ${core.brand}`);
    console.log(`  Frequency: ${core.frequency} MHz`);
    console.log(`  Usage: ${core.usage.toFixed(2)}%`);
});
```

**Example Output:**

```
Core 0:
  Brand: Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz
  Frequency: 2600 MHz
  Usage: 15.23%
Core 1:
  Brand: Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz
  Frequency: 2600 MHz
  Usage: 28.45%
...
```

### CPU Load Monitoring

```typescript
function monitorCpuLoad(thresholdPercent: number = 80): void {
    const cpu = __sys__.$cpu() as CpuUsage;

    if (cpu.overall > thresholdPercent) {
        console.warn(`High CPU usage detected: ${cpu.overall.toFixed(2)}%`);

        // Find cores with highest usage
        const highCores = cpu.per_core
            .map((usage, index) => ({ index, usage }))
            .filter((core) => core.usage > thresholdPercent)
            .sort((a, b) => b.usage - a.usage);

        console.warn(`Cores above threshold: ${highCores.length}`);
        highCores.forEach((core) => {
            console.warn(`  Core ${core.index}: ${core.usage.toFixed(2)}%`);
        });
    }
}

// Monitor every 5 seconds
setInterval(() => monitorCpuLoad(80), 5000);
```

### System Information Display

```typescript
function displaySystemInfo(): void {
    const cores = __sys__.$cpu(true) as CpuInfo[];
    const systemInfo = __sys__.$info();

    console.log("=== System Information ===");
    console.log(`CPU: ${systemInfo.cpu_brand}`);
    console.log(`Vendor: ${cores[0]?.vendor_id || "Unknown"}`);
    console.log(`Architecture: ${systemInfo.architecture}`);
    console.log(`Physical Cores: ${systemInfo.cpu_count}`);
    console.log(`Logical Cores: ${cores.length}`);
    console.log(`Base Frequency: ${systemInfo.cpu_frequency} MHz`);

    const cpu = __sys__.$cpu() as CpuUsage;
    console.log(`Current Usage: ${cpu.overall.toFixed(2)}%`);
}

displaySystemInfo();
```

## Common Patterns

### Load-Based Throttling

```typescript
async function performCpuIntensiveTask(): Promise<void> {
    const cpu = __sys__.$cpu() as CpuUsage;

    if (cpu.overall > 90) {
        console.log("CPU usage too high, delaying task...");
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return performCpuIntensiveTask(); // Retry
    }

    // Proceed with task
    console.log("CPU available, starting task...");
    // ... task implementation
}
```

### Dynamic Worker Allocation

```typescript
function calculateOptimalWorkers(): number {
    const cpu = __sys__.$cpu() as CpuUsage;
    const cores = cpu.per_core.length;

    // Use 75% of cores if CPU usage is low
    if (cpu.overall < 50) {
        return Math.floor(cores * 0.75);
    }

    // Use 50% of cores if CPU usage is moderate
    if (cpu.overall < 75) {
        return Math.floor(cores * 0.5);
    }

    // Use 25% of cores if CPU usage is high
    return Math.floor(cores * 0.25);
}

const workerCount = calculateOptimalWorkers();
console.log(`Starting ${workerCount} workers`);
```

### Performance Metrics Collection

```typescript
interface CpuMetrics {
    timestamp: Date;
    overall: number;
    perCore: number[];
    averageFrequency: number;
}

class CpuMetricsCollector {
    private metrics: CpuMetrics[] = [];
    private maxSamples: number = 100;

    collect(): void {
        const usage = __sys__.$cpu() as CpuUsage;
        const cores = __sys__.$cpu(true) as CpuInfo[];

        const avgFreq =
            cores.reduce((sum, core) => sum + core.frequency, 0) / cores.length;

        this.metrics.push({
            timestamp: new Date(usage.timestamp * 1000),
            overall: usage.overall,
            perCore: usage.per_core,
            averageFrequency: avgFreq,
        });

        // Keep only recent samples
        if (this.metrics.length > this.maxSamples) {
            this.metrics.shift();
        }
    }

    getAverage(): number {
        if (this.metrics.length === 0) return 0;
        const sum = this.metrics.reduce((acc, m) => acc + m.overall, 0);
        return sum / this.metrics.length;
    }

    getPeak(): number {
        if (this.metrics.length === 0) return 0;
        return Math.max(...this.metrics.map((m) => m.overall));
    }

    getReport(): string {
        return `
CPU Metrics Report (${this.metrics.length} samples):
  Average Usage: ${this.getAverage().toFixed(2)}%
  Peak Usage: ${this.getPeak().toFixed(2)}%
  Current Usage: ${this.metrics[this.metrics.length - 1]?.overall.toFixed(2)}%
        `.trim();
    }
}

const collector = new CpuMetricsCollector();
setInterval(() => collector.collect(), 1000);

// Print report every 30 seconds
setInterval(() => console.log(collector.getReport()), 30000);
```

### Health Check Integration

```typescript
interface HealthStatus {
    status: "healthy" | "degraded" | "unhealthy";
    cpu: {
        usage: number;
        threshold: number;
    };
}

function checkCpuHealth(): HealthStatus {
    const cpu = __sys__.$cpu() as CpuUsage;
    const warningThreshold = 75;
    const criticalThreshold = 90;

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";

    if (cpu.overall >= criticalThreshold) {
        status = "unhealthy";
    } else if (cpu.overall >= warningThreshold) {
        status = "degraded";
    }

    return {
        status,
        cpu: {
            usage: cpu.overall,
            threshold:
                status === "unhealthy" ? criticalThreshold : warningThreshold,
        },
    };
}

// Use in health endpoint
app.get("/health", (req, res) => {
    const health = checkCpuHealth();
    const statusCode =
        health.status === "healthy"
            ? 200
            : health.status === "degraded"
            ? 429
            : 503;

    res.status(statusCode).json(health);
});
```

## Best Practices

### 1. Avoid Excessive Polling

CPU monitoring itself consumes resources. Limit polling frequency:

```typescript
// Bad: Polling every 100ms
setInterval(() => __sys__.$cpu(), 100);

// Good: Polling every 5 seconds
setInterval(() => __sys__.$cpu(), 5000);
```

### 2. Use Appropriate Granularity

Request per-core data only when needed:

```typescript
// For general monitoring, use overall stats
const usage = __sys__.$cpu() as CpuUsage;

// For detailed analysis, use per-core stats
const cores = __sys__.$cpu(true) as CpuInfo[];
```

### 3. Implement Hysteresis

Avoid rapid state changes by implementing hysteresis:

```typescript
class CpuMonitor {
    private highLoadCount = 0;
    private readonly threshold = 80;
    private readonly requiredSamples = 3;

    check(): boolean {
        const cpu = __sys__.$cpu() as CpuUsage;

        if (cpu.overall > this.threshold) {
            this.highLoadCount++;
        } else {
            this.highLoadCount = 0;
        }

        return this.highLoadCount >= this.requiredSamples;
    }
}
```

### 4. Consider Time Windows

Average usage over time windows for stability:

```typescript
class WindowedCpuMonitor {
    private samples: number[] = [];
    private windowSize = 10;

    addSample(): void {
        const cpu = __sys__.$cpu() as CpuUsage;
        this.samples.push(cpu.overall);

        if (this.samples.length > this.windowSize) {
            this.samples.shift();
        }
    }

    getAverage(): number {
        if (this.samples.length === 0) return 0;
        return this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    }
}
```

### 5. Log Anomalies

Track and log unusual CPU patterns:

```typescript
function detectCpuAnomaly(): void {
    const cpu = __sys__.$cpu() as CpuUsage;
    const variance = Math.max(...cpu.per_core) - Math.min(...cpu.per_core);

    // High variance indicates unbalanced load
    if (variance > 50) {
        console.warn(
            `CPU load imbalance detected: ${variance.toFixed(2)}% variance`
        );
        console.warn(`Min: ${Math.min(...cpu.per_core).toFixed(2)}%`);
        console.warn(`Max: ${Math.max(...cpu.per_core).toFixed(2)}%`);
    }
}
```

## Platform Considerations

### Linux

-   Full support for all CPU metrics
-   Accurate per-core frequency reporting
-   Real-time usage statistics

### macOS

-   Full support for all CPU metrics
-   May show averaged frequency values
-   Accurate usage statistics

### Windows

-   Full support for all CPU metrics
-   Frequency reporting may vary by Windows version
-   Accurate usage statistics

## Performance Impact

CPU monitoring operations are lightweight but not free:

-   **Overall Usage Query**: ~1-2ms
-   **Per-Core Query**: ~2-5ms
-   **Memory Overhead**: Negligible (<1KB per query)

## Troubleshooting

### High CPU Usage Not Reflected

If CPU usage appears lower than expected:

```typescript
// Ensure sufficient sampling time
await new Promise((resolve) => setTimeout(resolve, 1000));
const cpu = __sys__.$cpu() as CpuUsage;
```

### Inconsistent Core Count

```typescript
const systemInfo = __sys__.$info();
const cores = __sys__.$cpu(true) as CpuInfo[];

console.log(`System reports: ${systemInfo.cpu_count} cores`);
console.log(`Detected: ${cores.length} cores`);

// May differ due to hyperthreading
```

## Related Documentation

-   [System Information](./system-health.md)
-   [Memory Management](./memory-management.md)
-   [Process Management](./process-management.md)

---

**Version:** XyPriss v6.0.0+  
**Last Updated:** 2026-01-12


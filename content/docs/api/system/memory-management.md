# Memory Management

**Version Compatibility:** XyPriss v6.0.0 and above

## Overview

The Memory Management API provides real-time access to system memory statistics, including RAM and swap usage. This API enables applications to monitor memory consumption, detect memory pressure, and optimize resource allocation.

## API Reference

### `$memory(watch?: boolean): MemoryInfo`

Retrieves comprehensive memory statistics for the system.

**Parameters:**

-   `watch` - (Optional) Internal flag for continuous monitoring streams. Default: `false`

**Returns:** `MemoryInfo` - Complete memory statistics object

## Return Type

### MemoryInfo

```typescript
interface MemoryInfo {
    total: number; // Total physical RAM in bytes
    available: number; // Available RAM in bytes
    used: number; // Used RAM in bytes
    free: number; // Free RAM in bytes
    usage_percent: number; // RAM usage percentage (0-100)
    swap_total: number; // Total swap space in bytes
    swap_used: number; // Used swap space in bytes
    swap_free: number; // Free swap space in bytes
    swap_percent: number; // Swap usage percentage (0-100)
}
```

## Usage Examples

### Basic Memory Information

```typescript
const memory = __sys__.$memory();

console.log(`Total RAM: ${formatBytes(memory.total)}`);
console.log(`Used RAM: ${formatBytes(memory.used)}`);
console.log(`Available RAM: ${formatBytes(memory.available)}`);
console.log(`Usage: ${memory.usage_percent.toFixed(2)}%`);

function formatBytes(bytes: number): string {
    const gb = bytes / 1024 ** 3;
    return `${gb.toFixed(2)} GB`;
}
```

**Example Output:**

```
Total RAM: 16.00 GB
Used RAM: 8.45 GB
Available RAM: 7.55 GB
Usage: 52.81%
```

### Memory Monitoring

```typescript
function monitorMemory(): void {
    const memory = __sys__.$memory();

    console.log("=== Memory Status ===");
    console.log(`RAM: ${memory.usage_percent.toFixed(1)}% used`);
    console.log(`  Total: ${(memory.total / 1024 ** 3).toFixed(2)} GB`);
    console.log(`  Used: ${(memory.used / 1024 ** 3).toFixed(2)} GB`);
    console.log(`  Free: ${(memory.free / 1024 ** 3).toFixed(2)} GB`);
    console.log(`  Available: ${(memory.available / 1024 ** 3).toFixed(2)} GB`);

    if (memory.swap_total > 0) {
        console.log(`Swap: ${memory.swap_percent.toFixed(1)}% used`);
        console.log(
            `  Total: ${(memory.swap_total / 1024 ** 3).toFixed(2)} GB`
        );
        console.log(`  Used: ${(memory.swap_used / 1024 ** 3).toFixed(2)} GB`);
    }
}

// Monitor every 10 seconds
setInterval(monitorMemory, 10000);
```

### Memory Pressure Detection

```typescript
interface MemoryPressure {
    level: "low" | "moderate" | "high" | "critical";
    shouldGarbageCollect: boolean;
    shouldReduceCache: boolean;
    message: string;
}

function detectMemoryPressure(): MemoryPressure {
    const memory = __sys__.$memory();
    const usage = memory.usage_percent;

    if (usage >= 95) {
        return {
            level: "critical",
            shouldGarbageCollect: true,
            shouldReduceCache: true,
            message: "Critical memory pressure - immediate action required",
        };
    }

    if (usage >= 85) {
        return {
            level: "high",
            shouldGarbageCollect: true,
            shouldReduceCache: true,
            message: "High memory pressure - reduce memory usage",
        };
    }

    if (usage >= 70) {
        return {
            level: "moderate",
            shouldGarbageCollect: false,
            shouldReduceCache: true,
            message: "Moderate memory pressure - monitor closely",
        };
    }

    return {
        level: "low",
        shouldGarbageCollect: false,
        shouldReduceCache: false,
        message: "Memory usage normal",
    };
}

// Use in application logic
const pressure = detectMemoryPressure();
if (pressure.shouldGarbageCollect) {
    global.gc?.(); // Trigger garbage collection if available
}
if (pressure.shouldReduceCache) {
    cache.clear(); // Clear application cache
}
```

### Memory-Based Resource Allocation

```typescript
function calculateOptimalCacheSize(): number {
    const memory = __sys__.$memory();
    const availableGB = memory.available / 1024 ** 3;

    // Use 10% of available memory for cache, max 2GB
    const cacheGB = Math.min(availableGB * 0.1, 2);
    return Math.floor(cacheGB * 1024 ** 3); // Convert to bytes
}

const cacheSize = calculateOptimalCacheSize();
console.log(`Cache size: ${(cacheSize / 1024 ** 2).toFixed(0)} MB`);
```

### Health Check Integration

```typescript
interface MemoryHealth {
    status: "healthy" | "warning" | "critical";
    ram: {
        usage_percent: number;
        available_gb: number;
    };
    swap: {
        usage_percent: number;
        is_active: boolean;
    };
}

function checkMemoryHealth(): MemoryHealth {
    const memory = __sys__.$memory();

    let status: "healthy" | "warning" | "critical" = "healthy";

    if (memory.usage_percent >= 90 || memory.swap_percent >= 50) {
        status = "critical";
    } else if (memory.usage_percent >= 75 || memory.swap_percent >= 25) {
        status = "warning";
    }

    return {
        status,
        ram: {
            usage_percent: memory.usage_percent,
            available_gb: memory.available / 1024 ** 3,
        },
        swap: {
            usage_percent: memory.swap_percent,
            is_active: memory.swap_used > 0,
        },
    };
}

app.get("/health/memory", (req, res) => {
    const health = checkMemoryHealth();
    const statusCode =
        health.status === "healthy"
            ? 200
            : health.status === "warning"
            ? 429
            : 503;
    res.status(statusCode).json(health);
});
```

## Common Patterns

### Memory Leak Detection

```typescript
class MemoryLeakDetector {
    private samples: number[] = [];
    private readonly maxSamples = 20;
    private readonly threshold = 5; // 5% increase per sample

    addSample(): void {
        const memory = __sys__.$memory();
        this.samples.push(memory.used);

        if (this.samples.length > this.maxSamples) {
            this.samples.shift();
        }
    }

    detectLeak(): boolean {
        if (this.samples.length < this.maxSamples) {
            return false; // Not enough data
        }

        // Check if memory consistently increases
        let increases = 0;
        for (let i = 1; i < this.samples.length; i++) {
            const percentChange =
                ((this.samples[i] - this.samples[i - 1]) /
                    this.samples[i - 1]) *
                100;
            if (percentChange > this.threshold) {
                increases++;
            }
        }

        // If more than 75% of samples show increase, likely a leak
        return increases / (this.samples.length - 1) > 0.75;
    }

    getReport(): string {
        if (this.samples.length === 0) return "No data";

        const first = this.samples[0];
        const last = this.samples[this.samples.length - 1];
        const increase = ((last - first) / first) * 100;

        return `Memory change: ${increase > 0 ? "+" : ""}${increase.toFixed(
            2
        )}% over ${this.samples.length} samples`;
    }
}

const detector = new MemoryLeakDetector();
setInterval(() => {
    detector.addSample();
    if (detector.detectLeak()) {
        console.error("Potential memory leak detected!");
        console.error(detector.getReport());
    }
}, 60000); // Check every minute
```

### Adaptive Buffer Sizing

```typescript
function getOptimalBufferSize(): number {
    const memory = __sys__.$memory();
    const availableMB = memory.available / 1024 ** 2;

    // Scale buffer size based on available memory
    if (availableMB > 4096) {
        return 64 * 1024; // 64KB for high memory
    } else if (availableMB > 2048) {
        return 32 * 1024; // 32KB for moderate memory
    } else if (availableMB > 1024) {
        return 16 * 1024; // 16KB for low memory
    } else {
        return 8 * 1024; // 8KB for very low memory
    }
}
```

### Memory Metrics Collection

```typescript
interface MemoryMetrics {
    timestamp: Date;
    used: number;
    available: number;
    usage_percent: number;
    swap_used: number;
}

class MemoryMetricsCollector {
    private metrics: MemoryMetrics[] = [];
    private maxSamples = 100;

    collect(): void {
        const memory = __sys__.$memory();

        this.metrics.push({
            timestamp: new Date(),
            used: memory.used,
            available: memory.available,
            usage_percent: memory.usage_percent,
            swap_used: memory.swap_used,
        });

        if (this.metrics.length > this.maxSamples) {
            this.metrics.shift();
        }
    }

    getAverage(): number {
        if (this.metrics.length === 0) return 0;
        const sum = this.metrics.reduce((acc, m) => acc + m.usage_percent, 0);
        return sum / this.metrics.length;
    }

    getPeak(): MemoryMetrics | null {
        if (this.metrics.length === 0) return null;
        return this.metrics.reduce((peak, current) =>
            current.usage_percent > peak.usage_percent ? current : peak
        );
    }

    isSwapActive(): boolean {
        return this.metrics.some((m) => m.swap_used > 0);
    }
}
```

## Best Practices

### 1. Monitor Regularly but Not Excessively

```typescript
// Good: Check every 10-30 seconds
setInterval(() => {
    const memory = __sys__.$memory();
    if (memory.usage_percent > 85) {
        console.warn("High memory usage detected");
    }
}, 10000);

// Avoid: Checking too frequently
setInterval(() => __sys__.$memory(), 100); // Too frequent
```

### 2. Understand Available vs Free

```typescript
const memory = __sys__.$memory();

// 'free' is completely unused memory
console.log(`Free: ${memory.free}`);

// 'available' includes reclaimable cache
console.log(`Available: ${memory.available}`);

// Use 'available' for capacity planning
const canAllocate = memory.available > requiredMemory;
```

### 3. Handle Swap Usage Appropriately

```typescript
const memory = __sys__.$memory();

if (memory.swap_used > 0) {
    console.warn("System is using swap - performance may be degraded");

    if (memory.swap_percent > 50) {
        console.error("Heavy swap usage - consider adding more RAM");
    }
}
```

### 4. Set Appropriate Thresholds

```typescript
const THRESHOLDS = {
    warning: 75, // Start monitoring closely
    critical: 85, // Take action
    emergency: 95, // Immediate intervention
};

function checkMemoryThresholds(): void {
    const memory = __sys__.$memory();

    if (memory.usage_percent >= THRESHOLDS.emergency) {
        // Emergency: Force garbage collection, clear caches
        global.gc?.();
        cache.clear();
    } else if (memory.usage_percent >= THRESHOLDS.critical) {
        // Critical: Reduce memory usage
        cache.prune();
    } else if (memory.usage_percent >= THRESHOLDS.warning) {
        // Warning: Monitor closely
        console.warn(`Memory usage at ${memory.usage_percent.toFixed(1)}%`);
    }
}
```

### 5. Consider Platform Differences

```typescript
function getMemoryInfo(): string {
    const memory = __sys__.$memory();
    const platform = process.platform;

    let info = `Memory: ${memory.usage_percent.toFixed(1)}% used\n`;

    if (platform === "linux") {
        // Linux: available is accurate
        info += `Available: ${(memory.available / 1024 ** 3).toFixed(2)} GB\n`;
    } else if (platform === "darwin") {
        // macOS: may include compressed memory
        info += `Available: ${(memory.available / 1024 ** 3).toFixed(
            2
        )} GB (includes compressed)\n`;
    } else if (platform === "win32") {
        // Windows: available calculation may differ
        info += `Available: ${(memory.available / 1024 ** 3).toFixed(2)} GB\n`;
    }

    return info;
}
```

## Platform Considerations

### Linux

-   Accurate memory reporting
-   `available` includes reclaimable cache and buffers
-   Swap usage clearly reported

### macOS

-   Memory compression may affect reported values
-   `available` includes compressed memory
-   Swap is managed dynamically

### Windows

-   Memory reporting varies by Windows version
-   `available` calculation may differ from Linux
-   Swap (page file) usage reported

## Performance Impact

Memory monitoring operations are lightweight:

-   **Query Time**: ~1-2ms
-   **Memory Overhead**: Negligible (<1KB)
-   **CPU Impact**: Minimal

## Troubleshooting

### High Memory Usage

```typescript
function diagnoseHighMemory(): void {
    const memory = __sys__.$memory();

    if (memory.usage_percent > 90) {
        console.error("High memory usage detected");
        console.error(`Used: ${(memory.used / 1024 ** 3).toFixed(2)} GB`);
        console.error(
            `Available: ${(memory.available / 1024 ** 3).toFixed(2)} GB`
        );

        // Check if swap is being used
        if (memory.swap_used > 0) {
            console.error(
                `Swap in use: ${(memory.swap_used / 1024 ** 3).toFixed(2)} GB`
            );
        }

        // Suggest actions
        console.error("Suggested actions:");
        console.error("1. Trigger garbage collection: global.gc()");
        console.error("2. Clear application caches");
        console.error("3. Reduce concurrent operations");
        console.error("4. Consider increasing system RAM");
    }
}
```

### Swap Thrashing

```typescript
class SwapMonitor {
    private lastSwapUsed = 0;

    check(): void {
        const memory = __sys__.$memory();

        if (memory.swap_used > this.lastSwapUsed) {
            const increase = memory.swap_used - this.lastSwapUsed;
            console.warn(
                `Swap usage increased by ${(increase / 1024 ** 2).toFixed(
                    2
                )} MB`
            );

            if (increase > 100 * 1024 ** 2) {
                // More than 100MB
                console.error(
                    "Rapid swap increase detected - possible thrashing"
                );
            }
        }

        this.lastSwapUsed = memory.swap_used;
    }
}
```

## Related Documentation

-   [CPU Monitoring](./cpu-monitoring.md)
-   [Process Management](./process-management.md)
-   [System Health](./system-health.md)

---

**Version:** XyPriss v6.0.0+  
**Last Updated:** 2026-01-12


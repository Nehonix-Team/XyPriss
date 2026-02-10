# Process Management

**Version Compatibility:** XyPriss v6.0.0 and above

## Overview

The Process Management API provides comprehensive access to system process information, enabling applications to monitor running processes, track resource consumption, and identify system bottlenecks.

## API Reference

### `$processes(options?: ProcessOptions): ProcessInfo[] | ProcessInfo | ProcessStats`

Retrieves process information with flexible filtering options.

**Parameters:**

-   `options` - (Optional) Filter and query options

**Options:**

```typescript
interface ProcessOptions {
    pid?: number; // Get specific process by PID
    topCpu?: number; // Get top N processes by CPU usage
    topMem?: number; // Get top N processes by memory usage
}
```

**Returns:**

-   `ProcessInfo[]` - Array of processes (default or with top filters)
-   `ProcessInfo` - Single process (when `pid` specified)
-   `ProcessStats` - Process statistics summary

## Return Types

### ProcessInfo

Detailed information about a single process.

```typescript
interface ProcessInfo {
    pid: number; // Process ID
    name: string; // Process name
    exe?: string; // Executable path
    cmd: string[]; // Command line arguments
    cpu_usage: number; // CPU usage percentage
    memory: number; // Memory usage in bytes
    virtual_memory: number; // Virtual memory in bytes
    status: string; // Process status (Running, Sleeping, etc.)
    start_time: number; // Start timestamp
    run_time: number; // Runtime in seconds
    parent_pid?: number; // Parent process ID
    user_id?: string; // User ID running the process
    disk_read: number; // Bytes read from disk
    disk_write: number; // Bytes written to disk
}
```

### ProcessStats

Aggregate statistics about all processes.

```typescript
interface ProcessStats {
    total_processes: number; // Total number of processes
    running: number; // Number of running processes
    sleeping: number; // Number of sleeping processes
    stopped: number; // Number of stopped processes
    zombie: number; // Number of zombie processes
}
```

## Usage Examples

### Get All Processes

```typescript
const processes = __sys__.$processes() as ProcessInfo[];

console.log(`Total processes: ${processes.length}`);

processes.slice(0, 10).forEach((proc) => {
    console.log(
        `${proc.pid}: ${proc.name} (CPU: ${proc.cpu_usage.toFixed(1)}%)`
    );
});
```

### Find Top CPU Consumers

```typescript
const topCpu = __sys__.$processes({ topCpu: 5 }) as ProcessInfo[];

console.log("=== Top 5 CPU Consumers ===");
topCpu.forEach((proc, index) => {
    console.log(`${index + 1}. ${proc.name}`);
    console.log(`   PID: ${proc.pid}`);
    console.log(`   CPU: ${proc.cpu_usage.toFixed(2)}%`);
    console.log(`   Memory: ${(proc.memory / 1024 ** 2).toFixed(2)} MB`);
});
```

### Find Top Memory Consumers

```typescript
const topMem = __sys__.$processes({ topMem: 5 }) as ProcessInfo[];

console.log("=== Top 5 Memory Consumers ===");
topMem.forEach((proc, index) => {
    const memoryMB = proc.memory / 1024 ** 2;
    console.log(`${index + 1}. ${proc.name}: ${memoryMB.toFixed(2)} MB`);
});
```

### Get Specific Process

```typescript
const currentPid = process.pid;
const currentProc = __sys__.$processes({ pid: currentPid }) as ProcessInfo;

if (currentProc) {
    console.log("Current Process Info:");
    console.log(`  Name: ${currentProc.name}`);
    console.log(`  PID: ${currentProc.pid}`);
    console.log(`  CPU: ${currentProc.cpu_usage.toFixed(2)}%`);
    console.log(`  Memory: ${(currentProc.memory / 1024 ** 2).toFixed(2)} MB`);
    console.log(`  Runtime: ${currentProc.run_time} seconds`);
}
```

## Common Patterns

### Process Monitoring

```typescript
class ProcessMonitor {
    private pid: number;
    private thresholds = {
        cpu: 80, // 80% CPU
        memory: 1024, // 1GB memory
    };

    constructor(pid: number) {
        this.pid = pid;
    }

    check(): void {
        const proc = __sys__.$processes({ pid: this.pid }) as ProcessInfo;

        if (!proc) {
            console.error(`Process ${this.pid} not found`);
            return;
        }

        if (proc.cpu_usage > this.thresholds.cpu) {
            console.warn(`High CPU usage: ${proc.cpu_usage.toFixed(1)}%`);
        }

        const memoryMB = proc.memory / 1024 ** 2;
        if (memoryMB > this.thresholds.memory) {
            console.warn(`High memory usage: ${memoryMB.toFixed(2)} MB`);
        }
    }
}

const monitor = new ProcessMonitor(process.pid);
setInterval(() => monitor.check(), 5000);
```

### Find Processes by Name

```typescript
function findProcessesByName(name: string): ProcessInfo[] {
    const allProcesses = __sys__.$processes() as ProcessInfo[];

    return allProcesses.filter((proc) =>
        proc.name.toLowerCase().includes(name.toLowerCase())
    );
}

const nodeProcesses = findProcessesByName("node");
console.log(`Found ${nodeProcesses.length} Node.js processes`);
```

### Resource Usage Report

```typescript
function generateResourceReport(): string {
    const topCpu = __sys__.$processes({ topCpu: 3 }) as ProcessInfo[];
    const topMem = __sys__.$processes({ topMem: 3 }) as ProcessInfo[];

    let report = "=== System Resource Usage ===\n\n";

    report += "Top CPU Consumers:\n";
    topCpu.forEach((proc, i) => {
        report += `  ${i + 1}. ${proc.name} (${proc.cpu_usage.toFixed(1)}%)\n`;
    });

    report += "\nTop Memory Consumers:\n";
    topMem.forEach((proc, i) => {
        const mb = (proc.memory / 1024 ** 2).toFixed(2);
        report += `  ${i + 1}. ${proc.name} (${mb} MB)\n`;
    });

    return report;
}

console.log(generateResourceReport());
```

### Detect Resource Hogs

```typescript
interface ResourceHog {
    process: ProcessInfo;
    reason: string;
}

function detectResourceHogs(): ResourceHog[] {
    const processes = __sys__.$processes() as ProcessInfo[];
    const hogs: ResourceHog[] = [];

    processes.forEach((proc) => {
        // High CPU usage
        if (proc.cpu_usage > 75) {
            hogs.push({
                process: proc,
                reason: `High CPU usage: ${proc.cpu_usage.toFixed(1)}%`,
            });
        }

        // High memory usage (>1GB)
        if (proc.memory > 1024 ** 3) {
            hogs.push({
                process: proc,
                reason: `High memory usage: ${(proc.memory / 1024 ** 3).toFixed(
                    2
                )} GB`,
            });
        }

        // High disk I/O (>100MB)
        const totalIO = proc.disk_read + proc.disk_write;
        if (totalIO > 100 * 1024 ** 2) {
            hogs.push({
                process: proc,
                reason: `High disk I/O: ${(totalIO / 1024 ** 2).toFixed(2)} MB`,
            });
        }
    });

    return hogs;
}

const hogs = detectResourceHogs();
if (hogs.length > 0) {
    console.warn(`Found ${hogs.length} resource hogs:`);
    hogs.forEach((hog) => {
        console.warn(
            `  ${hog.process.name} (PID ${hog.process.pid}): ${hog.reason}`
        );
    });
}
```

### Process Tree Analysis

```typescript
interface ProcessTree {
    process: ProcessInfo;
    children: ProcessTree[];
}

function buildProcessTree(rootPid: number): ProcessTree | null {
    const allProcesses = __sys__.$processes() as ProcessInfo[];
    const root = allProcesses.find((p) => p.pid === rootPid);

    if (!root) return null;

    const children = allProcesses
        .filter((p) => p.parent_pid === rootPid)
        .map((child) => buildProcessTree(child.pid))
        .filter((tree): tree is ProcessTree => tree !== null);

    return { process: root, children };
}

function printProcessTree(tree: ProcessTree, indent: string = ""): void {
    console.log(`${indent}${tree.process.name} (${tree.process.pid})`);
    tree.children.forEach((child) => {
        printProcessTree(child, indent + "  ");
    });
}

const tree = buildProcessTree(process.pid);
if (tree) {
    printProcessTree(tree);
}
```

### Long-Running Process Detection

```typescript
function findLongRunningProcesses(minHours: number = 24): ProcessInfo[] {
    const processes = __sys__.$processes() as ProcessInfo[];
    const minSeconds = minHours * 3600;

    return processes.filter((proc) => proc.run_time > minSeconds);
}

const longRunning = findLongRunningProcesses(48);
console.log(`Processes running for more than 48 hours: ${longRunning.length}`);
longRunning.forEach((proc) => {
    const hours = (proc.run_time / 3600).toFixed(1);
    console.log(`  ${proc.name} (${hours}h)`);
});
```

## Best Practices

### 1. Cache Process Lists

```typescript
class ProcessCache {
    private cache: ProcessInfo[] = [];
    private lastUpdate = 0;
    private ttl = 5000; // 5 seconds

    getProcesses(): ProcessInfo[] {
        const now = Date.now();

        if (now - this.lastUpdate > this.ttl) {
            this.cache = __sys__.$processes() as ProcessInfo[];
            this.lastUpdate = now;
        }

        return this.cache;
    }
}

const cache = new ProcessCache();
const processes = cache.getProcesses(); // Uses cache if recent
```

### 2. Filter Early

```typescript
// Good: Use built-in filters
const topCpu = __sys__.$processes({ topCpu: 10 }) as ProcessInfo[];

// Avoid: Getting all processes then filtering
const all = __sys__.$processes() as ProcessInfo[];
const filtered = all.sort((a, b) => b.cpu_usage - a.cpu_usage).slice(0, 10);
```

### 3. Handle Missing Processes

```typescript
function getProcessSafely(pid: number): ProcessInfo | null {
    try {
        const proc = __sys__.$processes({ pid }) as ProcessInfo;
        return proc || null;
    } catch (error) {
        console.warn(`Process ${pid} not found or inaccessible`);
        return null;
    }
}
```

### 4. Aggregate Statistics

```typescript
function getProcessStatistics(): {
    total: number;
    totalCpu: number;
    totalMemory: number;
    avgCpu: number;
    avgMemory: number;
} {
    const processes = __sys__.$processes() as ProcessInfo[];

    const totalCpu = processes.reduce((sum, p) => sum + p.cpu_usage, 0);
    const totalMemory = processes.reduce((sum, p) => sum + p.memory, 0);

    return {
        total: processes.length,
        totalCpu,
        totalMemory,
        avgCpu: totalCpu / processes.length,
        avgMemory: totalMemory / processes.length,
    };
}
```

### 5. Monitor Critical Processes

```typescript
const criticalProcesses = ["nginx", "postgres", "redis"];

function checkCriticalProcesses(): void {
    const allProcesses = __sys__.$processes() as ProcessInfo[];

    criticalProcesses.forEach((name) => {
        const found = allProcesses.some((p) =>
            p.name.toLowerCase().includes(name.toLowerCase())
        );

        if (!found) {
            console.error(`Critical process not running: ${name}`);
        }
    });
}

setInterval(checkCriticalProcesses, 30000);
```

## Platform Considerations

### Linux

-   Full process information available
-   Accurate CPU and memory metrics
-   Complete disk I/O statistics

### macOS

-   Full process information available
-   Accurate metrics
-   Some fields may be unavailable for system processes

### Windows

-   Full process information available
-   Process names may differ from Unix systems
-   User ID format differs

## Performance Impact

Process querying operations:

-   **All Processes**: ~10-50ms (depends on process count)
-   **Top N Processes**: ~10-50ms (sorted at native level)
-   **Single Process**: ~1-5ms
-   **Memory Overhead**: ~1KB per process

## Troubleshooting

### Process Not Found

```typescript
const proc = __sys__.$processes({ pid: 12345 }) as ProcessInfo;

if (!proc) {
    console.error(
        "Process not found - may have terminated or insufficient permissions"
    );
}
```

### Permission Denied

```typescript
// Some process information may require elevated privileges
try {
    const processes = __sys__.$processes() as ProcessInfo[];
    console.log(`Found ${processes.length} accessible processes`);
} catch (error) {
    console.error("Insufficient permissions to query processes");
}
```

## Related Documentation

-   [CPU Monitoring](./cpu-monitoring.md)
-   [Memory Management](./memory-management.md)
-   [System Health](./system-health.md)

---

**Version:** XyPriss v6.0.0+  
**Last Updated:** 2026-01-12


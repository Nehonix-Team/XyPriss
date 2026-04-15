# System Module: Operating System & Hardware (`__sys__.os`)

## Introduction

The `os` (Operating System API) module provides complete, low-level telemetry and control over the host machine's hardware and operating system.

> [!IMPORTANT]
> **Under the Hood Architecture**
> All hardware queries and process monitoring operations are delegated to the [**XHSC (XyPriss Hyper-System Core)**](docs/core/XHSC_CORE.md) via `XyPrissRunner`. This ensures that gathering system metrics does not block Node.js's single-threaded event loop, and provides extreme accuracy for metrics such as CPU load, process execution, and memory management.

---

## Hardware Telemetry

### `cpu`

Retrieves detailed statistics regarding processor cores and overall load.

**Signature:**

```typescript
cpu(cores: true): CpuInfo[]
cpu(cores?: false): CpuUsage
```

**Description:**
Fetches real-time CPU telemetry. When called without arguments (or `cores = false`), it returns an aggregated `CpuUsage` object showing the system's overall load percentage. If `cores = true`, it returns an array of detailed metrics for each logical core.

**Example:**

```typescript
const cpuStats = __sys__.os.cpu();
console.log(`Global CPU Load: ${cpuStats.overall.toFixed(2)}%`);

const perCore = __sys__.os.cpu(true);
console.log(`Core 0 is running at ${perCore[0].usage}%`);
```

### `memory`

Retrieves RAM and Swap usage information.

**Signature:**

```typescript
memory(watch?: boolean): MemoryInfo
```

**Description:**
Reports exactly how much memory is available, used, and total. Passing `watch = true` enables continuous background monitoring in XHSC.

**Example:**

```typescript
const ram = __sys__.os.memory();
console.log(`Free RAM: ${ram.available_memory} bytes`);
```

### `hardware`

A complete snapshot of the motherboard, processor architecture, and memory.

**Signature:**

```typescript
get hardware(): SystemHardware
```

**Description:**
A combined getter that fetches deep architectural information alongside basic system metrics. Excellent for telemetry dashboards.

**Example:**

```typescript
const specs = __sys__.os.hardware;
console.log(`Running on architecture: ${specs.arch}`);
```

### `disks`

Monitors mounted storage volumes.

**Signature:**

```typescript
disks(mount?: string): DiskInfo | DiskInfo[] | undefined
```

**Description:**
Lists all connected storage disks and their respective space. Providing a `mount` string will filter the exact partition (e.g., `/` or `C:\`).

**Example:**

```typescript
const rootDrive = __sys__.os.disks("/");
if (rootDrive) {
    console.log(`Drive Usage: ${rootDrive.used_percent}%`);
}
```

---

## Process / Network Management

### `processes`

Queries the operating system's process tree natively.

**Signature:**

```typescript
processes(options?: { pid?: number; topCpu?: number; topMem?: number }): ProcessInfo[] | ProcessInfo | ProcessStats
```

**Description:**
Highly dynamic method. Provide `{ pid: 1234 }` to seek a specific process. Provide `{ topCpu: 5 }` or `{ topMem: 5 }` to retrieve the heaviest processes currently running on the server.

> [!NOTE]
> Internal XyPriss system processes are automatically excluded from the returned list. The output reflects only user-space processes, ensuring that framework internals do not pollute application-level monitoring or dashboards.

**Example:**

```typescript
const heavyApps = __sys__.os.processes({ topCpu: 3 }) as ProcessInfo[];
heavyApps.forEach((app) =>
    console.log(`${app.name} is using ${app.cpu_usage}% CPU`),
);
```

### `kill`

Safely terminates a running process.

**Signature:**

```typescript
kill(target: number | string): void
```

**Description:**
Accepts a PID (Number) or a process exact name (String) and sends a termination signal natively through XHSC.

**Example:**

```typescript
__sys__.os.kill(9923); // Kill by PID
__sys__.os.kill("nginx"); // Kill all processes named nginx
```

### `ports`

Inspects active networking sockets.

**Signature:**

```typescript
ports(): PortInfo[]
```

**Description:**
Returns a list of all currently bound network ports, their states (e.g., `LISTEN`, `ESTABLISHED`), and the PID holding them.

**Example:**

```typescript
const listening = __sys__.os.ports().filter((p) => p.state === "LISTEN");
console.log(`Server is listening on ${listening.length} ports`);
```

### `network`

Fetches network IO statistics and throughput.

**Signature:**

```typescript
network(interfaceName?: string): NetworkStats | NetworkInterface
```

**Description:**
Provides bytes sent/received. Excellent for measuring server bandwidth natively.

---

## Extended Features

### `info`

Returns a comprehensive snapshot of the system including hardware, OS, boot time, and XHSC runtime metadata.

**Signature:**

```typescript
info(): SystemInfo
```

**Example:**

```typescript
const sysInfo = __sys__.os.info();
console.log(
    `OS: ${sysInfo.os} | Kernel: ${sysInfo.kernel} | Uptime: ${sysInfo.uptime}s`,
);
```

### `monitorProcess`

Watches a specific process by PID for the specified duration and periodically reports its CPU and memory usage.

**Signature:**

```typescript
monitorProcess(pid: number, duration?: number): void
```

**Example:**

```typescript
const { pid } = __sys__.os.processes({ topCpu: 1 })[0];
__sys__.os.monitorProcess(pid, 30); // Watch for 30 seconds
```

### `platform`

Returns the Node.js/OS platform identifier string.

**Signature:**

```typescript
platform(): string
```

**Example:**

```typescript
if (__sys__.os.platform() === "linux") {
    console.log("Running on Linux");
}
```

### Additional Telemetry

- **`temp()`** — Fetches thermal sensor data (useful for Raspberry Pi clusters).
- **`battery()`** — Reads power states and charging percentages.
- **`health()`** — Aggregated system health report (CPU, memory, disks, network).
- **`monitor(duration, interval)`** — Real-time terminal snapshot generation over a defined period.


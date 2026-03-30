# Operating System (`__sys__.os`)

The `__sys__.os` module (based on the `OSApi` class) manages deep interfacing with hardware components and operating system modeling. Designed around a performance-oriented architecture, all operations rely on direct resolutions from the native engine.

## Hardware and Performance Information

### `cpu(cores?: boolean): CpuUsage | CpuInfo[]`

Analyzes and returns CPU utilization. Depending on the argument, it provides either a condensed percentage per core or a strict formal analysis of the history and metrics of each available logical software core.

```typescript
// Unified data
const globalUsage = __sys__.os.cpu();

// Complete topology
const topologies = __sys__.os.cpu(true);
```

### `memory(watch?: boolean): MemoryInfo`

Accurately measures memory distribution, typically using standard OS aggregations.

```typescript
const memStats = __sys__.os.memory();
console.log(`Available capacity: ${memStats.available_memory}`);
```

### `info(): SystemInfo`

Synchronously retrieves general system information directly from the native XyPriss engine, including the operating system details, kernel version, processor specs, and boot times.

```typescript
const sysInfo = __sys__.os.info();
console.log(`System Boot Time: ${sysInfo.boot_time}`);
```

### `hardware` (Getter)

Exposes an aggregate (of type `SystemHardware`) of the entire physical base without requiring heavy computation streams, including architecture (`arch`) and local persistent runtime variables.

---

## System Modeling

### `disks(mount?: string): DiskInfo | DiskInfo[] | undefined`

Enumerates primary mounted disk registries. Also allows targeted extraction against a local anchor point.

```typescript
const rootDrive = __sys__.os.disks("/");
```

### `network(interfaceName?: string): NetworkStats | NetworkInterface`

Detailed telemetry synthesis of latency, transmitted and received frames, via network interfaces installed on the OS context.

### `health(): any`

Global rallying point to obtain a holistic stability indication of the active XyPriss engine.

### `platform(): string`

Indicates the formal textual signature of the native platform (equivalent to Node.js `process.platform` behavior).

---

## Process Supervision

### `processes(options?: { pid?: number; topCpu?: number; topMem?: number }): ProcessInfo[] | ProcessInfo | ProcessStats`

Establishes an ordered array identifying the computational weight of active host applications. Filtering parameters allow targeting the most resource-intensive tasks.

```typescript
const hungryTasks = __sys__.os.processes({ topMem: 5 });
```

### `kill(target: number | string): void`

Immediately and firmly terminates an application through forced notification to the execution supervisor (using an integer `pid` or strict name matching).

```typescript
// Close via PID
__sys__.os.kill(4051);
```

### `ports(): PortInfo[]`

Observes and lists the transit or hosting exclusivity on existing local TCP/UDP sockets.

---

## Interactive Monitoring Commands

The interactive commands below initiate observation benefiting the native engine for immediate measurement and projection of the stream:

- **`monitor(duration?: number, interval?: number)`**: Displays general temporal fluctuations without memory interference in the local frame.
- **`monitorProcess(pid: number, duration?: number)`**: Fine tracking over a fixed temporal window for a designated execution actor.

## Temperatures and Batteries

- **`temp(): any[]`**: Accesses ACPI/thermal probes if supported by kernel drivers.
- **`battery(): BatteryInfo`**: Inspects charge, cycle maintenance, discharge, and degradation expectancy if the device integrates it.


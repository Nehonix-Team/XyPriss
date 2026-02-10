# XyPriss System Intelligence (XSI) API

The XSI API, integrated into the global `__sys__` namespace, provides a direct bridge to native hardware telemetry, system monitoring, and process control. These high-performance utilities are powered by a dedicated Rust core, ensuring minimal overhead and extreme precision.
 
## Table of Contents

1. [System Monitoring](#system-monitoring)
2. [Hardware Telemetry](#hardware-telemetry)
3. [Environment & Identity](#environment--identity)
4. [Process Control](#process-control)
5. [Quick Diagnostics](#quick-diagnostics)

---

## System Monitoring

XyPriss features a real-time monitoring engine capable of providing snapshots of system performance or following specific process behaviors.

| Method                           | Description                                                                                                       |
| :------------------------------- | :---------------------------------------------------------------------------------------------------------------- |
| `$monitor(duration, interval)`   | Starts a system-wide monitor. In interactive mode, it displays a dashboard. In script mode, it returns snapshots. |
| `$monitorProcess(pid, duration)` | Tracks the CPU, Memory, and Disk I/O consumption of a specific process.                                           |

### Example: Live System Monitoring

```typescript
// Monitor system for 10 seconds, updating every 1 second
__sys__.$monitor(10, 1);
```

---

## Hardware Telemetry

Direct access to hardware sensor data provided by the underlying operating system.

| Method       | Description                                                                   |
| :----------- | :---------------------------------------------------------------------------- |
| `$temp()`    | Retrieves current temperature readings from hardware sensors (CPU, GPU, etc). |
| `$battery()` | Returns detailed battery status including capacity, health, and power source. |
| `$ports()`   | Lists all active TCP/UDP listening ports and their associated processes.      |

---

## Environment & Identity

| Method      | Description                                                                    |
| :---------- | :----------------------------------------------------------------------------- |
| `$paths()`  | Returns an array of directories currently in the system's PATH variable.       |
| `$user()`   | Provides information about the current user context executing the application. |
| `$env(var)` | Utility to quickly access or list environment variables.                       |

---

## Process Control

Comprehensive tools to manage running tasks and services.

| Method         | Description                                                                      |
| :------------- | :------------------------------------------------------------------------------- |
| `$processes()` | Returns a detailed list of all running processes with PID, User, CPU%, and MEM%. |
| `$kill(pid)`   | Forcefully terminates a process by its PID. Equivalent to `kill -9`.             |

---

## Quick Diagnostics

| Method      | Description                                                                                              |
| :---------- | :------------------------------------------------------------------------------------------------------- |
| `$health()` | Returns a refined "Health Score" for the operating system based on current load and resource exhaustion. |
| `$quick()`  | Provides a summarized one-line text overview of the system state.                                        |

### Example: Health Check

```typescript
const health = __sys__.$health();
if (health.score < 50) {
    console.warn("System resources are critical! Health Score:", health.score);
}
```


# Network Statistics

**Version Compatibility:** XyPriss v6.0.0 and above

## Overview

The Network Statistics API provides comprehensive access to network interface information, traffic metrics, and real-time bandwidth monitoring. This API enables applications to track network usage, monitor connection health, and optimize network-dependent operations.

## API Reference

### `$network(interfaceName?: string): NetworkStats | NetworkInterface`

Retrieves network statistics for all interfaces or a specific interface.

**Parameters:**

-   `interfaceName` - (Optional) Name of specific interface (e.g., "eth0", "wlan0")

**Returns:**

-   `NetworkStats` - Global network statistics (when no interface specified)
-   `NetworkInterface` - Specific interface details (when interface name provided)

## Return Types

### NetworkStats

Global network statistics across all interfaces.

```typescript
interface NetworkStats {
    total_received: number; // Total bytes received across all interfaces
    total_transmitted: number; // Total bytes transmitted across all interfaces
    download_speed: number; // Current download speed in bytes/second
    upload_speed: number; // Current upload speed in bytes/second
    interfaces: NetworkInterface[]; // Array of all network interfaces
}
```

### NetworkInterface

Detailed information for a single network interface.

```typescript
interface NetworkInterface {
    name: string; // Interface name (e.g., "eth0", "wlan0")
    received: number; // Total bytes received
    transmitted: number; // Total bytes transmitted
    packets_received: number; // Total packets received
    packets_transmitted: number; // Total packets transmitted
    errors_received: number; // Receive errors count
    errors_transmitted: number; // Transmit errors count
    mac_address: string; // MAC address
    ip_addresses: string[]; // Array of IP addresses (IPv4 and IPv6)
}
```

## Usage Examples

### Basic Network Information

```typescript
const network = __sys__.$network() as NetworkStats;

console.log("=== Network Statistics ===");
console.log(`Download Speed: ${formatSpeed(network.download_speed)}`);
console.log(`Upload Speed: ${formatSpeed(network.upload_speed)}`);
console.log(`Total Downloaded: ${formatBytes(network.total_received)}`);
console.log(`Total Uploaded: ${formatBytes(network.total_transmitted)}`);
console.log(`Active Interfaces: ${network.interfaces.length}`);

function formatSpeed(bytesPerSecond: number): string {
    const mbps = (bytesPerSecond * 8) / 1024 ** 2;
    return `${mbps.toFixed(2)} Mbps`;
}

function formatBytes(bytes: number): string {
    const gb = bytes / 1024 ** 3;
    return `${gb.toFixed(2)} GB`;
}
```

**Example Output:**

```
=== Network Statistics ===
Download Speed: 12.45 Mbps
Upload Speed: 3.21 Mbps
Total Downloaded: 145.67 GB
Total Uploaded: 23.45 GB
Active Interfaces: 4
```

### List All Network Interfaces

```typescript
const network = __sys__.$network() as NetworkStats;

console.log("=== Network Interfaces ===");
network.interfaces.forEach((iface) => {
    console.log(`\nInterface: ${iface.name}`);
    console.log(`  MAC: ${iface.mac_address}`);
    console.log(`  IPs: ${iface.ip_addresses.join(", ") || "None"}`);
    console.log(`  Received: ${(iface.received / 1024 ** 2).toFixed(2)} MB`);
    console.log(
        `  Transmitted: ${(iface.transmitted / 1024 ** 2).toFixed(2)} MB`
    );
    console.log(`  Packets RX: ${iface.packets_received.toLocaleString()}`);
    console.log(`  Packets TX: ${iface.packets_transmitted.toLocaleString()}`);

    if (iface.errors_received > 0 || iface.errors_transmitted > 0) {
        console.log(
            `  Errors: RX=${iface.errors_received}, TX=${iface.errors_transmitted}`
        );
    }
});
```

### Get Specific Interface

```typescript
// Get primary network interface
const eth0 = __sys__.$network("eth0") as NetworkInterface;

if (eth0) {
    console.log(`Interface: ${eth0.name}`);
    console.log(`IP Addresses: ${eth0.ip_addresses.join(", ")}`);
    console.log(`MAC Address: ${eth0.mac_address}`);
}
```

### Find Primary Network Interface

```typescript
function getPrimaryInterface(): NetworkInterface | null {
    const network = __sys__.$network() as NetworkStats;

    // Find interface with most traffic
    const sorted = network.interfaces
        .filter((iface) => iface.ip_addresses.length > 0) // Has IP
        .filter((iface) => !iface.name.includes("lo")) // Not loopback
        .sort(
            (a, b) => b.received + b.transmitted - (a.received + a.transmitted)
        );

    return sorted[0] || null;
}

const primary = getPrimaryInterface();
if (primary) {
    console.log(`Primary interface: ${primary.name}`);
    console.log(`IPs: ${primary.ip_addresses.join(", ")}`);
}
```

## Common Patterns

### Bandwidth Monitoring

```typescript
class BandwidthMonitor {
    private lastCheck: NetworkStats | null = null;
    private lastTime: number = Date.now();

    update(): void {
        const current = __sys__.$network() as NetworkStats;
        const now = Date.now();

        if (this.lastCheck) {
            const elapsed = (now - this.lastTime) / 1000; // seconds

            const downloadSpeed =
                (current.total_received - this.lastCheck.total_received) /
                elapsed;
            const uploadSpeed =
                (current.total_transmitted - this.lastCheck.total_transmitted) /
                elapsed;

            console.log(`Download: ${this.formatSpeed(downloadSpeed)}`);
            console.log(`Upload: ${this.formatSpeed(uploadSpeed)}`);
        }

        this.lastCheck = current;
        this.lastTime = now;
    }

    private formatSpeed(bytesPerSecond: number): string {
        if (bytesPerSecond < 1024) {
            return `${bytesPerSecond.toFixed(2)} B/s`;
        } else if (bytesPerSecond < 1024 ** 2) {
            return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
        } else {
            return `${(bytesPerSecond / 1024 ** 2).toFixed(2)} MB/s`;
        }
    }
}

const monitor = new BandwidthMonitor();
setInterval(() => monitor.update(), 1000);
```

### Network Health Check

```typescript
interface NetworkHealth {
    status: "healthy" | "degraded" | "down";
    activeInterfaces: number;
    hasErrors: boolean;
    primaryInterface: string | null;
}

function checkNetworkHealth(): NetworkHealth {
    const network = __sys__.$network() as NetworkStats;

    const activeInterfaces = network.interfaces.filter(
        (iface) => iface.ip_addresses.length > 0 && !iface.name.includes("lo")
    );

    const hasErrors = network.interfaces.some(
        (iface) => iface.errors_received > 0 || iface.errors_transmitted > 0
    );

    const primary = activeInterfaces.sort(
        (a, b) => b.received + b.transmitted - (a.received + a.transmitted)
    )[0];

    let status: "healthy" | "degraded" | "down" = "healthy";

    if (activeInterfaces.length === 0) {
        status = "down";
    } else if (hasErrors || activeInterfaces.length < 2) {
        status = "degraded";
    }

    return {
        status,
        activeInterfaces: activeInterfaces.length,
        hasErrors,
        primaryInterface: primary?.name || null,
    };
}

app.get("/health/network", (req, res) => {
    const health = checkNetworkHealth();
    const statusCode =
        health.status === "healthy"
            ? 200
            : health.status === "degraded"
            ? 429
            : 503;
    res.status(statusCode).json(health);
});
```

### Traffic Analysis

```typescript
interface TrafficStats {
    totalTraffic: number;
    downloadRatio: number;
    uploadRatio: number;
    topInterface: string;
}

function analyzeTraffic(): TrafficStats {
    const network = __sys__.$network() as NetworkStats;

    const totalTraffic = network.total_received + network.total_transmitted;
    const downloadRatio = network.total_received / totalTraffic;
    const uploadRatio = network.total_transmitted / totalTraffic;

    const topInterface = network.interfaces
        .filter((iface) => !iface.name.includes("lo"))
        .sort(
            (a, b) => b.received + b.transmitted - (a.received + a.transmitted)
        )[0];

    return {
        totalTraffic,
        downloadRatio,
        uploadRatio,
        topInterface: topInterface?.name || "none",
    };
}

const stats = analyzeTraffic();
console.log(`Total Traffic: ${(stats.totalTraffic / 1024 ** 3).toFixed(2)} GB`);
console.log(
    `Download/Upload Ratio: ${(stats.downloadRatio * 100).toFixed(1)}% / ${(
        stats.uploadRatio * 100
    ).toFixed(1)}%`
);
console.log(`Busiest Interface: ${stats.topInterface}`);
```

### Connection Monitoring

```typescript
class ConnectionMonitor {
    private interfaces: Map<string, NetworkInterface> = new Map();

    update(): void {
        const network = __sys__.$network() as NetworkStats;

        network.interfaces.forEach((current) => {
            const previous = this.interfaces.get(current.name);

            if (previous) {
                // Check for new IP addresses
                const newIPs = current.ip_addresses.filter(
                    (ip) => !previous.ip_addresses.includes(ip)
                );

                if (newIPs.length > 0) {
                    console.log(
                        `New IP on ${current.name}: ${newIPs.join(", ")}`
                    );
                }

                // Check for errors
                if (current.errors_received > previous.errors_received) {
                    const newErrors =
                        current.errors_received - previous.errors_received;
                    console.warn(
                        `${newErrors} new receive errors on ${current.name}`
                    );
                }

                if (current.errors_transmitted > previous.errors_transmitted) {
                    const newErrors =
                        current.errors_transmitted -
                        previous.errors_transmitted;
                    console.warn(
                        `${newErrors} new transmit errors on ${current.name}`
                    );
                }
            }

            this.interfaces.set(current.name, current);
        });
    }
}

const connMonitor = new ConnectionMonitor();
setInterval(() => connMonitor.update(), 5000);
```

### Data Usage Tracking

```typescript
interface DataUsage {
    period: string;
    downloaded: number;
    uploaded: number;
    total: number;
}

class DataUsageTracker {
    private startStats: NetworkStats | null = null;
    private startTime: Date = new Date();

    start(): void {
        this.startStats = __sys__.$network() as NetworkStats;
        this.startTime = new Date();
    }

    getUsage(): DataUsage {
        const current = __sys__.$network() as NetworkStats;

        if (!this.startStats) {
            this.start();
            return {
                period: "0 seconds",
                downloaded: 0,
                uploaded: 0,
                total: 0,
            };
        }

        const downloaded =
            current.total_received - this.startStats.total_received;
        const uploaded =
            current.total_transmitted - this.startStats.total_transmitted;
        const elapsed = Date.now() - this.startTime.getTime();

        return {
            period: this.formatDuration(elapsed),
            downloaded,
            uploaded,
            total: downloaded + uploaded,
        };
    }

    private formatDuration(ms: number): string {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    reset(): void {
        this.start();
    }
}

const tracker = new DataUsageTracker();
tracker.start();

// Get usage report
setInterval(() => {
    const usage = tracker.getUsage();
    console.log(`Data usage over ${usage.period}:`);
    console.log(
        `  Downloaded: ${(usage.downloaded / 1024 ** 2).toFixed(2)} MB`
    );
    console.log(`  Uploaded: ${(usage.uploaded / 1024 ** 2).toFixed(2)} MB`);
    console.log(`  Total: ${(usage.total / 1024 ** 2).toFixed(2)} MB`);
}, 60000);
```

## Best Practices

### 1. Handle Interface Availability

```typescript
function getInterfaceSafely(name: string): NetworkInterface | null {
    try {
        const iface = __sys__.$network(name) as NetworkInterface;
        return iface || null;
    } catch (error) {
        console.warn(`Interface ${name} not found`);
        return null;
    }
}
```

### 2. Filter Loopback Interfaces

```typescript
function getPhysicalInterfaces(): NetworkInterface[] {
    const network = __sys__.$network() as NetworkStats;

    return network.interfaces.filter(
        (iface) =>
            !iface.name.includes("lo") && // Not loopback
            !iface.name.includes("docker") && // Not Docker
            !iface.name.includes("veth") && // Not virtual Ethernet
            iface.ip_addresses.length > 0 // Has IP address
    );
}
```

### 3. Monitor Speed Changes

```typescript
class SpeedMonitor {
    private lastSpeed = { download: 0, upload: 0 };
    private threshold = 0.5; // 50% change

    check(): void {
        const network = __sys__.$network() as NetworkStats;

        const downloadChange = Math.abs(
            (network.download_speed - this.lastSpeed.download) /
                this.lastSpeed.download
        );

        const uploadChange = Math.abs(
            (network.upload_speed - this.lastSpeed.upload) /
                this.lastSpeed.upload
        );

        if (downloadChange > this.threshold) {
            console.log(
                `Significant download speed change: ${this.formatSpeed(
                    network.download_speed
                )}`
            );
        }

        if (uploadChange > this.threshold) {
            console.log(
                `Significant upload speed change: ${this.formatSpeed(
                    network.upload_speed
                )}`
            );
        }

        this.lastSpeed = {
            download: network.download_speed,
            upload: network.upload_speed,
        };
    }

    private formatSpeed(bps: number): string {
        return `${((bps * 8) / 1024 ** 2).toFixed(2)} Mbps`;
    }
}
```

### 4. Aggregate Statistics

```typescript
function getAggregateStats(): {
    totalInterfaces: number;
    activeInterfaces: number;
    totalIPs: number;
    totalErrors: number;
} {
    const network = __sys__.$network() as NetworkStats;

    return {
        totalInterfaces: network.interfaces.length,
        activeInterfaces: network.interfaces.filter(
            (i) => i.ip_addresses.length > 0
        ).length,
        totalIPs: network.interfaces.reduce(
            (sum, i) => sum + i.ip_addresses.length,
            0
        ),
        totalErrors: network.interfaces.reduce(
            (sum, i) => sum + i.errors_received + i.errors_transmitted,
            0
        ),
    };
}
```

### 5. Detect Network Changes

```typescript
class NetworkChangeDetector {
    private lastInterfaces: Set<string> = new Set();

    check(): void {
        const network = __sys__.$network() as NetworkStats;
        const currentInterfaces = new Set(
            network.interfaces.map((i) => i.name)
        );

        // Detect new interfaces
        currentInterfaces.forEach((name) => {
            if (!this.lastInterfaces.has(name)) {
                console.log(`New network interface detected: ${name}`);
            }
        });

        // Detect removed interfaces
        this.lastInterfaces.forEach((name) => {
            if (!currentInterfaces.has(name)) {
                console.log(`Network interface removed: ${name}`);
            }
        });

        this.lastInterfaces = currentInterfaces;
    }
}
```

## Platform Considerations

### Linux

-   Full support for all network metrics
-   Accurate speed measurements
-   Complete interface information

### macOS

-   Full support for all network metrics
-   Speed measurements may have slight delay
-   Complete interface information

### Windows

-   Full support for all network metrics
-   Interface names may differ from Unix systems
-   Speed measurements accurate

## Performance Impact

Network monitoring operations are lightweight:

-   **Query Time**: ~300ms (includes speed sampling)
-   **Memory Overhead**: ~1-2KB per interface
-   **CPU Impact**: Minimal

**Note:** The `$network()` method includes a 300ms sampling period to calculate accurate download/upload speeds.

## Troubleshooting

### No IP Addresses Shown

```typescript
const network = __sys__.$network() as NetworkStats;

network.interfaces.forEach((iface) => {
    if (iface.ip_addresses.length === 0) {
        console.log(`Interface ${iface.name} has no IP addresses`);
        console.log(`  MAC: ${iface.mac_address}`);
        console.log(`  Status: Possibly down or not configured`);
    }
});
```

### High Error Rates

```typescript
function detectHighErrorRate(): void {
    const network = __sys__.$network() as NetworkStats;

    network.interfaces.forEach((iface) => {
        const totalPackets = iface.packets_received + iface.packets_transmitted;
        const totalErrors = iface.errors_received + iface.errors_transmitted;

        if (totalPackets > 0) {
            const errorRate = (totalErrors / totalPackets) * 100;

            if (errorRate > 1) {
                // More than 1% errors
                console.error(
                    `High error rate on ${iface.name}: ${errorRate.toFixed(2)}%`
                );
                console.error(`  RX Errors: ${iface.errors_received}`);
                console.error(`  TX Errors: ${iface.errors_transmitted}`);
            }
        }
    });
}
```

## Related Documentation

-   [Port Scanning](./port-scanning.md)
-   [System Health](./system-health.md)
-   [Process Management](./process-management.md)

---

**Version:** XyPriss v6.0.0+  
**Last Updated:** 2026-01-12


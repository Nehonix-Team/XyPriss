# Disk Information

**Version Compatibility:** XyPriss v6.0.0 and above

## Overview

The Disk Information API provides comprehensive access to disk and storage device information, including capacity, usage, and filesystem details. This API enables applications to monitor disk space, detect storage issues, and optimize data management.

## API Reference

### `$disks(mountPoint?: string): DiskInfo[] | DiskInfo`

Retrieves information about all mounted disks or a specific disk.

**Parameters:**

-   `mountPoint` - (Optional) Specific mount point to query (e.g., "/", "/mnt/data")

**Returns:**

-   `DiskInfo[]` - Array of all disks (when no mount point specified)
-   `DiskInfo` - Specific disk information (when mount point provided)

## Return Type

### DiskInfo

Comprehensive information about a disk or partition.

```typescript
interface DiskInfo {
    name: string; // Disk name (e.g., "/dev/sda1")
    mount_point: string; // Mount point (e.g., "/", "/home")
    file_system: string; // Filesystem type (e.g., "ext4", "ntfs", "apfs")
    total_space: number; // Total capacity in bytes
    available_space: number; // Available space in bytes
    used_space: number; // Used space in bytes
    usage_percent: number; // Usage percentage (0-100)
    is_removable: boolean; // Whether disk is removable
    disk_type: string; // Disk type (e.g., "HDD", "SSD", "Unknown")
}
```

## Usage Examples

### List All Disks

```typescript
const disks = __sys__.$disks() as DiskInfo[];

console.log("=== Mounted Disks ===");
disks.forEach((disk) => {
    console.log(`\nDisk: ${disk.name}`);
    console.log(`  Mount: ${disk.mount_point}`);
    console.log(`  Type: ${disk.disk_type} (${disk.file_system})`);
    console.log(`  Total: ${formatBytes(disk.total_space)}`);
    console.log(
        `  Used: ${formatBytes(disk.used_space)} (${disk.usage_percent.toFixed(
            1
        )}%)`
    );
    console.log(`  Available: ${formatBytes(disk.available_space)}`);
    console.log(`  Removable: ${disk.is_removable ? "Yes" : "No"}`);
});

function formatBytes(bytes: number): string {
    const gb = bytes / 1024 ** 3;
    if (gb >= 1024) {
        return `${(gb / 1024).toFixed(2)} TB`;
    }
    return `${gb.toFixed(2)} GB`;
}
```

**Example Output:**

```
=== Mounted Disks ===

Disk: /dev/nvme0n1p2
  Mount: /
  Type: SSD (ext4)
  Total: 476.94 GB
  Used: 234.56 GB (49.2%)
  Available: 242.38 GB
  Removable: No

Disk: /dev/sdb1
  Mount: /mnt/backup
  Type: HDD (ext4)
  Total: 1.82 TB
  Used: 456.78 GB (24.5%)
  Available: 1.37 TB
  Removable: Yes
```

### Get Root Disk Information

```typescript
const rootDisk = __sys__.$disks("/") as DiskInfo;

if (rootDisk) {
    console.log("Root Disk Status:");
    console.log(`  Usage: ${rootDisk.usage_percent.toFixed(1)}%`);
    console.log(
        `  Available: ${(rootDisk.available_space / 1024 ** 3).toFixed(2)} GB`
    );

    if (rootDisk.usage_percent > 90) {
        console.warn("WARNING: Root disk is nearly full!");
    }
}
```

### Check Disk Space

```typescript
function checkDiskSpace(
    mountPoint: string,
    thresholdPercent: number = 80
): boolean {
    const disk = __sys__.$disks(mountPoint) as DiskInfo;

    if (!disk) {
        console.error(`Disk not found: ${mountPoint}`);
        return false;
    }

    if (disk.usage_percent > thresholdPercent) {
        console.warn(
            `Disk ${mountPoint} is ${disk.usage_percent.toFixed(1)}% full`
        );
        console.warn(
            `Available: ${(disk.available_space / 1024 ** 3).toFixed(2)} GB`
        );
        return false;
    }

    return true;
}

// Check root disk
const hasSpace = checkDiskSpace("/", 85);
```

## Common Patterns

### Disk Space Monitoring

```typescript
class DiskMonitor {
    private thresholds = {
        warning: 80,
        critical: 90,
        emergency: 95,
    };

    check(): void {
        const disks = __sys__.$disks() as DiskInfo[];

        disks.forEach((disk) => {
            const usage = disk.usage_percent;

            if (usage >= this.thresholds.emergency) {
                console.error(
                    `EMERGENCY: ${disk.mount_point} is ${usage.toFixed(
                        1
                    )}% full`
                );
                this.handleEmergency(disk);
            } else if (usage >= this.thresholds.critical) {
                console.error(
                    `CRITICAL: ${disk.mount_point} is ${usage.toFixed(1)}% full`
                );
                this.handleCritical(disk);
            } else if (usage >= this.thresholds.warning) {
                console.warn(
                    `WARNING: ${disk.mount_point} is ${usage.toFixed(1)}% full`
                );
            }
        });
    }

    private handleEmergency(disk: DiskInfo): void {
        // Implement emergency cleanup
        console.error(
            `Available: ${(disk.available_space / 1024 ** 3).toFixed(2)} GB`
        );
        console.error("Immediate action required!");
    }

    private handleCritical(disk: DiskInfo): void {
        // Implement critical cleanup
        console.error(
            `Available: ${(disk.available_space / 1024 ** 3).toFixed(2)} GB`
        );
        console.error("Cleanup recommended");
    }
}

const monitor = new DiskMonitor();
setInterval(() => monitor.check(), 60000); // Check every minute
```

### Storage Health Check

```typescript
interface StorageHealth {
    status: "healthy" | "warning" | "critical";
    disks: {
        mount: string;
        usage: number;
        available_gb: number;
    }[];
    issues: string[];
}

function checkStorageHealth(): StorageHealth {
    const disks = __sys__.$disks() as DiskInfo[];
    const issues: string[] = [];

    let status: "healthy" | "warning" | "critical" = "healthy";

    const diskInfo = disks.map((disk) => {
        const availableGB = disk.available_space / 1024 ** 3;

        if (disk.usage_percent >= 95) {
            status = "critical";
            issues.push(
                `${
                    disk.mount_point
                } is critically full (${disk.usage_percent.toFixed(1)}%)`
            );
        } else if (disk.usage_percent >= 85) {
            if (status !== "critical") status = "warning";
            issues.push(
                `${
                    disk.mount_point
                } is running low on space (${disk.usage_percent.toFixed(1)}%)`
            );
        }

        if (availableGB < 1) {
            status = "critical";
            issues.push(`${disk.mount_point} has less than 1GB available`);
        }

        return {
            mount: disk.mount_point,
            usage: disk.usage_percent,
            available_gb: availableGB,
        };
    });

    return { status, disks: diskInfo, issues };
}

app.get("/health/storage", (req, res) => {
    const health = checkStorageHealth();
    const statusCode =
        health.status === "healthy"
            ? 200
            : health.status === "warning"
            ? 429
            : 503;
    res.status(statusCode).json(health);
});
```

### Disk Type Analysis

```typescript
function analyzeDiskTypes(): {
    ssd: number;
    hdd: number;
    unknown: number;
    removable: number;
} {
    const disks = __sys__.$disks() as DiskInfo[];

    return {
        ssd: disks.filter((d) => d.disk_type === "SSD").length,
        hdd: disks.filter((d) => d.disk_type === "HDD").length,
        unknown: disks.filter((d) => d.disk_type === "Unknown").length,
        removable: disks.filter((d) => d.is_removable).length,
    };
}

const types = analyzeDiskTypes();
console.log("Disk Type Distribution:");
console.log(`  SSDs: ${types.ssd}`);
console.log(`  HDDs: ${types.hdd}`);
console.log(`  Removable: ${types.removable}`);
```

### Capacity Planning

```typescript
interface CapacityReport {
    totalCapacity: number;
    totalUsed: number;
    totalAvailable: number;
    projectedDaysUntilFull: number | null;
}

class CapacityPlanner {
    private usageHistory: Map<string, number[]> = new Map();
    private maxSamples = 100;

    recordUsage(): void {
        const disks = __sys__.$disks() as DiskInfo[];

        disks.forEach((disk) => {
            const history = this.usageHistory.get(disk.mount_point) || [];
            history.push(disk.used_space);

            if (history.length > this.maxSamples) {
                history.shift();
            }

            this.usageHistory.set(disk.mount_point, history);
        });
    }

    getProjection(mountPoint: string): number | null {
        const history = this.usageHistory.get(mountPoint);
        if (!history || history.length < 10) return null;

        // Calculate average daily growth
        const firstSample = history[0];
        const lastSample = history[history.length - 1];
        const growth = lastSample - firstSample;
        const daysElapsed = history.length / (24 * 60); // Assuming hourly samples
        const dailyGrowth = growth / daysElapsed;

        if (dailyGrowth <= 0) return null;

        const disk = __sys__.$disks(mountPoint) as DiskInfo;
        if (!disk) return null;

        const remainingSpace = disk.available_space;
        return remainingSpace / dailyGrowth;
    }

    getReport(): CapacityReport {
        const disks = __sys__.$disks() as DiskInfo[];

        const totalCapacity = disks.reduce((sum, d) => sum + d.total_space, 0);
        const totalUsed = disks.reduce((sum, d) => sum + d.used_space, 0);
        const totalAvailable = disks.reduce(
            (sum, d) => sum + d.available_space,
            0
        );

        // Get worst-case projection
        const projections = disks
            .map((d) => this.getProjection(d.mount_point))
            .filter((p): p is number => p !== null);

        const projectedDaysUntilFull =
            projections.length > 0 ? Math.min(...projections) : null;

        return {
            totalCapacity,
            totalUsed,
            totalAvailable,
            projectedDaysUntilFull,
        };
    }
}

const planner = new CapacityPlanner();
setInterval(() => planner.recordUsage(), 3600000); // Record hourly
```

### Find Largest Disks

```typescript
function getLargestDisks(count: number = 3): DiskInfo[] {
    const disks = __sys__.$disks() as DiskInfo[];

    return disks.sort((a, b) => b.total_space - a.total_space).slice(0, count);
}

const largest = getLargestDisks(3);
console.log("Largest Disks:");
largest.forEach((disk, i) => {
    const sizeGB = disk.total_space / 1024 ** 3;
    console.log(`${i + 1}. ${disk.mount_point}: ${sizeGB.toFixed(2)} GB`);
});
```

## Best Practices

### 1. Monitor Critical Mount Points

```typescript
const criticalMounts = ["/", "/home", "/var"];

function checkCriticalMounts(): void {
    criticalMounts.forEach((mount) => {
        const disk = __sys__.$disks(mount) as DiskInfo;

        if (!disk) {
            console.error(`Critical mount point not found: ${mount}`);
            return;
        }

        if (disk.usage_percent > 85) {
            console.warn(
                `Critical mount ${mount} is ${disk.usage_percent.toFixed(
                    1
                )}% full`
            );
        }
    });
}
```

### 2. Handle Removable Disks

```typescript
function getFixedDisks(): DiskInfo[] {
    const disks = __sys__.$disks() as DiskInfo[];
    return disks.filter((disk) => !disk.is_removable);
}

// Monitor only fixed disks
const fixedDisks = getFixedDisks();
```

### 3. Set Appropriate Thresholds

```typescript
function getThreshold(disk: DiskInfo): number {
    const sizeGB = disk.total_space / 1024 ** 3;

    // Larger disks can tolerate higher usage percentages
    if (sizeGB > 1000) return 90; // >1TB: 90%
    if (sizeGB > 500) return 85; // >500GB: 85%
    return 80; // <500GB: 80%
}
```

### 4. Format Output Consistently

```typescript
function formatDiskSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB", "PB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}
```

### 5. Cache Disk Information

```typescript
class DiskCache {
    private cache: DiskInfo[] = [];
    private lastUpdate = 0;
    private ttl = 60000; // 1 minute

    getDisks(): DiskInfo[] {
        const now = Date.now();

        if (now - this.lastUpdate > this.ttl) {
            this.cache = __sys__.$disks() as DiskInfo[];
            this.lastUpdate = now;
        }

        return this.cache;
    }
}
```

## Platform Considerations

### Linux

-   Full disk information available
-   Accurate filesystem type reporting
-   Removable disk detection reliable

### macOS

-   Full disk information available
-   APFS filesystem support
-   Accurate capacity reporting

### Windows

-   Full disk information available
-   Drive letters as mount points
-   NTFS and FAT32 support

## Performance Impact

Disk information queries:

-   **Query Time**: ~5-20ms (depends on disk count)
-   **Memory Overhead**: ~500 bytes per disk
-   **CPU Impact**: Minimal

## Troubleshooting

### Disk Not Found

```typescript
const disk = __sys__.$disks("/mnt/data") as DiskInfo;

if (!disk) {
    console.error("Disk not found - may not be mounted");

    // List available disks
    const available = __sys__.$disks() as DiskInfo[];
    console.log("Available mount points:");
    available.forEach((d) => console.log(`  ${d.mount_point}`));
}
```

### Inaccurate Usage Reporting

```typescript
// Some filesystems reserve space for root
const disk = __sys__.$disks("/") as DiskInfo;

if (disk) {
    const reportedUsage = disk.usage_percent;
    const calculatedUsage = (disk.used_space / disk.total_space) * 100;

    if (Math.abs(reportedUsage - calculatedUsage) > 5) {
        console.log("Note: Filesystem may have reserved space");
    }
}
```

## Related Documentation

-   [File I/O](./file-io.md)
-   [Directory Management](./directory-management.md)
-   [System Health](./system-health.md)

---

**Version:** XyPriss v6.0.0+  
**Last Updated:** 2026-01-12


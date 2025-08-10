/**
 * CPU usage statistics for a process
 */
export interface ProcessCpuStats {
    pid: number;
    usage: number; // Current CPU usage percentage (0-100)
    userTime: number; // User CPU time in milliseconds
    systemTime: number; // System CPU time in milliseconds
    totalTime: number; // Total CPU time in milliseconds
    timestamp: number; // When the measurement was taken
}

/**
 * System-wide CPU statistics
 */
export interface SystemCpuStats {
    overall: number; // Overall system CPU usage (0-100)
    cores: number[]; // Per-core CPU usage
    loadAverage: number[]; // 1, 5, 15 minute load averages
    processes: number; // Number of running processes
    timestamp: number;
}

/**
 * CPU monitoring configuration
 */
export interface CpuMonitorConfig {
    enabled: boolean;
    sampleInterval: number; // Milliseconds between samples
    historySize: number; // Number of historical samples to keep
    smoothingFactor: number; // For exponential smoothing (0-1)
    alertThresholds: {
        warning: number; // CPU usage % to trigger warning
        critical: number; // CPU usage % to trigger critical alert
    };
}

/**
 * Historical CPU data point
 */
export interface CpuDataPoint {
    timestamp: number;
    usage: number;
    processes: Map<number, ProcessCpuStats>;
}


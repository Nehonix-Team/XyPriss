import { Stats } from "fs";

export interface FileWatcherConfig {
    enabled: boolean;
    watchPaths: string[];
    ignorePaths: string[];
    ignorePatterns: RegExp[];
    extensions: string[];
    debounceMs: number;
    restartDelay: number;
    maxRestarts: number;
    resetRestartsAfter: number; // Reset restart counter after X ms
    gracefulShutdown: boolean;
    gracefulShutdownTimeout: number;
    verbose: boolean;
    usePolling: boolean;
    pollingInterval: number;
    followSymlinks: boolean;
    persistentWatching: boolean;
    batchChanges: boolean;
    batchTimeout: number;
    enableFileHashing: boolean;
    clearScreen: boolean;
    showBanner: boolean;
    customIgnoreFile: string;
    watchDotFiles: boolean;
    maxFileSize: number; // MB
    excludeEmptyFiles: boolean;
    parallelProcessing: boolean;
    healthCheck: boolean;
    healthCheckInterval: number;
    memoryLimit: number; // MB

    // TypeScript checking configuration
    typeCheck?: {
        enabled?: boolean; // Enable TypeScript checking
        configFile?: string; // Path to tsconfig.json (auto-detected if not provided)
        checkOnSave?: boolean; // Check types when files are saved
        checkBeforeRestart?: boolean; // Check types before restarting server
        showWarnings?: boolean; // Show TypeScript warnings
        showInfos?: boolean; // Show TypeScript info messages
        maxErrors?: number; // Maximum errors to display
        failOnError?: boolean; // Prevent restart if type errors found
        excludePatterns?: string[]; // Additional patterns to exclude from type checking
        includePatterns?: string[]; // Specific patterns to include for type checking
        verbose?: boolean; // Verbose type checking output
    };

    // TypeScript execution configuration
    typescript?: {
        enabled?: boolean; // Auto-detect TypeScript files and use appropriate runner
        runner?:
            | "auto"
            | "tsx"
            | "ts-node"
            | "bun"
            | "node"
            | "runtime-compile"
            | string; // TypeScript runner to use
        runnerArgs?: string[]; // Additional arguments for the TypeScript runner
        fallbackToNode?: boolean; // Fallback to node if TypeScript runner fails
        autoDetectRunner?: boolean; // Auto-detect available TypeScript runner
        enableRuntimeCompilation?: boolean; // Enable runtime TypeScript compilation as ultimate fallback
        compilerOptions?: any; // TypeScript compiler options for runtime compilation
    };
}

export interface FileChangeEvent {
    type: "change" | "rename" | "add" | "delete" | "access";
    filename: string;
    fullPath: string;
    relativePath: string;
    timestamp: Date;
    size?: number;
    hash?: string;
    previousHash?: string;
    isDirectory: boolean;
    stats?: Stats;
}

export interface BatchChangeEvent {
    changes: FileChangeEvent[];
    totalFiles: number;
    timestamp: Date;
    duration: number;
}

export interface RestartStats {
    totalRestarts: number;
    lastRestart: Date | null;
    averageRestartTime: number;
    fastestRestart: number;
    slowestRestart: number;
    successfulRestarts: number;
    failedRestarts: number;
    restartHistory: Array<{
        timestamp: Date;
        reason: string;
        duration: number;
        success: boolean;
        fileCount: number;
        memoryUsage: NodeJS.MemoryUsage;
    }>;
}

export interface WatcherHealth {
    isHealthy: boolean;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    activeConnections: number;
    lastHealthCheck: Date;
    errors: Array<{
        timestamp: Date;
        error: string;
        resolved: boolean;
    }>;
}


export interface QuickDevConfig {
    script: string;
    watch?: string[];
    ignore?: string[];
    extensions?: string[];
    gracefulShutdown?: boolean;
    gracefulShutdownTimeout?: number;
    maxRestarts?: number;
    resetRestartsAfter?: number;
    restartDelay?: number;
    batchChanges?: boolean; 
    batchTimeout?: number;
    enableHashing?: boolean;
    usePolling?: boolean;
    pollingInterval?: number;
    followSymlinks?: boolean;
    watchDotFiles?: boolean;
    ignoreFile?: string;
    parallelProcessing?: boolean;
    memoryLimit?: number;
    maxFileSize?: number;
    excludeEmptyFiles?: boolean;
    debounceMs?: number;
    healthCheck?: boolean;
    healthCheckInterval?: number;
    clearScreen?: boolean;
    typescriptRunner?: "tsx" | "ts-node";
    tsNodeFlags?: string;
}

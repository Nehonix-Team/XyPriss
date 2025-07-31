import { FileWatcherConfig } from "../service/Reload/types/fw.types";

export const DEFAULT_FW_CONFIG: FileWatcherConfig = {
    enabled: false,
    watchPaths: ["src", "lib", "core"],
    ignorePaths: [
        "node_modules",
        ".git",
        ".vscode",
        ".idea",
        "dist",
        "build",
        "coverage",
        ".next",
        ".cache",
        "tmp",
        "temp",
        "logs",
    ],
    ignorePatterns: [
        /\.log$/,
        /\.tmp$/,
        /\.temp$/,
        /\.swp$/,
        /\.DS_Store$/,
        /Thumbs\.db$/,
        /\.git\//,
        /node_modules\//,
    ],
    extensions: [
        ".ts",
        ".js",
        ".tsx",
        ".jsx",
        ".json",
        ".env",
        ".yaml",
        ".yml",
    ],
    debounceMs: 50, // Reduced for better responsiveness
    restartDelay: 50, // Reduced for faster restarts
    maxRestarts: 7000, // Increased limit
    resetRestartsAfter: 300000, // Reset after 5 minutes
    gracefulShutdown: true,
    gracefulShutdownTimeout: 5000,
    verbose: false,
    usePolling: false,
    pollingInterval: 1000,
    followSymlinks: false,
    persistentWatching: true,
    batchChanges: true,
    batchTimeout: 100,
    enableFileHashing: true,
    clearScreen: true,
    showBanner: true,
    customIgnoreFile: ".watcherignore",
    watchDotFiles: false,
    maxFileSize: 20, // 20MB max file size
    excludeEmptyFiles: true,
    parallelProcessing: true,
    healthCheck: true,
    healthCheckInterval: 30000, // 30 seconds
    memoryLimit: 512, // 512MB

    // TypeScript checking configuration (enabled by default)
    typeCheck: {
        enabled: true, // Enable TypeScript checking by default
        checkOnSave: true, // Check types when files are saved
        checkBeforeRestart: true, // Check types before restarting server
        showWarnings: true, // Show TypeScript warnings
        showInfos: false, // Don't show info messages by default
        maxErrors: 20, // Limit error output to prevent overwhelming
        failOnError: false, // Don't prevent restart on errors (for development)
        includePatterns: ["**/*.ts", "**/*.tsx"], // TypeScript file patterns
        verbose: true, // Detailed TypeScript checking output
        excludePatterns: ["node_modules", "dist", "build", ".git"], // Additional patterns to exclude (beyond ignorePaths)
    },

    // TypeScript execution configuration (enabled by default)
    typescript: {
        enabled: true, // Auto-detect TypeScript files and use appropriate runner
        runner: "auto", // Auto-detect the best available TypeScript runner
        runnerArgs: [], // Additional arguments for the TypeScript runner
        fallbackToNode: true, // Fallback to node if TypeScript runner fails (with warning)
        autoDetectRunner: true, // Auto-detect available TypeScript runner
        enableRuntimeCompilation: true, // Enable runtime TypeScript compilation as ultimate fallback
        compilerOptions: {
            target: "ES2020",
            module: "CommonJS",
            moduleResolution: "node",
            allowSyntheticDefaultImports: true,
            esModuleInterop: true,
            skipLibCheck: true,
            strict: false, // Less strict for development
        },
    },
};

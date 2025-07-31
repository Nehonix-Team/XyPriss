export interface HotReloaderConfig {
    enabled: boolean;
    script: string;
    args: string[];
    env: Record<string, string | undefined>;
    cwd: string;
    restartDelay: number;
    maxRestarts: number;
    gracefulShutdownTimeout: number;
    verbose: boolean;

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

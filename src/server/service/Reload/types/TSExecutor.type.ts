export interface TypeScriptExecutorConfig {
    verbose?: boolean;
    tempDir?: string;
    compilerOptions?: any;
    timeout?: number;
    retryAttempts?: number;
    fallbackToNode?: boolean;
}

export interface ExecutionResult {
    success: boolean;
    runtime: string;
    args: string[];
    compiledPath?: string;
    error?: string;
    duration: number;
    method: "external-runner" | "runtime-compile" | "node-fallback";
}

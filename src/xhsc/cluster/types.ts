/**
 * XHSC Clustering Configuration
 * Defines options for the Rust-native orchestration system.
 */

export type OrchestrationMode = "xhsc" | "node" | "hybrid";

export interface XHSCHealthCheckConfig {
    intervalMs?: number;
    timeoutMs?: number;
    unhealthyThreshold?: number;
    healthyThreshold?: number;
}

export interface XHSCLoadBalancerConfig {
    strategy?: "round-robin" | "least-connections" | "ip-hash" | "random";
    stickySession?: boolean;
}

export interface XHSCOrchestrationConfig {
    /**
     * Enable the orchestration system.
     */
    enabled?: boolean;

    /**
     * The orchestration mode.
     * - `xhsc`: Rust manages the worker processes. High performance, native load balancing.
     * - `node`: Standard Node.js cluster module. Legacy behavior.
     * - `hybrid`: Experimental.
     */
    mode?: OrchestrationMode;

    /**
     * Number of worker processes to spawn.
     * Set to 'auto' to use the number of available CPU cores.
     */
    workers?: number | "auto";

    /**
     * XHSC-specific optimization settings.
     * Only applies when mode is 'xhsc'.
     */
    xhsc?: {
        /**
         * Use zero-copy networking where possible.
         */
        useZeroCopy?: boolean;

        /**
         * Load balancer configuration.
         */
        loadBalancer?: XHSCLoadBalancerConfig;

        /**
         * Health check configuration for worker processes.
         */
        healthCheck?: XHSCHealthCheckConfig;
    };
}


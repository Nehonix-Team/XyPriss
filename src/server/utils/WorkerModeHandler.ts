import { ServerOptions } from "../../types/types";
import { Logger } from "../../shared/logger/Logger";
import { getSysApi } from "../../plugins/const/getSysApi";

/**
 * Handle worker mode configuration automatically
 * This function makes clustering transparent to developers
 *
 * Issue #43: Access environment variables via getSysApi() to adhere to
 * the XyPriss zero-trust model and avoid process.env shield traps.
 */
export function handleWorkerMode(options: ServerOptions): ServerOptions {
    const sys = getSysApi();
    const env = sys?.__env__;

    // Check if running in worker mode
    const clusterMode = env?.get("XYPRISS_CLUSTER_MODE");
    if (clusterMode !== "true") {
        return options; // Not a worker, return original options
    }

    // Worker mode detected - merge configuration from environment
    let finalOptions = options;
    const serverConfigRaw = env?.get("XYPRISS_SERVER_CONFIG");

    if (serverConfigRaw) {
        try {
            const workerConfig = JSON.parse(serverConfigRaw);
            const workerPort = env?.get("WORKER_PORT") || env?.get("XYPRISS_WORKER_PORT");
            const workerId = env?.get("WORKER_ID") || env?.get("XYPRISS_WORKER_ID") || "unknown";
            const nodeEnv = env?.get("NODE_ENV");

            // Merge worker configuration with provided options
            // Worker-specific overrides take precedence
            finalOptions = {
                ...workerConfig,
                ...options,
                server: {
                    ...workerConfig.server,
                    ...options.server,
                    // Use worker-specific port if provided
                    port: workerPort
                        ? parseInt(workerPort)
                        : options.server?.port || workerConfig.server?.port,
                },
                // Disable clustering in worker processes to prevent recursive clustering
                cluster: {
                    ...workerConfig.cluster,
                    enabled: false,
                },
            };

            // Debug logging for development
            if (nodeEnv === "development") {
                const logger = Logger.getInstance();
                logger.info(
                    "cluster",
                    `Worker ${workerId} initialized with port ${finalOptions.server?.port}`,
                );
            }
        } catch (error) {
            const logger = Logger.getInstance();
            logger.error(
                "cluster",
                "Failed to parse worker configuration",
                error,
            );
            // Fall back to original options but disable clustering
            finalOptions = {
                ...options,
                cluster: { ...options.cluster, enabled: false },
            };
        }
    } else {
        // No worker config found, disable clustering to prevent issues
        finalOptions = {
            ...options,
            cluster: { ...options.cluster, enabled: false },
        };
    }

    return finalOptions;
}


import { ServerOptions } from "../../types/types";
import { Logger } from "../../../shared/logger/Logger";

/**
 * Handle worker mode configuration automatically
 * This function makes clustering transparent to developers
 */
export function handleWorkerMode(options: ServerOptions): ServerOptions {
    // Check if running in worker mode
    if (process.env.CLUSTER_MODE !== "true") {
        return options; // Not a worker, return original options
    }

    // Worker mode detected - merge configuration from environment
    let finalOptions = options;

    if (process.env.XYPRISS_SERVER_CONFIG) {
        try {
            const workerConfig = JSON.parse(process.env.XYPRISS_SERVER_CONFIG);

            // Merge worker configuration with provided options
            // Worker-specific overrides take precedence
            finalOptions = {
                ...workerConfig,
                ...options,
                server: {
                    ...workerConfig.server,
                    ...options.server,
                    // Use worker-specific port if provided
                    port: process.env.WORKER_PORT
                        ? parseInt(process.env.WORKER_PORT)
                        : options.server?.port || workerConfig.server?.port,
                },
                // Disable clustering in worker processes to prevent recursive clustering
                cluster: {
                    ...workerConfig.cluster,
                    enabled: false,
                },
            };

            // Debug logging for development
            if (process.env.NODE_ENV === "development") {
                const logger = Logger.getInstance();
                logger.info(
                    "cluster",
                    `Worker ${process.env.WORKER_ID} initialized with port ${finalOptions.server?.port}`
                );
            }
        } catch (error) {
            const logger = Logger.getInstance();
            logger.error(
                "cluster",
                "Failed to parse worker configuration",
                error
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


import { CompressionPlugin } from "../builtin/CompressionPlugin";
import { ConnectionPlugin } from "../builtin/ConnectionPlugin";
import {
    CompressionConfig,
    ConnectionConfig,
    NetworkCategory,
    NetworkPluginConfig,
} from "../types/NetworkTypes";

export const NetworkPluginUtils = {
    /**
     * Validate network plugin configuration
     */
    validateConfig: (pluginType: NetworkCategory, config: any): boolean => {
        switch (pluginType) {
            case NetworkCategory.CONNECTION:
                return (
                    new ConnectionPlugin().validateNetworkConfig?.(config) ??
                    true
                );
            case NetworkCategory.COMPRESSION:
                return (
                    new CompressionPlugin().validateNetworkConfig?.(config) ??
                    true
                );
            default:
                return true;
        }
    },

    /**
     * Get default configuration for a plugin type
     */
    getDefaultConfig: (pluginType: NetworkCategory): NetworkPluginConfig => {
        switch (pluginType) {
            case NetworkCategory.CONNECTION:
                return {
                    http2: { enabled: false, maxConcurrentStreams: 100 },
                    keepAlive: {
                        enabled: true,
                        timeout: 30000,
                        maxRequests: 1000,
                    },
                    connectionPool: { maxConnections: 1000, timeout: 5000 },
                    timeouts: {
                        connection: 10000,
                        request: 30000,
                        response: 30000,
                    },
                } as ConnectionConfig;
            case NetworkCategory.COMPRESSION:
                return {
                    enabled: true,
                    algorithms: ["gzip", "deflate"],
                    level: 6,
                    threshold: 1024,
                    contentTypes: [
                        "text/*",
                        "application/json",
                        "application/javascript",
                        "application/xml",
                    ],
                } as CompressionConfig;
            default:
                return {} as NetworkPluginConfig;
        }
    },
};


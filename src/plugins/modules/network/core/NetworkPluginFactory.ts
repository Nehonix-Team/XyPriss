import { CompressionPlugin } from "../builtin/CompressionPlugin";
import { ConnectionPlugin } from "../builtin/ConnectionPlugin";
import {
    CompressionConfig,
    ConnectionConfig,
    NetworkCategory,
} from "../types/NetworkTypes";


/**
 * Network plugin factory functions
 */
export const NetworkPluginFactory = {
    /**
     * Create a connection management plugin
     */
    createConnectionPlugin: (config?: ConnectionConfig) =>
        new ConnectionPlugin(config),

    /**
     * Create a compression plugin
     */
    createCompressionPlugin: (config?: CompressionConfig) =>
        new CompressionPlugin(config),

    /**
     * Get all available network plugin types
     */
    getAvailablePlugins: () => [
        {
            id: "xypriss::nehonix.network.connection",
            name: "Connection Management Plugin",
            category: NetworkCategory.CONNECTION,
            description: "HTTP/2, connection pooling, keep-alive management",
        },
        {
            id: "xypriss.network.compression",
            name: "Response Compression Plugin",
            category: NetworkCategory.COMPRESSION,
            description:
                "Gzip, Brotli, Deflate compression with smart optimization",
        },
        // More plugins will be added here as they're implemented
    ],
};



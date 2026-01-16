/**
 * XyPriss Server Configuration
 *
 * This module contains the complete server configuration for your XyPriss application.
 * All server settings, security options, performance tuning, and feature flags
 * are centralized here for easy management and maintenance.
 * You can also load this configuration from "xypriss.config.json" if you prefer to use JSON.
 *
 * @fileoverview Server configuration with comprehensive feature support
 * @version 1.1.2
 * @author XyPriss Team
 * @since 2025-01-01
 *
 * @example
 * ```typescript
 * import { serverConfig } from './configs/xypriss.config.js';
 * const app = createServer(serverConfig);
 * ```
 */

import { ServerOptions } from "../../../../src/index.ts";
import { serv_host } from "./host.conf.js";
import { plg } from "../../../pkg/src/index.ts";

/**
 * Main server configuration object
 * Comprehensive configuration with security, performance, and feature flags
 */
export const serverConfig: ServerOptions = {
    /**
     * Environment configuration
     * Controls application behavior based on deployment environment
     */
    env: __sys__.__env__ as any,
    plugins: {
        register: [plg() as any],
    },
};

/**
 * Export the configuration for use in other modules
 * This allows importing the config in server.ts and other files
 */
export default serverConfig;


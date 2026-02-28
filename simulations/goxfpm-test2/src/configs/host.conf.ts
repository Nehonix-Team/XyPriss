/**
 * Host Configuration for XyPriss Applications
 *
 * This module provides host configuration constants for XyPriss server applications.
 * It handles different environments (development vs production) and network configurations.
 *
 * @fileoverview Host configuration constants and utilities
 * @version 1.0.0
 * @author XyPriss Team
 * @since 2025-01-01
 */

/**
 * Default production host binding
 *
 * In production environments, servers should bind to all available network interfaces
 * (0.0.0.0) to accept connections from any network interface. This allows the server
 * to be accessible from external networks and load balancers.
 *
 * @example
 * ```typescript
 * // Server will accept connections on all interfaces
 * server.listen(3000, defaultHost);
 * ```
 */
export const defaultHost = "0.0.0.0";

/**
 * Development host configuration
 *
 * In development environments, binding to localhost (127.0.0.1) is preferred for security
 * and to avoid conflicts with other services. However, for testing on physical devices
 * or other machines on the same network, you may need to use your network IP address.
 *
 * To find your network IP address:
 * - Linux/Mac: Run `ifconfig` or `ip addr show`
 * - Windows: Run `ipconfig`
 * - Look for your wireless/local network adapter IP (usually 192.168.x.x or 10.x.x.x)
 *
 * @example
 * ```typescript
 * // For local development only
 * export const dev_host = "localhost";
 *
 * // For testing on physical devices (replace with your network IP)
 * export const dev_host = "192.168.1.100";
 * ```
 */
export const dev_host = "localhost";

/**
 * Dynamic host selection based on environment
 *
 * Automatically selects the appropriate host based on the NODE_ENV environment variable.
 * - Development: Uses localhost for security and isolation
 * - Production: Uses 0.0.0.0 to accept connections from all interfaces
 *
 * @example
 * ```bash
 * # Development (uses localhost)
 * NODE_ENV=development npm start
 *
 * # Production (uses 0.0.0.0)
 * NODE_ENV=production npm start
 * ```
 */
export const serv_host =
  process.env["NODE_ENV"] !== "production" ? dev_host : defaultHost;

/**
 * Default socket port for real-time communications
 *
 * This port is used for WebSocket connections and real-time features.
 * It should be different from the main HTTP server port to avoid conflicts.
 *
 * @example
 * ```typescript
 * import { socket_port } from './configs/host.conf';
 *
 * const io = require('socket.io')(socket_port);
 * ```
 */
export const socket_port = 7328;

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

import { ServerOptions } from "xypriss";
import { serv_host } from "./host.conf.js";

/**
 * Main server configuration object
 * Comprehensive configuration with security, performance, and feature flags
 */
export const serverConfig: ServerOptions = {
  /**
   * Environment configuration
   * Controls application behavior based on deployment environment
   */
  env: __sys__.__env__,

  /**
   * Server-specific settings
   * Network configuration and basic server options
   */
  server: {
    /** Server port - defaults to environment PORT or system default */
    port: __sys__.__port__,

    /** Server host - defaults to localhost for development */
    host: serv_host,

    /** Trust proxy settings for reverse proxy deployments */
    trustProxy: process.env.TRUST_PROXY === "true",

    /** Enable automatic JSON body parsing */
    autoParseJson: true,

    /** JSON payload size limit */
    jsonLimit: "10mb",

    /** URL-encoded payload size limit */
    urlEncodedLimit: "10mb",

    /** Service identification for optimization system */
    serviceName: __sys__.__name__,
    version: __sys__.__version__,

    /** Auto port switching for development */
    autoPortSwitch: {
      enabled: true,
      maxAttempts: 10,
      strategy: "increment",
    },
  },

  /**
   * Security configuration
   * Comprehensive security middleware and protection features
   */
  security: {
    /** Enable security middleware */
    enabled: true,

    /** Enable Helmet security headers */
    helmet: true,
  },

  /**
   * Performance optimization configuration
   * Advanced caching and optimization features
   */
  performance: {
    /** Enable performance optimizations */
    optimizationEnabled: true,

    /** Enable response compression */
    compression: true,
  },

  /**
   * Monitoring and logging
   * Application monitoring and observability
   */
  monitoring: {
    /** Enable monitoring system */
    enabled: true,

    /** Health check configuration */
    healthChecks: true,

    /** Metrics collection */
    metrics: true,

    /** Alert thresholds */
    alertThresholds: {
      memoryUsage: 80, // 80% memory usage
      errorRate: 5, // 5% error rate
      latency: 1000, // 1 second average latency
    },
  },

  /**
   * Cache configuration
   * Optimized caching settings for web applications
   */
  cache: {
    /** Enable caching for better performance */
    enabled: true,

    /** Use memory cache for development */
    strategy: "memory",

    /** Default TTL - 1 hour for web content */
    ttl: 3600,

    /** Maximum cache size */
    maxSize: 100 * 1024 * 1024, // 100MB
  },

  /**
   * Clustering configuration
   * Multi-process clustering for production scaling
   */
  cluster: {
    /** Enable clustering in production */
    enabled: __sys__.$isProduction(),

    /** Cluster configuration */
    config: {
      workers: "auto",
      autoRespawn: true,
    },
  },

  /**
   * Plugin system configuration
   * Extensible plugin architecture
   */
  plugins: {
    /** Route optimization plugin */
    routeOptimization: {
      enabled: true,
    },
  },

  /**
   * Request management configuration
   * Advanced request handling and network quality monitoring
   */
  requestManagement: {
    /** Network quality monitoring */
    networkQuality: {
      enabled: true,
    },

    /** Request timeout configuration */
    timeout: {
      enabled: true,
      defaultTimeout: 30000, // 30 seconds
    },
  },

  /**
   * File upload configuration
   * Note: This feature is available in XyPriss but configured separately
   * See fileUpload property in security configuration above
   */
  fileUpload: {
    /** Enable file uploads */
    enabled: true,

    /** Maximum file size */
    maxFileSize: 5 * 1024 * 1024, // 5MB

    /** Maximum files per request */
    maxFiles: 10,

    /** Storage type */
    storage: "memory",
  },

  /**
   * Multi-server configuration for running multiple server instances
   *
   * Allows you to run multiple server instances with different configurations,
   * ports, and route scopes from a single configuration. Useful for microservices,
   * API versioning, or separating concerns (e.g., API server vs admin server).
   *
   * @example
   * ```typescript
   * multiServer: {
   *   enabled: true,
   *   servers: [
   *     {
   *       id: "api-server",
   *       port: 3001,
   *       routePrefix: "/api/v1",
   *       allowedRoutes: ["/api/v1/*"],
   *       server: {
   *         host: "localhost",
   *         jsonLimit: "20mb"
   *       },
   *       performance: {
   *         compression: true,
   *         optimizationEnabled: true
   *       }
   *     },
   *     {
   *       id: "admin-server",
   *       port: 3002,
   *       routePrefix: "/admin",
   *       allowedRoutes: ["/admin/*"],
   *       security: {
   *         enabled: true,
   *         level: "maximum"
   *       },
   *       cache: {
   *         enabled: false // Disable caching for admin panel
   *       }
   *     },
   *     {
   *       id: "static-server",
   *       port: 3003,
   *       routePrefix: "/static",
   *       allowedRoutes: ["/static/*"],
   *       performance: {
   *         compression: true,
   *         staticRouteOptimization: true
   *       },
   *       fileUpload: {
   *         enabled: true,
   *         maxFileSize: 50 * 1024 * 1024, // 50MB for static assets
   *         storage: "disk",
   *         destination: "./public/uploads"
   *       }
   *     }
   *   ]
   * }
   * ```
   */
  multiServer: {
    /** Enable multi-server mode */
    enabled: false, // "enabled = true" will activate the multi server mode

    /** Array of server configurations */
    servers: [
      // Example server configurations (uncomment and modify as needed)
      {
        id: "api-server",
        port: 3001,
        routePrefix: "/api/v1",
        allowedRoutes: ["/api/v1/*"],
        server: {
          host: "localhost",
          jsonLimit: "20mb",
        },
      },
      {
        id: "admin-server",
        port: 3002,
        routePrefix: "/admin",
        allowedRoutes: ["/admin/*"],
      },
    ],
  },
};

/**
 * Export the configuration for use in other modules
 * This allows importing the config in server.ts and other files
 */
export default serverConfig;

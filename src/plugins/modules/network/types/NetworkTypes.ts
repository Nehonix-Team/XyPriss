/**
 * Network Plugin Types
 *
 * Type definitions for the XyPriss Network Plugin System
 * Provides interfaces and types for network-related plugins
 */

import {
    BasePlugin,
    PluginExecutionContext,
    PluginExecutionResult,
    PluginType
} from "../../types/PluginTypes";
  
/**
 * Network plugin execution context
 * Extends base context with network-specific data
 */
export interface NetworkExecutionContext extends PluginExecutionContext {
    // Connection information
    connection: {
        remoteAddress?: string;
        remotePort?: number;
        localAddress?: string;
        localPort?: number;
        encrypted: boolean;
        protocol: string; // 'http/1.1', 'http/2', 'http/3'
    };

    // Request timing
    timing: {
        startTime: number;
        dnsLookup?: number;
        tcpConnection?: number;
        tlsHandshake?: number;
        firstByte?: number;
    };

    // Network-specific metrics (extends base metrics)
    networkMetrics: {
        bytesReceived: number;
        bytesSent: number;
        compressionRatio?: number;
        cacheHit?: boolean;
    };
}

/**
 * Network plugin execution result
 * Extends base result with network-specific outcomes
 */
export interface NetworkExecutionResult extends PluginExecutionResult {
    // Network modifications
    modifications?: {
        headers?: Record<string, string>;
        statusCode?: number;
        body?: any;
        compressed?: boolean;
        cached?: boolean;
    };

    // Performance metrics
    networkMetrics?: {
        processingTime: number;
        memoryUsage: number;
        cpuUsage: number;
    };
}

/**
 * Base interface for all network plugins
 */
export interface NetworkPlugin extends BasePlugin {
    readonly type: PluginType.NETWORK;
    readonly networkCategory: NetworkCategory;

    // Network-specific execution
    executeNetwork(
        context: NetworkExecutionContext
    ): Promise<NetworkExecutionResult>;

    // Network plugin lifecycle
    onConnectionOpen?(context: NetworkExecutionContext): Promise<void>;
    onConnectionClose?(context: NetworkExecutionContext): Promise<void>;
    onRequestStart?(context: NetworkExecutionContext): Promise<void>;
    onRequestEnd?(context: NetworkExecutionContext): Promise<void>;

    // Configuration validation
    validateNetworkConfig?(config: any): boolean;

    // Health check
    checkNetworkHealth?(): Promise<NetworkHealthStatus>;
}

/**
 * Network plugin categories for organization
 */
export enum NetworkCategory {
    CONNECTION = "connection", // Connection management, HTTP/2, keep-alive
    PROXY = "proxy", // Reverse proxy, load balancing
    COMPRESSION = "compression", // Response compression
    RATE_LIMIT = "rate-limit", // Rate limiting, throttling
    CORS = "cors", // Cross-origin resource sharing
    SSL = "ssl", // TLS/SSL handling
    WEBSOCKET = "websocket", // WebSocket connections
    CACHE = "cache", // HTTP caching
    SECURITY = "security", // Network security, DDoS protection
}

/**
 * Network health status
 */
export interface NetworkHealthStatus {
    healthy: boolean;
    status: "healthy" | "degraded" | "unhealthy";
    metrics: {
        responseTime: number;
        errorRate: number;
        throughput: number;
        connections: number;
    };
    issues?: string[];
    lastCheck: Date;
}

/**
 * Connection management configuration
 */
export interface ConnectionConfig {
    http2?: {
        enabled: boolean;
        maxConcurrentStreams?: number;
        maxHeaderListSize?: number;
        initialWindowSize?: number;
    };
    keepAlive?: {
        enabled: boolean;
        timeout: number;
        maxRequests?: number;
        maxIdleTime?: number;
    };
    connectionPool?: {
        maxConnections: number;
        timeout: number;
        retryAttempts?: number;
    };
    timeouts?: {
        connection: number;
        request: number;
        response: number;
    };
}

/**
 * Proxy configuration
 */
export interface ProxyConfig {
    enabled: boolean;
    upstreams: UpstreamServer[];
    loadBalancing: LoadBalancingStrategy;
    healthCheck?: HealthCheckConfig;
    failover?: FailoverConfig;
    timeout?: number;
    retries?: number;
}

export interface UpstreamServer {
    host: string;
    port?: number;
    weight?: number;
    maxConnections?: number;
    healthCheck?: string;
    backup?: boolean;
}

export type LoadBalancingStrategy =
    | "round-robin"
    | "least-connections"
    | "ip-hash"
    | "weighted-round-robin"
    | "least-response-time";

export interface HealthCheckConfig {
    enabled: boolean;
    interval: number;
    timeout: number;
    path: string;
    expectedStatus?: number;
    expectedBody?: string;
}

export interface FailoverConfig {
    enabled: boolean;
    maxFailures: number;
    recoveryTime: number;
    circuitBreaker?: boolean;
}

/**
 * Compression configuration
 */
export interface CompressionConfig {
    enabled: boolean;
    algorithms: CompressionAlgorithm[];
    level: number;
    threshold: number;
    contentTypes: string[];
    excludeContentTypes?: string[];
    streaming?: boolean;
}

export type CompressionAlgorithm = "gzip" | "brotli" | "deflate";

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
    enabled: boolean;
    strategy: RateLimitStrategy;
    global?: RateLimitRule;
    perIP?: RateLimitRule;
    perUser?: RateLimitRule;
    perRoute?: Record<string, RateLimitRule>;
    redis?: RedisConfig;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}

export type RateLimitStrategy =
    | "fixed-window"
    | "sliding-window"
    | "token-bucket";

export interface RateLimitRule {
    requests: number;
    window: string; // "1s", "1m", "1h", "1d"
    burst?: number;
}

export interface RedisConfig {
    host: string;
    port: number;
    password?: string;
    db?: number;
    keyPrefix?: string;
}

/**
 * WebSocket configuration
 */
export interface WebSocketConfig {
    enabled: boolean;
    path?: string;
    maxConnections: number;
    pingInterval: number;
    pingTimeout: number;
    compression?: boolean;
    rooms?: {
        enabled: boolean;
        maxRooms: number;
        maxClientsPerRoom: number;
    };
    authentication?: {
        required: boolean;
        tokenValidation?: (token: string) => Promise<boolean>;
    };
}

/**
 * Network security configuration
 */
export interface NetworkSecurityConfig {
    enabled: boolean;
    ddosProtection?: {
        enabled: boolean;
        maxRequestsPerSecond: number;
        banDuration: number;
        whitelist?: string[];
    };
    ipFiltering?: {
        whitelist?: string[];
        blacklist?: string[];
        geoBlocking?: {
            enabled: boolean;
            allowedCountries?: string[];
            blockedCountries?: string[];
        };
    };
    requestValidation?: {
        maxBodySize: number;
        maxHeaderSize: number;
        maxUrlLength: number;
        allowedMethods: string[];
    };
}

/**
 * HTTP cache configuration
 */
export interface HTTPCacheConfig {
    enabled: boolean;
    etag?: {
        enabled: boolean;
        algorithm: "md5" | "sha1" | "sha256";
    };
    lastModified?: boolean;
    cacheControl?: {
        maxAge?: number;
        sMaxAge?: number;
        mustRevalidate?: boolean;
        noCache?: boolean;
        noStore?: boolean;
        public?: boolean;
        private?: boolean;
    };
    vary?: string[];
    conditionalRequests?: boolean;
}

/**
 * Network plugin configuration union type
 */
export type NetworkPluginConfig =
    | ConnectionConfig
    | ProxyConfig
    | CompressionConfig
    | RateLimitConfig
    | WebSocketConfig
    | NetworkSecurityConfig
    | HTTPCacheConfig;


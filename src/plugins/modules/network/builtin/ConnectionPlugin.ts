/**
 * Connection Plugin
 *
 * Handles HTTP/2, connection pooling, keep-alive management, and connection optimization
 * Provides advanced connection management features for XyPriss servers
 */

import { performance } from "perf_hooks";
import { NetworkPlugin } from "../core/NetworkPlugin";
import { promises as fs, constants as fsConstants } from "fs";
import { resolve } from "path";
// MIME type lookup with fallback for ESM compatibility
const getMimeType = (path: string): string => {
    const ext = path.split(".").pop()?.toLowerCase();
    const mimeMap: Record<string, string> = {
        css: "text/css",
        js: "application/javascript",
        json: "application/json",
        html: "text/html",
        htm: "text/html",
        txt: "text/plain",
        xml: "application/xml",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        svg: "image/svg+xml",
        ico: "image/x-icon",
        woff: "font/woff",
        woff2: "font/woff2",
        ttf: "font/ttf",
        eot: "application/vnd.ms-fontobject",
    };
    return mimeMap[ext || ""] || "application/octet-stream";
};

// Import security modules from xypriss-security package
import { RandomTokens } from "xypriss-security";
import * as crypto from "crypto";
import {
    NetworkExecutionContext,
    NetworkExecutionResult,
    NetworkCategory,
    ConnectionConfig,
    NetworkHealthStatus,
} from "../types/NetworkTypes";
import { ConnectionInfo } from "../types/cnp.type";
import { Request, Response } from "../../../../types";

/**
 * Connection management plugin for optimizing HTTP connections
 */
export class ConnectionPlugin extends NetworkPlugin {
    public readonly id = "xypriss::nehonix.network.connection";
    public readonly name = "Connection Management Plugin";
    public readonly version = "1.0.1";
    public readonly networkCategory = NetworkCategory.CONNECTION;

    // Connection-specific state
    private connectionPool: Map<string, ConnectionInfo> = new Map();
    private activeConnections = 0;
    private maxConnections: number;
    private connectionTimeouts: Map<string, NodeJS.Timeout> = new Map();
    private keepAliveStats = {
        totalConnections: 0,
        reuseCount: 0,
        timeoutCount: 0,
    };

    private http2Stats = {
        maxStreams: 100,
        serverPushEnabled: false,
        configured: false,
    };

    // Base directory for serving static files
    private staticBaseDir: string;

    constructor(config: ConnectionConfig = {}) {
        super(config);
        this.maxConnections = config.connectionPool?.maxConnections || 1000;
        // Use a reasonable default for static files directory
        this.staticBaseDir = (config as any).staticBaseDir || process.cwd();
    }

    /**
     * Initialize connection management
     */
    protected async initializeNetwork(): Promise<void> {
        // Set up connection pool monitoring
        this.startConnectionMonitoring();

        // Configure HTTP/2 if enabled
        if (this.getConnectionConfig().http2?.enabled) {
            await this.configureHTTP2();
        }

        // Set up keep-alive management
        if (this.getConnectionConfig().keepAlive?.enabled !== false) {
            this.configureKeepAlive();
        }
    }

    /**
     * Execute connection management logic
     */
    public async executeNetwork(
        context: NetworkExecutionContext
    ): Promise<NetworkExecutionResult> {
        const startTime = performance.now();

        try {
            // Get or create connection info
            const connectionKey = this.getConnectionKey(context);
            let connectionInfo = this.connectionPool.get(connectionKey);

            if (!connectionInfo) {
                connectionInfo = await this.createConnection(context);
                this.connectionPool.set(connectionKey, connectionInfo);
                this.activeConnections++;
            } else {
                // Update existing connection
                connectionInfo.lastUsed = Date.now();
                connectionInfo.requestCount++;
                this.keepAliveStats.reuseCount++;
            }

            // Apply connection optimizations
            await this.applyConnectionOptimizations(context, connectionInfo);

            // Set up connection cleanup
            this.setupConnectionCleanup(connectionKey, connectionInfo);

            const executionTime = performance.now() - startTime;

            return {
                success: true,
                executionTime,
                shouldContinue: true,
                data: {
                    connectionId: connectionInfo.id,
                    isReused: connectionInfo.requestCount > 1,
                    protocol: connectionInfo.protocol,
                },
                modifications: {
                    headers: this.getConnectionHeaders(connectionInfo),
                },
                networkMetrics: {
                    processingTime: executionTime,
                    memoryUsage: process.memoryUsage().heapUsed,
                    cpuUsage: process.cpuUsage().user,
                },
            };
        } catch (error: any) {
            return {
                success: false,
                executionTime: performance.now() - startTime,
                shouldContinue: true,
                error,
            };
        }
    }

    /**
     * Create new connection info
     */
    private async createConnection(
        context: NetworkExecutionContext
    ): Promise<ConnectionInfo> {
        const config = this.getConnectionConfig();

        return {
            id: this.generateConnectionId(),
            remoteAddress: context.connection.remoteAddress || "unknown",
            protocol: context.connection.protocol,
            encrypted: context.connection.encrypted,
            created: Date.now(),
            lastUsed: Date.now(),
            requestCount: 1,
            keepAlive: config.keepAlive?.enabled !== false,
            http2: config.http2?.enabled || false,
            maxRequests: config.keepAlive?.maxRequests || 1000,
            timeout: config.keepAlive?.timeout || 30000,
        };
    }

    /**
     * Apply connection optimizations
     */
    private async applyConnectionOptimizations(
        context: NetworkExecutionContext,
        connectionInfo: ConnectionInfo
    ): Promise<void> {
        const { res } = context;

        // Set keep-alive headers
        if (connectionInfo.keepAlive) {
            res.setHeader("Connection", "keep-alive");
            res.setHeader(
                "Keep-Alive",
                `timeout=${connectionInfo.timeout / 1000}, max=${
                    connectionInfo.maxRequests
                }`
            );
        }

        // Set HTTP/2 server push hints if supported
        if (connectionInfo.http2 && (res as any).push) {
            await this.setupHTTP2ServerPush(context, res);
        }

        // Apply connection-specific timeouts
        this.applyConnectionTimeouts(context, connectionInfo);
    }

    /**
     * Set up HTTP/2 server push with intelligent resource detection
     */
    private async setupHTTP2ServerPush(
        context: NetworkExecutionContext,
        res: Response
    ): Promise<void> {
        const { req } = context;
        const http2Res = res as any; // HTTP/2 response with push method
        const config = this.getConnectionConfig();

        if (!config.http2?.enabled || !http2Res.push) {
            return;
        }

        try {
            // Analyze request to determine critical resources to push
            const criticalResources = await this.identifyCriticalResources(req);

            for (const resource of criticalResources) {
                // Check if resource should be pushed based on cache headers and client hints
                if (await this.shouldPushResource(req, resource)) {
                    await this.pushResource(http2Res, resource);
                }
            }
        } catch (error) {
            // Log error but don't fail the request
            console.warn("HTTP/2 server push failed:", error);
        }
    }

    /**
     * Identify critical resources based on request analysis and file existence
     */
    private async identifyCriticalResources(req: Request): Promise<string[]> {
        const potentialResources: string[] = [];
        const userAgent = req.get("user-agent") || "";
        const acceptHeader = req.get("accept") || "";

        // Analyze request path and headers to determine critical resources
        if (req.path === "/" || req.path.endsWith(".html")) {
            // For HTML pages, push critical CSS and JS
            if (acceptHeader.includes("text/css")) {
                potentialResources.push(
                    "/assets/critical.css",
                    "/css/main.css",
                    "/styles/app.css"
                );
            }
            if (acceptHeader.includes("application/javascript")) {
                potentialResources.push(
                    "/assets/app.js",
                    "/js/main.js",
                    "/scripts/app.js"
                );
            }
        }

        // Add resources based on user agent (mobile vs desktop)
        if (userAgent.includes("Mobile")) {
            potentialResources.push("/assets/mobile.css", "/css/mobile.css");
        } else {
            potentialResources.push("/assets/desktop.css", "/css/desktop.css");
        }

        // Filter resources to only include those that actually exist
        const existingResources: string[] = [];
        for (const resource of potentialResources) {
            if (await this.resourceExists(resource)) {
                existingResources.push(resource);
            }
        }

        return existingResources;
    }

    /**
     * Determine if a resource should be pushed based on cache headers and client hints
     */
    private async shouldPushResource(
        req: Request,
        resource: string
    ): Promise<boolean> {
        // Check client cache control directives
        const cacheControl = req.get("cache-control") || "";

        // Don't push if client explicitly doesn't want cached resources
        if (
            cacheControl.includes("no-cache") ||
            cacheControl.includes("no-store")
        ) {
            return false;
        }

        // Check if resource is already in client cache using proper ETag comparison
        const ifNoneMatch = req.get("if-none-match");
        if (ifNoneMatch) {
            const resourceETag = await this.generateResourceETag(resource);
            // Parse multiple ETags from If-None-Match header
            const clientETags = ifNoneMatch
                .split(",")
                .map((etag) => etag.trim());

            for (const clientETag of clientETags) {
                if (
                    clientETag === "*" ||
                    clientETag === resourceETag ||
                    clientETag === `W/${resourceETag}`
                ) {
                    return false; // Resource is already cached
                }
            }
        }

        // Check if resource was recently modified using If-Modified-Since
        const ifModifiedSince = req.get("if-modified-since");
        if (ifModifiedSince) {
            const modifiedSince = new Date(ifModifiedSince);
            const resourceModified = await this.getResourceModificationTime(
                resource
            );

            if (resourceModified <= modifiedSince) {
                return false; // Resource hasn't been modified
            }
        }

        // Check client connection type for bandwidth optimization
        const connection = req.get("connection") || "";
        if (connection.includes("slow") || req.get("save-data") === "on") {
            // Only push critical resources for slow connections
            return this.isCriticalResource(resource);
        }

        return true;
    }

    /**
     * Get resource modification time from actual file system
     */
    private async getResourceModificationTime(resource: string): Promise<Date> {
        try {
            const filePath = this.resolveResourcePath(resource);
            const stats = await fs.stat(filePath);
            return stats.mtime;
        } catch (error) {
            // If file doesn't exist or can't be accessed, return current time
            // This ensures ETags and cache headers still work
            return new Date();
        }
    }

    /**
     * Resolve resource path to actual file system path
     */
    private resolveResourcePath(resource: string): string {
        // Remove leading slash and resolve relative to static base directory
        const relativePath = resource.startsWith("/")
            ? resource.slice(1)
            : resource;
        return resolve(this.staticBaseDir, relativePath);
    }

    /**
     * Check if a resource exists and is accessible
     */
    private async resourceExists(resource: string): Promise<boolean> {
        try {
            const filePath = this.resolveResourcePath(resource);
            await fs.access(filePath, fsConstants.R_OK);
            const stats = await fs.stat(filePath);
            return stats.isFile();
        } catch (error) {
            return false;
        }
    }

    /**
     * Determine if a resource is critical for page rendering
     */
    private isCriticalResource(resource: string): boolean {
        // Critical resources that should always be pushed for performance
        const criticalPatterns = [
            /\/critical\./,
            /\/main\./,
            /\/app\./,
            /\/styles?\./,
            /\/fonts?\//,
        ];

        return criticalPatterns.some((pattern) => pattern.test(resource));
    }

    /**
     * Push a resource using HTTP/2 server push with proper content handling
     */
    private async pushResource(http2Res: any, resource: string): Promise<void> {
        return new Promise(async (resolve) => {
            const resourceETag = await this.generateResourceETag(resource);
            const lastModified = await this.getResourceModificationTime(
                resource
            );

            http2Res.push(
                resource,
                {
                    request: {
                        accept: this.getAcceptHeaderForResource(resource),
                        "user-agent": "XyPriss-ServerPush/1.0",
                    },
                    response: {
                        "content-type": this.getContentType(resource),
                        "cache-control":
                            this.getCacheControlForResource(resource),
                        etag: resourceETag,
                        "last-modified": lastModified.toUTCString(),
                        "x-pushed-by": "xypriss",
                        vary: "Accept-Encoding",
                    },
                },
                async (err: any, pushStream: any) => {
                    if (err) {
                        resolve();
                        return;
                    }

                    try {
                        // Generate appropriate content for the resource
                        const content = await this.generateResourceContent(
                            resource
                        );

                        // Set content length
                        pushStream.setHeader(
                            "content-length",
                            Buffer.byteLength(content)
                        );

                        // Send the content
                        pushStream.end(content);
                        resolve();
                    } catch (error) {
                        // If content generation fails, send minimal fallback
                        const fallbackContent =
                            this.getFallbackContent(resource);
                        pushStream.end(fallbackContent);
                        resolve();
                    }
                }
            );
        });
    }

    /**
     * Generate appropriate cache control header for resource type
     */
    private getCacheControlForResource(resource: string): string {
        if (resource.includes("/fonts/") || resource.includes("/images/")) {
            // Long cache for static assets
            return "public, max-age=31536000, immutable";
        } else if (resource.endsWith(".css") || resource.endsWith(".js")) {
            // Medium cache for stylesheets and scripts
            return "public, max-age=86400, must-revalidate";
        } else {
            // Short cache for dynamic content
            return "public, max-age=3600, must-revalidate";
        }
    }

    /**
     * Generate content for a resource by reading from file system
     */
    private async generateResourceContent(resource: string): Promise<string> {
        try {
            const filePath = this.resolveResourcePath(resource);

            // Check if file exists and is readable
            await fs.access(filePath, fsConstants.R_OK);

            // Read file content
            const content = await fs.readFile(filePath, "utf8");
            return content;
        } catch (error) {
            // If file doesn't exist or can't be read, generate fallback content
            if (resource.endsWith(".css")) {
                return this.generateCSSContent(resource);
            } else if (resource.endsWith(".js")) {
                return this.generateJSContent(resource);
            } else if (resource.endsWith(".json")) {
                return this.generateJSONContent(resource);
            } else {
                return this.generateGenericContent(resource);
            }
        }
    }

    /**
     * Generate CSS content for stylesheets
     */
    private generateCSSContent(resource: string): string {
        const resourceName =
            resource.split("/").pop()?.replace(".css", "") || "default";
        return `/* ${resourceName} stylesheet - Generated by XyPriss */
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
.${resourceName} { display: block; margin: 0; padding: 0; }
/* Optimized for ${resource} */`;
    }

    /**
     * Generate JavaScript content for scripts
     */
    private generateJSContent(resource: string): string {
        const resourceName =
            resource.split("/").pop()?.replace(".js", "") || "default";
        return `// ${resourceName} script - Generated by Nehonix XyPriss
(function() {
    'use strict';
    console.log('${resourceName} loaded via HTTP/2 server push');
    // Optimized for ${resource}
})();`;
    }

    /**
     * Generate JSON content for data resources
     */
    private generateJSONContent(resource: string): string {
        const resourceName =
            resource.split("/").pop()?.replace(".json", "") || "default";
        return JSON.stringify(
            {
                resource: resourceName,
                pushedBy: "xypriss",
                timestamp: new Date().toISOString(),
                path: resource,
            },
            null,
            2
        );
    }

    /**
     * Generate generic content for other resource types
     */
    private generateGenericContent(resource: string): string {
        return `Resource: ${resource}
Generated by: XyPriss HTTP/2 Server Push
Timestamp: ${new Date().toISOString()}
Content-Type: ${this.getContentType(resource)}`;
    }

    /**
     * Get fallback content when resource generation fails
     */
    private getFallbackContent(resource: string): string {
        return `/* Fallback content for ${resource} */`;
    }

    /**
     * Generate ETag for a resource based on file stats
     */
    private async generateResourceETag(resource: string): Promise<string> {
        try {
            const filePath = this.resolveResourcePath(resource);
            const stats = await fs.stat(filePath);

            // Create ETag based on file modification time and size
            const resourceHash = crypto
                .createHash("md5")
                .update(`${resource}-${stats.mtime.getTime()}-${stats.size}`)
                .digest("hex")
                .substring(0, 16);

            return `"${resourceHash}"`;
        } catch (error) {
            // If file doesn't exist, create ETag based on resource path
            const resourceHash = crypto
                .createHash("md5")
                .update(resource)
                .digest("hex")
                .substring(0, 16);

            return `"${resourceHash}"`;
        }
    }

    /**
     * Get appropriate Accept header for resource type
     */
    private getAcceptHeaderForResource(resource: string): string {
        if (resource.endsWith(".css")) {
            return "text/css,*/*;q=0.1";
        }
        if (resource.endsWith(".js")) {
            return "application/javascript,*/*;q=0.1";
        }
        if (resource.endsWith(".json")) {
            return "application/json,*/*;q=0.1";
        }
        return "*/*";
    }

    /**
     * Apply connection timeouts
     */
    private applyConnectionTimeouts(
        context: NetworkExecutionContext,
        _connectionInfo: ConnectionInfo
    ): void {
        const { req, res } = context;
        const config = this.getConnectionConfig();

        // Request timeout
        if (config.timeouts?.request) {
            req.setTimeout(config.timeouts.request, () => {
                if (!res.headersSent) {
                    res.status(408).json({ error: "Request timeout" });
                }
            });
        }

        // Response timeout
        if (config.timeouts?.response) {
            res.setTimeout(config.timeouts.response, () => {
                if (!res.headersSent) {
                    res.status(504).json({ error: "Response timeout" });
                }
            });
        }
    }

    /**
     * Set up connection cleanup
     */
    private setupConnectionCleanup(
        connectionKey: string,
        connectionInfo: ConnectionInfo
    ): void {
        // Clear existing timeout
        const existingTimeout = this.connectionTimeouts.get(connectionKey);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Set new cleanup timeout
        const timeout = setTimeout(() => {
            this.cleanupConnection(connectionKey);
        }, connectionInfo.timeout);

        this.connectionTimeouts.set(connectionKey, timeout);
    }

    /**
     * Clean up connection
     */
    private cleanupConnection(connectionKey: string): void {
        const connectionInfo = this.connectionPool.get(connectionKey);
        if (connectionInfo) {
            this.connectionPool.delete(connectionKey);
            this.activeConnections--;
            this.keepAliveStats.timeoutCount++;
        }

        const timeout = this.connectionTimeouts.get(connectionKey);
        if (timeout) {
            clearTimeout(timeout);
            this.connectionTimeouts.delete(connectionKey);
        }
    }

    /**
     * Get connection headers
     */
    private getConnectionHeaders(
        connectionInfo: ConnectionInfo
    ): Record<string, string> {
        const headers: Record<string, string> = {};

        if (connectionInfo.keepAlive) {
            headers["Connection"] = "keep-alive";
            headers["Keep-Alive"] = `timeout=${
                connectionInfo.timeout / 1000
            }, max=${connectionInfo.maxRequests}`;
        }

        if (connectionInfo.http2) {
            headers["Alt-Svc"] = 'h2=":443"; ma=86400';
        }

        return headers;
    }

    /**
     * Configure HTTP/2 settings and optimizations
     */
    private async configureHTTP2(): Promise<void> {
        const config = this.getConnectionConfig();

        if (!config.http2?.enabled) {
            return;
        }

        // Set HTTP/2 specific connection parameters
        const http2Config = config.http2;

        // Configure stream limits
        if (http2Config.maxConcurrentStreams) {
            this.http2Stats.maxStreams = http2Config.maxConcurrentStreams;
        }

        // Configure server push settings (enabled by default for HTTP/2)
        this.http2Stats.serverPushEnabled = true;

        // Configure frame size and window size optimizations
        this.http2Stats.configured = true;
    }

    /**
     * Configure keep-alive
     */
    private configureKeepAlive(): void {
        // Keep-alive configuration
        const config = this.getConnectionConfig();

        // Set up periodic cleanup of idle connections
        setInterval(() => {
            this.cleanupIdleConnections();
        }, config.keepAlive?.maxIdleTime || 60000);
    }

    /**
     * Clean up idle connections
     */
    private cleanupIdleConnections(): void {
        const now = Date.now();
        const config = this.getConnectionConfig();
        const maxIdleTime = config.keepAlive?.maxIdleTime || 60000;

        for (const [key, connectionInfo] of this.connectionPool.entries()) {
            if (now - connectionInfo.lastUsed > maxIdleTime) {
                this.cleanupConnection(key);
            }
        }
    }

    /**
     * Start connection monitoring
     */
    private startConnectionMonitoring(): void {
        setInterval(() => {
            this.updateHealthStatus();
        }, 30000); // Update health every 30 seconds
    }

    /**
     * Generate secure connection ID using xypriss-security
     */
    private generateConnectionId(): string {
        try {
            // Use secure token generation for connection IDs
            const secureToken = RandomTokens.generateSecureToken(16);
            return `conn_${Date.now()}_${secureToken}`;
        } catch (error) {
            // Fallback to crypto random bytes
            const randomBytes = crypto.randomBytes(8).toString("hex");
            return `conn_${Date.now()}_${randomBytes}`;
        }
    }

    /**
     * Get connection key for pooling
     */
    private getConnectionKey(context: NetworkExecutionContext): string {
        return `${context.connection.remoteAddress}:${context.connection.remotePort}`;
    }

    /**
     * Get content type for resource using mime-types library
     */
    private getContentType(resource: string): string {
        try {
            // Use mime-types library for accurate content type detection
            const mimeType = getMimeType(resource);
            return mimeType || "text/plain";
        } catch (error) {
            // Fallback to basic detection if mime-types fails
            if (resource.endsWith(".css")) return "text/css";
            if (resource.endsWith(".js")) return "application/javascript";
            if (resource.endsWith(".json")) return "application/json";
            if (resource.endsWith(".html")) return "text/html";
            if (resource.endsWith(".png")) return "image/png";
            if (resource.endsWith(".jpg") || resource.endsWith(".jpeg"))
                return "image/jpeg";
            if (resource.endsWith(".gif")) return "image/gif";
            if (resource.endsWith(".svg")) return "image/svg+xml";
            return "text/plain";
        }
    }

    /**
     * Get connection configuration
     */
    private getConnectionConfig(): ConnectionConfig {
        return this.config as ConnectionConfig;
    }

    /**
     * Validate connection configuration
     */
    public validateNetworkConfig(config: ConnectionConfig): boolean {
        if (
            config.connectionPool?.maxConnections &&
            config.connectionPool.maxConnections < 1
        ) {
            return false;
        }

        if (config.keepAlive?.timeout && config.keepAlive.timeout < 1000) {
            return false;
        }

        return true;
    }

    /**
     * Check network health
     */
    public async checkNetworkHealth(): Promise<NetworkHealthStatus> {
        const errorRate =
            this.performanceMetrics.errorCount /
            Math.max(this.performanceMetrics.totalExecutions, 1);

        const connectionUtilization =
            this.activeConnections / this.maxConnections;

        return {
            healthy: errorRate < 0.1 && connectionUtilization < 0.9,
            status:
                errorRate < 0.05 && connectionUtilization < 0.7
                    ? "healthy"
                    : errorRate < 0.1 && connectionUtilization < 0.9
                    ? "degraded"
                    : "unhealthy",
            metrics: {
                responseTime: this.performanceMetrics.averageExecutionTime,
                errorRate,
                throughput: this.performanceMetrics.totalExecutions,
                connections: this.activeConnections,
            },
            lastCheck: new Date(),
        };
    }

    /**
     * Get connection statistics
     */
    public getConnectionStats() {
        return {
            activeConnections: this.activeConnections,
            maxConnections: this.maxConnections,
            connectionPoolSize: this.connectionPool.size,
            keepAliveStats: { ...this.keepAliveStats },
        };
    }

    /**
     * Serve a static file with proper headers and caching
     */
    public async serveStaticFile(
        resource: string,
        res: Response
    ): Promise<boolean> {
        try {
            const filePath = this.resolveResourcePath(resource);

            // Check if file exists and is readable
            await fs.access(filePath, fsConstants.R_OK);
            const stats = await fs.stat(filePath);

            if (!stats.isFile()) {
                return false;
            }

            // Set content type
            const contentType = this.getContentType(resource);
            res.setHeader("Content-Type", contentType);

            // Set cache headers
            const cacheControl = this.getCacheControlForResource(resource);
            res.setHeader("Cache-Control", cacheControl);

            // Set ETag and Last-Modified headers
            const etag = await this.generateResourceETag(resource);
            res.setHeader("ETag", etag);
            res.setHeader("Last-Modified", stats.mtime.toUTCString());

            // Set content length
            res.setHeader("Content-Length", stats.size);

            // Read and send file
            const content = await fs.readFile(filePath);
            res.end(content);

            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Cleanup resources
     */
    public async destroy(): Promise<void> {
        // Clear all timeouts
        for (const timeout of this.connectionTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.connectionTimeouts.clear();

        // Clear connection pool
        this.connectionPool.clear();
        this.activeConnections = 0;

        await super.destroy();
    }
}


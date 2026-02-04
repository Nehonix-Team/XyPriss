/**
 * Proxy Plugin
 *
 * Handles reverse proxy functionality with load balancing, health checks, and failover
 * Uses http-proxy-middleware for reliable proxy operations
 */
 
import { performance } from "perf_hooks";
import { createProxyMiddleware, Options } from "http-proxy-middleware";
import { NetworkPlugin } from "../core/NetworkPlugin";

// Import security modules from xypriss-security package
import { Hash } from "xypriss-security";
import {
    NetworkExecutionContext,
    NetworkExecutionResult,
    NetworkCategory, 
    ProxyConfig, 
    UpstreamServer,
    LoadBalancingStrategy,
    NetworkHealthStatus,
} from "../types/NetworkTypes";
import { Request, Response } from "../../../../types";
import http from "http";

/**
 * Reverse proxy plugin with load balancing and health checks
 */
export class ProxyPlugin extends NetworkPlugin {
    public readonly id = "xypriss::nehonix.network.proxy";
    public readonly name = "Reverse Proxy Plugin";
    public readonly version = "1.0.1";
    public readonly networkCategory = NetworkCategory.PROXY;

    // Proxy-specific state
    private upstreamServers: UpstreamServer[] = [];
    private proxyMiddleware: any;
    private currentUpstreamIndex = 0;
    private upstreamHealth = new Map<string, boolean>();
    private proxyStats = {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        upstreamUsage: new Map<string, number>(),
        averageResponseTime: 0,
        totalResponseTime: 0,
    };

    constructor(
        config: ProxyConfig = {
            enabled: true,
            upstreams: [],
            loadBalancing: "round-robin",
            timeout: 30000,
            retries: 3,
        }
    ) {
        super(config);
        this.initializeUpstreams();
        this.createProxyMiddleware();
    }

    /**
     * Initialize upstream servers
     */
    private initializeUpstreams(): void {
        const config = this.getProxyConfig();
        this.upstreamServers = config.upstreams || [];

        // Initialize health status for all upstreams
        this.upstreamServers.forEach((upstream) => {
            const key = `${upstream.host}:${upstream.port || 80}`;
            this.upstreamHealth.set(key, true); // Assume healthy initially
            this.proxyStats.upstreamUsage.set(key, 0);
        });

        // Start health checks if enabled
        if (config.healthCheck?.enabled) {
            this.startHealthChecks();
        }
    }

    /**
     * Create proxy middleware
     */
    private createProxyMiddleware(): void {
        const config = this.getProxyConfig();

        if (!config.enabled || this.upstreamServers.length === 0) {
            return;
        }

        const proxyOptions: Options = {
            target: this.getNextUpstream(), // Initial target
            changeOrigin: true,
            timeout: config.timeout || 30000,
            proxyTimeout: config.timeout || 30000,

            // Dynamic target selection for load balancing
            router: (req: any) => {
                const upstream = this.selectUpstream(req as Request);
                return upstream
                    ? `http://${upstream.host}:${upstream.port || 80}`
                    : undefined;
            },

            // Request/response logging
            onProxyReq: (proxyReq: any, req: any, res: any) => {
                this.onProxyRequest(proxyReq, req as Request, res as Response);
            },

            onProxyRes: (proxyRes: any, req: any, res: any) => {
                this.onProxyResponse(proxyRes, req as Request, res as Response);
            },
        } as any; // Type assertion to handle middleware compatibility

        this.proxyMiddleware = createProxyMiddleware(proxyOptions);
    }

    /**
     * Execute proxy logic
     */
    public async executeNetwork(
        context: NetworkExecutionContext
    ): Promise<NetworkExecutionResult> {
        const startTime = performance.now();
        const { req, res } = context;

        try {
            if (
                !this.getProxyConfig().enabled ||
                this.upstreamServers.length === 0
            ) {
                return {
                    success: true,
                    executionTime: performance.now() - startTime,
                    shouldContinue: true,
                    data: {
                        proxied: false,
                        reason: "proxy_disabled_or_no_upstreams",
                    },
                };
            }

            // Apply proxy middleware
            await new Promise<void>((resolve, reject) => {
                this.proxyMiddleware(req, res, (err: any) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Update statistics
            this.proxyStats.totalRequests++;
            this.proxyStats.successfulRequests++;

            const executionTime = performance.now() - startTime;
            this.proxyStats.totalResponseTime += executionTime;
            this.proxyStats.averageResponseTime =
                this.proxyStats.totalResponseTime /
                this.proxyStats.totalRequests;

            return {
                success: true,
                executionTime,
                shouldContinue: true,
                data: {
                    proxied: true,
                    upstream: this.getLastUsedUpstream(),
                    responseTime: executionTime,
                },
                networkMetrics: {
                    processingTime: executionTime,
                    memoryUsage: process.memoryUsage().heapUsed,
                    cpuUsage: process.cpuUsage().user,
                },
            };
        } catch (error: any) {
            this.proxyStats.totalRequests++;
            this.proxyStats.failedRequests++;

            return {
                success: false,
                executionTime: performance.now() - startTime,
                shouldContinue: true,
                error,
            };
        }
    }

    /**
     * Select upstream server based on load balancing strategy
     */
    private selectUpstream(req: Request): UpstreamServer | null {
        const config = this.getProxyConfig();
        const healthyUpstreams = this.upstreamServers.filter((upstream) => {
            const key = `${upstream.host}:${upstream.port || 80}`;
            return this.upstreamHealth.get(key) !== false;
        });

        if (healthyUpstreams.length === 0) {
            return null;
        }

        switch (config.loadBalancing) {
            case "round-robin":
                return this.roundRobinSelection(healthyUpstreams);
            case "least-connections":
                return this.leastConnectionsSelection(healthyUpstreams);
            case "ip-hash":
                return this.ipHashSelection(healthyUpstreams, req);
            case "weighted-round-robin":
                return this.weightedRoundRobinSelection(healthyUpstreams);
            default:
                return healthyUpstreams[0];
        }
    }

    /**
     * Round-robin load balancing
     */
    private roundRobinSelection(upstreams: UpstreamServer[]): UpstreamServer {
        const upstream =
            upstreams[this.currentUpstreamIndex % upstreams.length];
        this.currentUpstreamIndex++;
        return upstream;
    }

    /**
     * Least connections load balancing
     */
    private leastConnectionsSelection(
        upstreams: UpstreamServer[]
    ): UpstreamServer {
        return upstreams.reduce((least, current) => {
            const leastKey = `${least.host}:${least.port || 80}`;
            const currentKey = `${current.host}:${current.port || 80}`;
            const leastUsage = this.proxyStats.upstreamUsage.get(leastKey) || 0;
            const currentUsage =
                this.proxyStats.upstreamUsage.get(currentKey) || 0;
            return currentUsage < leastUsage ? current : least;
        });
    }

    /**
     * IP hash load balancing
     */
    private ipHashSelection(
        upstreams: UpstreamServer[],
        req: Request
    ): UpstreamServer {
        const clientIP = req.ip || req.socket.remoteAddress || "";
        const hash = this.hash(clientIP);
        const index = hash % upstreams.length;
        return upstreams[index];
    }

    /**
     * Weighted round-robin load balancing
     */
    private weightedRoundRobinSelection(
        upstreams: UpstreamServer[]
    ): UpstreamServer {
        const totalWeight = upstreams.reduce(
            (sum, upstream) => sum + (upstream.weight || 1),
            0
        );
        let randomWeight = Math.random() * totalWeight;

        for (const upstream of upstreams) {
            randomWeight -= upstream.weight || 1;
            if (randomWeight <= 0) {
                return upstream;
            }
        }

        return upstreams[0]; // Fallback
    }

    /**
     * Secure hash function for IP-based load balancing using crypto module
     */
    private hash(str: string): number {
        // Use secure SHA-256 hash for consistent load balancing
        const hash = Hash.create(str, {
            algorithm: "sha256",
            outputFormat: "hex",
        }) as string;
        return parseInt(hash.substring(0, 8), 16);
    }

    /**
     * Get next upstream for initial target
     */
    private getNextUpstream(): string {
        if (this.upstreamServers.length === 0) {
            return "http://localhost:3000"; // Fallback
        }
        const upstream = this.upstreamServers[0];
        return `http://${upstream.host}:${upstream.port || 80}`;
    }

    /**
     * Get last used upstream for reporting
     */
    private getLastUsedUpstream(): string {
        const index =
            (this.currentUpstreamIndex - 1) % this.upstreamServers.length;
        const upstream = this.upstreamServers[index] || this.upstreamServers[0];
        return `${upstream.host}:${upstream.port || 80}`;
    }

    /**
     * Handle proxy request
     */
    private onProxyRequest(proxyReq: any, req: Request, res: Response): void {
        // Add custom headers or modify request if needed
        proxyReq.setHeader("X-Forwarded-By", "XyPriss-Proxy");
        proxyReq.setHeader(
            "X-Request-ID",
            `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        );
    }

    /**
     * Handle proxy response
     */
    private onProxyResponse(proxyRes: any, req: Request, res: Response): void {
        // Update upstream usage statistics
        const upstream = this.getLastUsedUpstream();
        const currentUsage = this.proxyStats.upstreamUsage.get(upstream) || 0;
        this.proxyStats.upstreamUsage.set(upstream, currentUsage + 1);

        // Add response headers
        res.setHeader("X-Proxied-By", "XyPriss");
        res.setHeader("X-Upstream", upstream);
    }

    /**
     * Start health checks for upstream servers
     */
    private startHealthChecks(): void {
        const config = this.getProxyConfig();
        if (!config.healthCheck?.enabled) return;

        setInterval(() => {
            this.performHealthChecks();
        }, config.healthCheck.interval || 30000);
    }

    /**
     * Perform health checks on all upstream servers
     */
    private async performHealthChecks(): Promise<void> {
        const config = this.getProxyConfig();
        const healthCheckPath = config.healthCheck?.path || "/health";
        const timeout = config.healthCheck?.timeout || 5000;

        for (const upstream of this.upstreamServers) {
            const key = `${upstream.host}:${upstream.port || 80}`;
            try {
                // Perform HTTP health check
                const isHealthy = await this.checkUpstreamHealth(
                    upstream,
                    healthCheckPath,
                    timeout
                );
                this.upstreamHealth.set(key, isHealthy);
            } catch (error) {
                this.upstreamHealth.set(key, false);
            }
        }
    }

    /**
     * Check individual upstream health
     */
    private async checkUpstreamHealth(
        upstream: UpstreamServer,
        path: string,
        timeout: number
    ): Promise<boolean> {
        return new Promise((resolve) => {
            // const http = require("http");
            const timer = setTimeout(() => {
                resolve(false);
            }, timeout);

            const options = {
                hostname: upstream.host,
                port: upstream.port || 80,
                path: path,
                method: "GET",
                timeout: timeout,
                headers: {
                    "User-Agent": "XyPriss-HealthCheck/1.0",
                    Accept: "application/json, text/plain, */*",
                },
            };

            const req = http.request(options, (res: any) => {
                clearTimeout(timer);
                // Consider 2xx and 3xx status codes as healthy
                const isHealthy = res.statusCode >= 200 && res.statusCode < 400;
                resolve(isHealthy);

                // Consume response data to free up memory
                res.on("data", () => {});
                res.on("end", () => {});
            });

            req.on("error", () => {
                clearTimeout(timer);
                resolve(false);
            });

            req.on("timeout", () => {
                clearTimeout(timer);
                req.destroy();
                resolve(false);
            });

            req.end();
        });
    }

    /**
     * Get proxy configuration
     */
    private getProxyConfig(): ProxyConfig {
        return this.config as ProxyConfig;
    }

    /**
     * Validate proxy configuration
     */
    public validateNetworkConfig(config: ProxyConfig): boolean {
        // If plugin is disabled, allow empty upstreams
        if (!config.enabled) {
            return true;
        }

        // For enabled plugins, require at least one upstream
        if (!config.upstreams || config.upstreams.length === 0) {
            return false;
        }

        // Validate each upstream
        for (const upstream of config.upstreams) {
            if (!upstream.host) {
                return false;
            }
        }

        return true;
    }

    /**
     * Check network health
     */
    public async checkNetworkHealth(): Promise<NetworkHealthStatus> {
        const errorRate =
            this.proxyStats.failedRequests /
            Math.max(this.proxyStats.totalRequests, 1);

        const healthyUpstreams = Array.from(
            this.upstreamHealth.values()
        ).filter(Boolean).length;
        const totalUpstreams = this.upstreamServers.length;
        const upstreamHealthRatio =
            totalUpstreams > 0 ? healthyUpstreams / totalUpstreams : 1;

        return {
            healthy: errorRate < 0.1 && upstreamHealthRatio > 0.5,
            status:
                errorRate < 0.05 && upstreamHealthRatio > 0.8
                    ? "healthy"
                    : errorRate < 0.1 && upstreamHealthRatio > 0.5
                    ? "degraded"
                    : "unhealthy",
            metrics: {
                responseTime: this.proxyStats.averageResponseTime,
                errorRate,
                throughput: this.proxyStats.totalRequests,
                connections: healthyUpstreams,
            },
            lastCheck: new Date(),
        };
    }

    /**
     * Get proxy statistics
     */
    public getProxyStats() {
        return {
            ...this.proxyStats,
            upstreamHealth: Object.fromEntries(this.upstreamHealth),
            totalUpstreams: this.upstreamServers.length,
            healthyUpstreams: Array.from(this.upstreamHealth.values()).filter(
                Boolean
            ).length,
        };
    }
}


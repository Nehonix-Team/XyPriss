/**
 * Compression Plugin
 *
 * Handles response compression with multiple algorithms (Gzip, Brotli, Deflate)
 * Provides smart compression based on content type and size optimization
 */

import { performance } from "perf_hooks"; 
import * as zlib from "zlib";
import compression from "compression";
import { NetworkPlugin } from "../core/NetworkPlugin";
import { 
    NetworkExecutionContext,
    NetworkExecutionResult,
    NetworkCategory,
    CompressionConfig, 
    CompressionAlgorithm,
    NetworkHealthStatus,
} from "../types/NetworkTypes";
import { Request, Response } from "../../../../types";

/**
 * Response compression plugin for optimizing bandwidth usage
 */
export class CompressionPlugin extends NetworkPlugin {
    public readonly id = "xypriss.network.compression";
    public readonly name = "Response Compression Plugin";
    public readonly version = "1.0.0";
    public readonly networkCategory = NetworkCategory.COMPRESSION;

    // Compression-specific state
    private compressionStats = {
        totalRequests: 0,
        compressedRequests: 0,
        totalBytesOriginal: 0,
        totalBytesCompressed: 0,
        averageCompressionRatio: 0,
        algorithmUsage: new Map<CompressionAlgorithm, number>(),
    };

    private supportedAlgorithms: CompressionAlgorithm[] = [];
    private compressionMiddleware: any;

    constructor(
        config: CompressionConfig = {
            enabled: true,
            algorithms: ["gzip", "deflate"],
            level: 6,
            threshold: 1024,
            contentTypes: ["text/*", "application/json"],
        }
    ) {
        super(config);
        this.initializeSupportedAlgorithms();
        this.createCompressionMiddleware();
    }

    /**
     * Initialize compression algorithms based on availability
     */
    private initializeSupportedAlgorithms(): void {
        const config = this.getCompressionConfig();
        const requestedAlgorithms = config.algorithms || ["gzip", "deflate"];

        // Check which algorithms are available
        for (const algorithm of requestedAlgorithms) {
            if (this.isAlgorithmSupported(algorithm)) {
                this.supportedAlgorithms.push(algorithm);
                this.compressionStats.algorithmUsage.set(algorithm, 0);
            }
        }

        // Ensure at least gzip is available as fallback
        if (this.supportedAlgorithms.length === 0) {
            this.supportedAlgorithms.push("gzip");
            this.compressionStats.algorithmUsage.set("gzip", 0);
        }
    }

    /**
     * Create compression middleware using the compression library
     */
    private createCompressionMiddleware(): void {
        const config = this.getCompressionConfig();

        this.compressionMiddleware = compression({
            level: config.level || 6,
            threshold: config.threshold || 1024,
            filter: (req: any, res: any) => {
                // Use our custom filter logic
                return this.shouldCompress(req, res);
            },
        });
    }

    /**
     * Check if compression algorithm is supported
     */
    private isAlgorithmSupported(algorithm: CompressionAlgorithm): boolean {
        switch (algorithm) {
            case "gzip":
            case "deflate":
                return true; // Always available in Node.js
            case "brotli":
                return typeof zlib.createBrotliCompress === "function";
            default:
                return false;
        }
    }

    /**
     * Execute compression logic
     */
    public async executeNetwork(
        context: NetworkExecutionContext
    ): Promise<NetworkExecutionResult> {
        const startTime = performance.now();
        const { req, res } = context;

        try {
            // Apply compression using the middleware
            await new Promise<void>((resolve, reject) => {
                this.compressionMiddleware(req, res, (err: any) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Update statistics
            this.compressionStats.totalRequests++;
            const wasCompressed = !!res.getHeader("content-encoding");
            if (wasCompressed) {
                this.compressionStats.compressedRequests++;
                const algorithm = res.getHeader("content-encoding") as string;
                const currentUsage =
                    this.compressionStats.algorithmUsage.get(
                        algorithm as CompressionAlgorithm
                    ) || 0;
                this.compressionStats.algorithmUsage.set(
                    algorithm as CompressionAlgorithm,
                    currentUsage + 1
                );
            }

            const executionTime = performance.now() - startTime;

            return {
                success: true,
                executionTime,
                shouldContinue: true,
                data: {
                    compressed: wasCompressed,
                    algorithm:
                        (res.getHeader("content-encoding") as string) || "none",
                    originalSize: context.networkMetrics.bytesReceived,
                    compressedSize: context.networkMetrics.bytesSent,
                },
                modifications: wasCompressed
                    ? {
                          headers: {
                              "Content-Encoding": res.getHeader(
                                  "content-encoding"
                              ) as string,
                              Vary: "Accept-Encoding",
                          },
                          compressed: true,
                      }
                    : undefined,
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
     * Check if response should be compressed
     */
    private shouldCompress(req: Request, res: Response): boolean {
        const config = this.getCompressionConfig();

        // Check if compression is enabled
        if (!config.enabled) {
            return false;
        }

        // Check if client accepts compression
        const acceptEncoding = req.get("Accept-Encoding") || "";
        if (!this.clientSupportsCompression(acceptEncoding)) {
            return false;
        }

        // Check content type
        const contentType = String(res.get("Content-Type") || "");
        if (!this.shouldCompressContentType(contentType)) {
            return false;
        }

        // Check if already compressed
        if (res.get("Content-Encoding")) {
            return false;
        }

        // Check content length threshold
        const contentLength = parseInt(String(res.get("Content-Length") || "0"));
        if (contentLength > 0 && contentLength < (config.threshold || 1024)) {
            return false;
        }

        return true;
    }

    /**
     * Check if client supports compression
     */
    private clientSupportsCompression(acceptEncoding: string): boolean {
        return this.supportedAlgorithms.some((algorithm) =>
            acceptEncoding.toLowerCase().includes(algorithm)
        );
    }

    /**
     * Check if content type should be compressed
     */
    private shouldCompressContentType(contentType: string): boolean {
        const config = this.getCompressionConfig();
        const contentTypes = config.contentTypes || [
            "text/*",
            "application/json",
            "application/javascript",
            "application/xml",
            "application/rss+xml",
            "application/atom+xml",
        ];

        // Check exclude list first
        if (config.excludeContentTypes) {
            for (const excludeType of config.excludeContentTypes) {
                if (this.matchesContentType(contentType, excludeType)) {
                    return false;
                }
            }
        }

        // Check include list
        return contentTypes.some((type) =>
            this.matchesContentType(contentType, type)
        );
    }

    /**
     * Match content type with pattern (supports wildcards)
     */
    private matchesContentType(contentType: string, pattern: string): boolean {
        if (pattern.includes("*")) {
            const regex = new RegExp(pattern.replace("*", ".*"), "i");
            return regex.test(contentType);
        }
        return contentType.toLowerCase().includes(pattern.toLowerCase());
    }






    /**
     * Get compression configuration
     */
    private getCompressionConfig(): CompressionConfig {
        return this.config as CompressionConfig;
    }

    /**
     * Validate compression configuration
     */
    public validateNetworkConfig(config: CompressionConfig): boolean {
        if (config.level && (config.level < 1 || config.level > 9)) {
            return false;
        }

        if (config.threshold && config.threshold < 0) {
            return false;
        }

        if (config.algorithms && config.algorithms.length === 0) {
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


        return {
            healthy:
                errorRate < 0.1 &&
                this.performanceMetrics.averageExecutionTime <
                    this.maxExecutionTime,
            status:
                errorRate < 0.05
                    ? "healthy"
                    : errorRate < 0.1
                    ? "degraded"
                    : "unhealthy",
            metrics: {
                responseTime: this.performanceMetrics.averageExecutionTime,
                errorRate,
                throughput: this.performanceMetrics.totalExecutions,
                connections: 0, // Not applicable for compression
            },
            lastCheck: new Date(),
        };
    }

    /**
     * Get compression statistics
     */
    public getCompressionStats() {
        return {
            ...this.compressionStats,
            supportedAlgorithms: [...this.supportedAlgorithms],
            averageCompressionRatio:
                this.compressionStats.totalBytesOriginal > 0
                    ? this.compressionStats.totalBytesCompressed /
                      this.compressionStats.totalBytesOriginal
                    : 0,
        };
    }
}


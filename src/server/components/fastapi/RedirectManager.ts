/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */

import { Logger } from "../../../../shared/logger/Logger";
import {
    RedirectOptions,
    RedirectServerInstance,
    RedirectStats,
} from "../../../types/types";
import fs from "fs";
import path from "path";
import { redirectTempHtml } from "./templates/redirectTemp";

/**
 * RedirectManager - Handles advanced port redirection with multiple modes
 * Supports transparent proxy, message display, and HTTP redirects
 */
export class RedirectManager {
    private redirectInstances: Map<number, RedirectServerInstance> = new Map();
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Set up automatic request redirection from one port to another with advanced options
     * @param fromPort - The source port to redirect from
     * @param toPort - The destination port to redirect to
     * @param options - Advanced redirect configuration options
     * @returns Promise<RedirectServerInstance | boolean> - redirect instance or boolean for backward compatibility
     */
    public async redirectFromPort(
        fromPort: number,
        toPort: number,
        options?: RedirectOptions,
    ): Promise<RedirectServerInstance | boolean> {
        try {
            // Set default options
            const defaultOptions = {
                mode: "message" as const,
                enableLogging: true,
                enableStats: true,
                redirectStatusCode: 302 as const,
                proxyTimeout: 30000,
                enableCors: false,
                customHeaders: {},
                customMessage: `This server has moved to http://localhost:${toPort}. Please update your bookmarks.`,
                customErrorMessage: "Redirect target unavailable",
                customHtmlTemplate: "",
            };

            const finalOptions = { ...defaultOptions, ...options };

            if (finalOptions.enableLogging) {
                this.logger.debug(
                    "server",
                    `Setting up ${finalOptions.mode} redirect from port ${fromPort} to ${toPort}...`,
                );
            }

            // Check if redirect already exists
            if (this.redirectInstances.has(fromPort)) {
                this.logger.warn(
                    "server",
                    `Redirect from port ${fromPort} already exists`,
                );
                return false;
            }

            // Import required modules
            const http = require("http");

            // Initialize stats
            const stats: RedirectStats = {
                totalRequests: 0,
                successfulRedirects: 0,
                failedRedirects: 0,
                averageResponseTime: 0,
                startTime: new Date(),
                uptime: 0,
                lastRequestTime: undefined,
                requestTimes: [],
            };

            // Rate limiting state
            const rateLimitState = new Map<
                string,
                { count: number; resetTime: number }
            >();

            // Try to use http-proxy-middleware for transparent mode
            let useAdvancedProxy = false;
            let createProxyMiddleware: any;

            if (finalOptions.mode === "transparent") {
                try {
                    const httpProxyMiddleware = require("http-proxy-middleware");
                    createProxyMiddleware =
                        httpProxyMiddleware.createProxyMiddleware ||
                        httpProxyMiddleware.default?.createProxyMiddleware ||
                        httpProxyMiddleware;

                    if (typeof createProxyMiddleware === "function") {
                        useAdvancedProxy = true;
                        if (finalOptions.enableLogging) {
                            this.logger.debug(
                                "server",
                                "Using http-proxy-middleware for transparent redirect",
                            );
                        }
                    }
                } catch (error) {
                    if (finalOptions.enableLogging) {
                        this.logger.debug(
                            "server",
                            "http-proxy-middleware not available, using built-in solution",
                        );
                    }
                }
            }

            // Helper functions
            const addCustomHeaders = (res: any) => {
                if (finalOptions.enableCors) {
                    res.setHeader("Access-Control-Allow-Origin", "*");
                    res.setHeader(
                        "Access-Control-Allow-Methods",
                        "GET, POST, PUT, DELETE, OPTIONS",
                    );
                    res.setHeader(
                        "Access-Control-Allow-Headers",
                        "Content-Type, Authorization",
                    );
                }
                Object.entries(finalOptions.customHeaders).forEach(
                    ([key, value]) => {
                        res.setHeader(key, value);
                    },
                );
            };

            const checkRateLimit = (clientIp: string): boolean => {
                if (!finalOptions.rateLimit) return true;

                const now = Date.now();
                const clientState = rateLimitState.get(clientIp) || {
                    count: 0,
                    resetTime: now + finalOptions.rateLimit.windowMs,
                };

                if (now > clientState.resetTime) {
                    clientState.count = 0;
                    clientState.resetTime =
                        now + finalOptions.rateLimit.windowMs;
                }

                clientState.count++;
                rateLimitState.set(clientIp, clientState);

                return clientState.count <= finalOptions.rateLimit.maxRequests;
            };

            const updateStats = (startTime: number, success: boolean) => {
                if (!finalOptions.enableStats) return;

                const responseTime = Date.now() - startTime;
                stats.totalRequests++;
                stats.requestTimes.push(responseTime);

                if (success) {
                    stats.successfulRedirects++;
                } else {
                    stats.failedRedirects++;
                }

                // Calculate average response time
                stats.averageResponseTime =
                    stats.requestTimes.reduce((a, b) => a + b, 0) /
                    stats.requestTimes.length;

                // Keep only last 100 response times for memory efficiency
                if (stats.requestTimes.length > 100) {
                    stats.requestTimes = stats.requestTimes.slice(-100);
                }

                stats.uptime = Date.now() - stats.startTime.getTime();
                stats.lastRequestTime = new Date();
            };

            // Create redirect server with enhanced functionality
            const redirectServer = http.createServer((req: any, res: any) => {
                const startTime = Date.now();
                const clientIp =
                    req.connection.remoteAddress ||
                    req.socket.remoteAddress ||
                    "unknown";

                // Rate limiting check
                if (!checkRateLimit(clientIp)) {
                    res.writeHead(429, { "Content-Type": "text/plain" });
                    res.end("Too Many Requests");
                    updateStats(startTime, false);
                    return;
                }

                // Add custom headers
                addCustomHeaders(res);

                // Handle different redirect modes
                this.handleRedirectMode(
                    req,
                    res,
                    finalOptions,
                    toPort,
                    startTime,
                    updateStats,
                    useAdvancedProxy,
                    createProxyMiddleware,
                );
            });

            // Auto-disconnect timers
            let autoDisconnectTimer: NodeJS.Timeout | null = null;
            let requestCountForAutoDisconnect = 0;

            // Create redirect instance
            const redirectInstance: RedirectServerInstance = {
                fromPort,
                toPort,
                options: finalOptions,
                server: redirectServer,
                stats,
                disconnect: async (): Promise<boolean> => {
                    try {
                        if (autoDisconnectTimer) {
                            clearTimeout(autoDisconnectTimer);
                        }
                        redirectServer.close();
                        this.redirectInstances.delete(fromPort);
                        if (finalOptions.enableLogging) {
                            this.logger.info(
                                "server",
                                `Redirect server disconnected: ${fromPort} → ${toPort}`,
                            );
                        }
                        return true;
                    } catch (error: any) {
                        if (finalOptions.enableLogging) {
                            this.logger.error(
                                "server",
                                `Error disconnecting redirect: ${error.message}`,
                            );
                        }
                        return false;
                    }
                },
                getStats: () => ({ ...stats }),
                updateOptions: (newOptions: Partial<RedirectOptions>) => {
                    Object.assign(finalOptions, newOptions);
                    if (finalOptions.enableLogging) {
                        this.logger.debug(
                            "server",
                            `Updated redirect options for ${fromPort} → ${toPort}`,
                        );
                    }
                },
            };

            // Set up auto-disconnect timers
            if (finalOptions.autoDisconnectAfter) {
                autoDisconnectTimer = setTimeout(() => {
                    if (finalOptions.enableLogging) {
                        this.logger.info(
                            "server",
                            `Auto-disconnecting redirect after ${finalOptions.autoDisconnectAfter}ms: ${fromPort} → ${toPort}`,
                        );
                    }
                    redirectInstance.disconnect();
                }, finalOptions.autoDisconnectAfter);
            }

            // Wrap the request handler to check auto-disconnect by request count
            const originalHandler = redirectServer.listeners("request")[0];
            redirectServer.removeAllListeners("request");
            redirectServer.on("request", (req: any, res: any) => {
                requestCountForAutoDisconnect++;

                if (
                    finalOptions.autoDisconnectAfterRequests &&
                    requestCountForAutoDisconnect >=
                        finalOptions.autoDisconnectAfterRequests
                ) {
                    if (finalOptions.enableLogging) {
                        this.logger.info(
                            "server",
                            `Auto-disconnecting redirect after ${finalOptions.autoDisconnectAfterRequests} requests: ${fromPort} → ${toPort}`,
                        );
                    }
                    // Disconnect after this request
                    res.on("finish", () => {
                        setTimeout(() => redirectInstance.disconnect(), 100);
                    });
                }

                originalHandler(req, res);
            });

            // Start the redirect server
            return new Promise((resolve) => {
                redirectServer.listen(fromPort, () => {
                    // Store the redirect instance
                    this.redirectInstances.set(fromPort, redirectInstance);

                    if (finalOptions.enableLogging) {
                        this.logger.info(
                            "server",
                            `Redirect server started: ${fromPort} → ${toPort} (mode: ${finalOptions.mode})`,
                        );
                    }

                    // Return the redirect instance for advanced usage, or true for backward compatibility
                    resolve(options ? redirectInstance : true);
                });

                redirectServer.on("error", (error: any) => {
                    if (error.code === "EADDRINUSE") {
                        this.logger.warn(
                            "server",
                            `Cannot setup redirect: Port ${fromPort} is still in use`,
                        );
                    } else {
                        this.logger.error(
                            "server",
                            `Redirect server error: ${error.message}`,
                        );
                    }
                    resolve(false);
                });
            });
        } catch (error: any) {
            this.logger.error(
                "server",
                `Error setting up redirect from ${fromPort} to ${toPort}:`,
                error.message,
            );
            return false;
        }
    }

    /**
     * Handle different redirect modes
     */
    private handleRedirectMode(
        req: any,
        res: any,
        options: any,
        toPort: number,
        startTime: number,
        updateStats: (startTime: number, success: boolean) => void,
        useAdvancedProxy: boolean,
        createProxyMiddleware: any,
    ): void {
        if (options.mode === "message") {
            this.handleMessageMode(
                req,
                res,
                options,
                toPort,
                startTime,
                updateStats,
            );
        } else if (options.mode === "redirect") {
            this.handleHttpRedirectMode(
                req,
                res,
                options,
                toPort,
                startTime,
                updateStats,
            );
        } else {
            this.handleTransparentMode(
                req,
                res,
                options,
                toPort,
                startTime,
                updateStats,
                useAdvancedProxy,
                createProxyMiddleware,
            );
        }
    }

    /**
     * Handle message mode - show custom HTML message
     */
    private handleMessageMode(
        req: any,
        res: any,
        options: any,
        toPort: number,
        startTime: number,
        updateStats: (startTime: number, success: boolean) => void,
    ): void {
        let htmlContent = options.customHtmlTemplate;

        // If no custom template provided, use the beautiful default template
        if (!htmlContent) {
            try {
                const templatePath = path.join(
                    __dirname,
                    "templates",
                    "redirectHtml.html",
                );
                const templateFile = fs.readFileSync(templatePath, "utf8");

                htmlContent = templateFile
                    .replace(/{{customMessage}}/g, options.customMessage)
                    .replace(/{{toPort}}/g, toPort.toString());
            } catch (error) {
                // Fallback to beautiful inline template if file not found
                htmlContent = redirectTempHtml({
                    customMessage: options.customMessage,
                    toPort: options.toPort,
                });
            }
        }

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(htmlContent);
        updateStats(startTime, true);

        if (options.enableLogging) {
            this.logger.debug(
                "server",
                `Served redirect message for ${req.method} ${req.url}`,
            );
        }
    }

    /**
     * Handle HTTP redirect mode - send 301/302 redirect
     */
    private handleHttpRedirectMode(
        req: any,
        res: any,
        options: any,
        toPort: number,
        startTime: number,
        updateStats: (startTime: number, success: boolean) => void,
    ): void {
        const redirectUrl = `http://localhost:${toPort}${req.url}`;
        res.writeHead(options.redirectStatusCode, { Location: redirectUrl });
        res.end();
        updateStats(startTime, true);

        if (options.enableLogging) {
            this.logger.debug(
                "server",
                `HTTP ${options.redirectStatusCode} redirect: ${req.method} ${req.url} to ${redirectUrl}`,
            );
        }
    }

    /**
     * Handle transparent mode - proxy the request
     */
    private handleTransparentMode(
        req: any,
        res: any,
        options: any,
        toPort: number,
        startTime: number,
        updateStats: (startTime: number, success: boolean) => void,
        useAdvancedProxy: boolean,
        createProxyMiddleware: any,
    ): void {
        if (useAdvancedProxy) {
            this.handleAdvancedProxy(
                req,
                res,
                options,
                toPort,
                startTime,
                updateStats,
                createProxyMiddleware,
            );
        } else {
            this.handleBuiltInProxy(
                req,
                res,
                options,
                toPort,
                startTime,
                updateStats,
            );
        }
    }

    /**
     * Handle advanced proxy using http-proxy-middleware
     */
    private handleAdvancedProxy(
        req: any,
        res: any,
        options: any,
        toPort: number,
        startTime: number,
        updateStats: (startTime: number, success: boolean) => void,
        createProxyMiddleware: any,
    ): void {
        const proxy = createProxyMiddleware({
            target: `http://localhost:${toPort}`,
            changeOrigin: true,
            timeout: options.proxyTimeout,
            logLevel: "silent",
            onError: (err: any, _req: any, res: any) => {
                if (options.enableLogging) {
                    this.logger.warn(
                        "server",
                        `Redirect proxy error: ${err.message}`,
                    );
                }
                res.writeHead(502, { "Content-Type": "text/plain" });
                res.end(options.customErrorMessage);
                updateStats(startTime, false);
            },
            onProxyReq: (_proxyReq: any, req: any, _res: any) => {
                if (options.enableLogging) {
                    this.logger.debug(
                        "server",
                        `Proxying ${req.method} ${req.url} to port ${toPort}`,
                    );
                }
            },
            onProxyRes: (_proxyRes: any, _req: any, _res: any) => {
                updateStats(startTime, true);
            },
        });
        proxy(req, res);
    }

    /**
     * Handle built-in proxy solution
     */
    private handleBuiltInProxy(
        req: any,
        res: any,
        options: any,
        toPort: number,
        startTime: number,
        updateStats: (startTime: number, success: boolean) => void,
    ): void {
        if (options.enableLogging) {
            this.logger.debug(
                "server",
                `Proxying ${req.method} ${req.url} to port ${toPort}`,
            );
        }

        const http = require("http");
        const proxyOptions = {
            hostname: "localhost",
            port: toPort,
            path: req.url,
            method: req.method,
            headers: req.headers,
            timeout: options.proxyTimeout,
        };

        const proxyReq = http.request(proxyOptions, (proxyRes: any) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
            updateStats(startTime, true);
        });

        proxyReq.on("error", (err: any) => {
            if (options.enableLogging) {
                this.logger.warn(
                    "server",
                    `Built-in proxy error: ${err.message}`,
                );
            }
            res.writeHead(502, { "Content-Type": "text/plain" });
            res.end(options.customErrorMessage);
            updateStats(startTime, false);
        });

        proxyReq.on("timeout", () => {
            if (options.enableLogging) {
                this.logger.warn(
                    "server",
                    `Proxy timeout for ${req.method} ${req.url}`,
                );
            }
            res.writeHead(504, { "Content-Type": "text/plain" });
            res.end("Gateway Timeout");
            updateStats(startTime, false);
        });

        req.pipe(proxyReq);
    }

    /**
     * Get a specific redirect instance by port
     * @param fromPort - The source port of the redirect
     * @returns RedirectServerInstance or null if not found
     */
    public getRedirectInstance(
        fromPort: number,
    ): RedirectServerInstance | null {
        return this.redirectInstances.get(fromPort) || null;
    }

    /**
     * Get all active redirect instances
     * @returns Array of all redirect instances
     */
    public getAllRedirectInstances(): RedirectServerInstance[] {
        return Array.from(this.redirectInstances.values());
    }

    /**
     * Disconnect a specific redirect server
     * @param fromPort - The source port of the redirect to disconnect
     * @returns Promise<boolean> - true if successfully disconnected
     */
    public async disconnectRedirect(fromPort: number): Promise<boolean> {
        const instance = this.redirectInstances.get(fromPort);
        if (instance) {
            return await instance.disconnect();
        }
        this.logger.warn("server", `No redirect found for port ${fromPort}`);
        return false;
    }

    /**
     * Disconnect all active redirect servers
     * @returns Promise<boolean> - true if all redirects were successfully disconnected
     */
    public async disconnectAllRedirects(): Promise<boolean> {
        const instances = Array.from(this.redirectInstances.values());
        let allSuccess = true;

        for (const instance of instances) {
            const success = await instance.disconnect();
            if (!success) {
                allSuccess = false;
            }
        }

        this.logger.info(
            "server",
            `Disconnected ${instances.length} redirect servers`,
        );
        return allSuccess;
    }

    /**
     * Get statistics for a specific redirect
     * @param fromPort - The source port of the redirect
     * @returns RedirectStats or null if not found
     */
    public getRedirectStats(fromPort: number): RedirectStats | null {
        const instance = this.redirectInstances.get(fromPort);
        if (instance) {
            return instance.getStats();
        }
        return null;
    }

    /**
     * Get total count of active redirects
     * @returns number of active redirects
     */
    public getRedirectCount(): number {
        return this.redirectInstances.size;
    }

    /**
     * Check if a redirect exists for a specific port
     * @param fromPort - The source port to check
     * @returns boolean indicating if redirect exists
     */
    public hasRedirect(fromPort: number): boolean {
        return this.redirectInstances.has(fromPort);
    }

    /**
     * Get summary of all redirects
     * @returns Array of redirect summaries
     */
    public getRedirectSummary(): Array<{
        fromPort: number;
        toPort: number;
        mode: string;
        stats: RedirectStats;
    }> {
        return Array.from(this.redirectInstances.values()).map((instance) => ({
            fromPort: instance.fromPort,
            toPort: instance.toPort,
            mode: instance.options.mode || "transparent",
            stats: instance.getStats(),
        }));
    }
}


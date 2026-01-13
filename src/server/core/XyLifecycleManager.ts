/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * @author Nehonix
 * @license NOSL
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************/

import { Logger } from "../../../shared/logger/Logger";
import type { XyprissApp } from "./XyprissApp";
import { PortManager } from "../utils/PortManager";
import { Port as PortUtility } from "../utils/forceClosePort";
import { XHSCBridge } from "./XHSCBridge";
import { RedirectManager } from "../components/fastapi/RedirectManager";

/**
 * XyLifecycleManager - Handles server lifecycle, including start, stop, and port management.
 */
export class XyLifecycleManager {
    private app: XyprissApp;
    private logger: Logger;
    private currentPort: number = 0;
    private xhscBridge: XHSCBridge | null = null;
    private redirectManager: RedirectManager;

    constructor(app: XyprissApp, logger: Logger) {
        this.app = app;
        this.logger = logger;
        this.redirectManager = new RedirectManager(logger);
    }

    /**
     * Initialize lifecycle methods and inject them into the app.
     */
    public initialize(): void {
        this.app.start = async (port?: number, callback?: () => void) => {
            const options = this.app.configs || {};
            const host = options.server?.host || "0.0.0.0";
            let serverPort = port || options.server?.port || 3000;

            this.logger.debug(
                "server",
                `Attempting to start XyPriss server on ${host}:${serverPort}...`
            );

            // Handle auto port switching if enabled
            if (options.server?.autoPortSwitch?.enabled) {
                const portManager = new PortManager(
                    serverPort,
                    options.server.autoPortSwitch
                );
                const result = await portManager.findAvailablePort(host);

                if (!result.success) {
                    throw new Error(
                        `Failed to find an available port after ${
                            options.server.autoPortSwitch.maxAttempts || 10
                        } attempts`
                    );
                }

                if (result.switched) {
                    this.logger.info(
                        "server",
                        `🔄 Port ${serverPort} was in use, switched to port ${result.port}`
                    );
                    serverPort = result.port;
                }
            }

            // If XHSC is enabled (which is now our primary objective)
            if (options.server?.xhsc !== false) {
                this.logger.info(
                    "server",
                    "🚀 Using XHSC (Rust Hybrid Server Core) as primary HTTP engine"
                );

                try {
                    // Initialize XHSC Bridge
                    this.xhscBridge = new XHSCBridge(this.app, this.logger);

                    // Start the bridge (which starts Rust and IPC)
                    await this.xhscBridge.start(serverPort, host);

                    this.currentPort = serverPort;
                    this.logger.info(
                        "server",
                        `🚀 XyPriss (XHSC) running on ${host}:${this.currentPort}`
                    );

                    if (callback) callback();

                    // Return a proxy-like object for the server instance since XHSC doesn't have a Node server instance
                    return {
                        close: (cb?: any) => {
                            this.xhscBridge?.stop();
                            if (cb) cb();
                        },
                        address: () => ({
                            address: host,
                            port: serverPort,
                            family: "IPv4",
                        }),
                    };
                } catch (error: any) {
                    this.logger.warn(
                        "server",
                        `Failed to start XHSC: ${error.message}. Falling back to standard mode.`
                    );
                    // Fallback handled below if we don't return here
                }
            }

            const httpServer = this.app.getHttpServer();
            try {
                // httpServer.listen returns the server instance
                const instance = await httpServer.listen(
                    serverPort,
                    host,
                    callback
                );
                this.currentPort = httpServer.getPort();
                this.logger.info(
                    "server",
                    `🚀 XyPriss (Standard) running on ${host}:${this.currentPort}`
                );
                return instance;
            } catch (error: any) {
                this.logger.error(
                    "server",
                    `Failed to start server on port ${serverPort}: ${error.message}`
                );
                throw error;
            }
        };

        this.app.waitForReady = async () => {
            // Wait for internal components to be ready
            // If there's a plugin initialization promise, await it
            if ((this.app as any).pluginInitPromise) {
                await (this.app as any).pluginInitPromise;
            }
            return Promise.resolve();
        };

        this.app.getPort = () => {
            const httpServer = this.app.getHttpServer();
            return httpServer.getPort() || this.currentPort;
        };

        this.app.forceClosePort = async (port: number) => {
            this.logger.warn("server", `Force closing port ${port}...`);
            const portUtility = new PortUtility(port);
            return await portUtility.forceClosePort();
        };

        // Redirect methods
        this.app.redirectFromPort = async (from, to, opts) => {
            return await this.redirectManager.redirectFromPort(from, to, opts);
        };

        this.app.getRedirectInstance = (port) => {
            return this.redirectManager.getRedirectInstance(port);
        };

        this.app.getAllRedirectInstances = () => {
            return this.redirectManager.getAllRedirectInstances();
        };

        this.app.disconnectRedirect = async (port) => {
            return await this.redirectManager.disconnectRedirect(port);
        };

        this.app.disconnectAllRedirects = async () => {
            return await this.redirectManager.disconnectAllRedirects();
        };

        this.app.getRedirectStats = (port) => {
            return this.redirectManager.getRedirectStats(port);
        };

        // Override close method to handle XHSC cleanup
        const originalClose = this.app.close.bind(this.app);
        this.app.close = (callback?: (err?: Error) => void) => {
            this.logger.info("server", "Stopping XyPriss server...");
            if (this.xhscBridge) {
                this.xhscBridge.stop();
                if (callback) callback();
            } else {
                originalClose(callback);
            }
        };
    }

    public stop(): void {
        if (this.xhscBridge) {
            this.xhscBridge.stop();
        }
    }
}


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
import { Port as PortUtility } from "../utils/forceClosePort";
import { XHSCBridge } from "./XHSCBridge";
import { RedirectManager } from "../components/fastapi/RedirectManager";
import { StartupProcessor } from "./StartupProcessor";

/**
 * XyLifecycleManager - Handles server lifecycle using centralized StartupProcessor.
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
            const serverPort = port || options.server?.port || 3000;

            this.logger.info(
                "server",
                `😘Attempting to start XyPriss server on ${host}:${serverPort}...`
            );

            try {
                const result = await StartupProcessor.start(
                    {
                        port: serverPort,
                        host,
                        options,
                        app: this.app,
                        logger: this.logger,
                    },
                    () => {
                        if (callback) callback();
                    }
                );

                this.currentPort = result.port;
                this.xhscBridge = result.xhscBridge;

                const mode = result.xhscBridge ? "XHSC" : "Standard";
                this.logger.info(
                    "server",
                    `XyPriss (${mode}) running on ${host}:${this.currentPort}`
                );

                return result.serverInstance;
            } catch (error: any) {
                this.logger.error(
                    "server",
                    `Failed to start server: ${error.message}`
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


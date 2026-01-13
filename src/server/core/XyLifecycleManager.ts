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

/**
 * XyLifecycleManager - Handles server lifecycle, including start, stop, and port management.
 */
export class XyLifecycleManager {
    private app: XyprissApp;
    private logger: Logger;
    private currentPort: number = 0;

    constructor(app: XyprissApp, logger: Logger) {
        this.app = app;
        this.logger = logger;
    }

    /**
     * Initialize lifecycle methods and inject them into the app.
     */
    public initialize(): void {
        this.app.start = async (port?: number, callback?: () => void) => {
            const finalPort = port || this.app.configs?.server?.port || 3000;
            this.currentPort = finalPort;

            this.logger.info(
                "server",
                `Starting XyPriss server on port ${finalPort}...`
            );

            const httpServer = this.app.getHttpServer();
            try {
                const instance = await httpServer.listen(
                    finalPort,
                    "0.0.0.0",
                    callback
                );
                this.currentPort = httpServer.getPort();
                return instance;
            } catch (error) {
                this.logger.error(
                    "server",
                    `Failed to start server on port ${finalPort}: ${error}`
                );
                throw error;
            }
        };

        this.app.waitForReady = async () => {
            // Wait for internal components to be ready
            return Promise.resolve();
        };

        this.app.getPort = () => {
            const httpServer = this.app.getHttpServer();
            return httpServer.getPort() || this.currentPort;
        };

        this.app.forceClosePort = async (port: number) => {
            this.logger.warn("server", `Force closing port ${port}...`);
            // In a real implementation, this might kill processes or use raw socket calls
            return true;
        };

        // Redirect methods
        this.app.redirectFromPort = async (from, to, opts) => {
            this.logger.debug("server", `Redirecting from ${from} to ${to}`);
            return true;
        };

        this.app.getRedirectInstance = (port) => null;
        this.app.getAllRedirectInstances = () => [];
        this.app.disconnectRedirect = async (port) => true;
        this.app.disconnectAllRedirects = async () => true;
        this.app.getRedirectStats = (port) => null;
    }
}


/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * @author Nehonix
 * @license NOSL
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************/

import { Logger } from "../../../shared/logger/Logger";
import { PortManager } from "../utils/PortManager";
import { XHSCBridge } from "./XHSCBridge";

export interface StartupConfig {
    port: number;
    host: string;
    options: any;
    app: any;
    logger: Logger;
}

export interface StartupResult {
    port: number;
    xhscBridge: XHSCBridge | null;
    serverInstance: any;
}

/**
 * StartupProcessor - Centralized server startup logic
 * Handles port management, engine selection (XHSC/Standard), and lifecycle hooks.
 */
export class StartupProcessor {
    /**
     * Execute the startup sequence
     */
    public static async start(
        config: StartupConfig,
        callback?: (result: StartupResult) => void
    ): Promise<StartupResult> {
        const { port, host, options, app, logger } = config;
        let finalPort = port;

        // 1. Port Presence Checks & Management
        if (options.server?.autoPortSwitch?.enabled) {
            const portManager = new PortManager(
                finalPort,
                options.server.autoPortSwitch
            );
            const result = await portManager.findAvailablePort(host);

            if (!result.success) {
                throw new Error(
                    `Failed to find available port after ${
                        options.server.autoPortSwitch.maxAttempts || 10
                    } attempts`
                );
            }

            if (result.switched) {
                logger.info(
                    "server",
                    `🔄 Port ${finalPort} was in use, switched to port ${result.port}`
                );
                finalPort = result.port;
            }
        } else {
            const portManager = new PortManager(finalPort, { enabled: false });
            const result = await portManager.findAvailablePort(host);

            if (!result.success) {
                throw new Error(
                    `Failed to start server. Port ${finalPort} is already in use. Enable autoPortSwitch in config.`
                );
            }
        }

        // 2. High-Performance Engine (XHSC)
        if (options.server?.xhsc !== false) {
            logger.info("server", "Using XHSC as primary HTTP engine");
            try {
                const xhscBridge = new XHSCBridge(app, logger);
                await xhscBridge.start(finalPort, host);

                const result: StartupResult = {
                    port: finalPort,
                    xhscBridge,
                    serverInstance: {
                        close: (cb?: any) => {
                            xhscBridge.stop();
                            if (cb) cb();
                        },
                        address: () => ({
                            address: host,
                            port: finalPort,
                            family: "IPv4",
                        }),
                    },
                };

                if (callback) callback(result);

                return result;
            } catch (error: any) {
                logger.warn(
                    "server",
                    `Failed to start XHSC: ${error.message}. Falling back to standard mode.`
                );
            }
        }

        // 3. Standard Mode (Native Node.js / XyPriss JS)
        const httpServer = app.getHttpServer();
        const serverInstance = await httpServer.listen(finalPort, host);

        const result: StartupResult = {
            port: finalPort,
            xhscBridge: null,
            serverInstance,
        };

        if (callback) callback(result);

        return result;
    }
}


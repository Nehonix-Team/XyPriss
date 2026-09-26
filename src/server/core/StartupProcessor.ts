/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************/

import { Logger } from "../../shared/logger/Logger";
import { PortManager } from "../utils/PortManager";
import { XHSCBridge } from "./XHSCBridge";
import { ConsoleInterceptor } from "../components/fastapi/console/ConsoleInterceptor";

export interface StartupConfig {
    port: number;
    host: string;
    options: any;
    app: any;
    logger: Logger;
    consoleInterceptor?: ConsoleInterceptor;
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
        callback?: (result: StartupResult) => void,
    ): Promise<StartupResult> {
        const { port, host, options, app, logger } = config;
        let finalPort = port;

        // 1. High-Performance Engine (XHSC)
        // Port management, conflict resolution and auto-port switching are handled natively by XHSC in Go
        if (options.server?.xhsc !== false) {
            logger.info("server", "Using XHSC as primary HTTP engine");
            try {
                const xhscBridge = new XHSCBridge(app, logger);
                const boundPort = await xhscBridge.start(
                    finalPort,
                    host,
                    config.consoleInterceptor,
                );

                if (boundPort && boundPort !== finalPort) {
                    logger.info(
                        "server",
                        `🔄 Port ${finalPort} was in use, switched to port ${boundPort}`,
                    );
                    finalPort = boundPort;
                }

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
                logger.error(
                    "server",
                    `⚠️ XHSC Engine failed to initialize: ${error.message}`,
                );

                if (
                    error.message?.includes(
                        "unsupported compression algorithm",
                    ) ||
                    error.message?.includes("unknown flag:") ||
                    error.message?.includes("flag provided but not defined:") ||
                    error.message?.includes("signal: killed")
                ) {
                    throw error;
                }

                throw error?.message || error;
            }
        }

        // 2. Standard Engine Fallback: Port Presence Checks via PortManager
        const portManager = new PortManager(
            finalPort,
            options.server?.autoPortSwitch,
        );

        const autoPortSwitchEnabled = Boolean(
            options.server?.autoPortSwitch?.enabled,
        );
        const autoKillConflict =
            !autoPortSwitchEnabled && options.server?.autoKillConflict !== false;

        if (autoKillConflict) {
            const isAvailable = await portManager.isPortAvailable(
                finalPort,
                host,
            );
            if (!isAvailable) {
                logger.warn(
                    "server",
                    `⚠️ Port ${finalPort} is already in use. Attempting to resolve automatically...`,
                );
                const killed = await portManager.killProcessOnPort(finalPort);
                if (killed) {
                    logger.info(
                        "server",
                        `✅ Conflict on port ${finalPort} resolved. Starting engine...`,
                    );
                    await new Promise((r) => setTimeout(r, 100));
                }
            }
        }

        if (autoPortSwitchEnabled) {
            const result = await portManager.findAvailablePort(host);
            if (!result.success) {
                throw new Error(
                    `Failed to find available port after ${
                        options.server.autoPortSwitch.maxAttempts || 10
                    } attempts`,
                );
            }
            if (result.switched) {
                logger.info(
                    "server",
                    `🔄 Port ${finalPort} was in use, switched to port ${result.port}`,
                );
                finalPort = result.port;
            }
        } else {
            const result = await portManager.findAvailablePort(host);
            if (!result.success) {
                throw new Error(
                    `Failed to start server. Port ${finalPort} is already in use. Enable autoPortSwitch or autoKillConflict in config.`,
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


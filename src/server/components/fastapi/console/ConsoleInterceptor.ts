/***************************************************************************
 * ConsoleInterceptor.ts - Lightweight Console Interception System
 * Delegated to XHSC (Go) for heavy lifting
 *************************************************************************** */

import { Logger } from "../../../../shared/logger/Logger";
import { ServerOptions } from "../../../../types/types";
import {
    ConsoleInterceptionConfig,
    ConsoleInterceptionStats,
    DEFAULT_CONSOLE_CONFIG,
} from "./types";
import { XHSCDirectIPC } from "../../../../xhsc/ipc/XHSCDirectIPC";

/**
 * Lightweight Console Interception System (CSIS)
 * When useNative is enabled, it delegates all filtering and encryption to XHSC (Go).
 */
export class ConsoleInterceptor {
    private logger: Logger;
    private config: ConsoleInterceptionConfig;
    private isIntercepting = false;
    private stats: ConsoleInterceptionStats;
    private ipcPath: string | undefined;
    private pluginEngine: any;

    constructor(logger: Logger, config?: ServerOptions["logging"]) {
        this.logger = logger;
        this.config = {
            ...DEFAULT_CONSOLE_CONFIG,
            ...(config?.consoleInterception || {}),
        } as ConsoleInterceptionConfig;

        this.stats = {
            totalInterceptions: 0,
            interceptionsPerSecond: 0,
            errorCount: 0,
            lastInterceptionTime: 0,
            methodCounts: {},
            averageOverhead: 0,
            isActive: false,
        };
        this.ipcPath = process.env.XYPRISS_IPC_PATH;
    }

    public async start(): Promise<void> {
        if (!this.config.enabled || this.isIntercepting) {
            return;
        }

        if (this.ipcPath) {
            try {
                const ipc = new XHSCDirectIPC(this.ipcPath);
                await ipc.sendCommand("console", "update-config", this.config);
                ipc.close();

                this.logger.info(
                    "console",
                    "Native XHSC console interception activated via IPC",
                );
                this.isIntercepting = true;
                this.stats.isActive = true;
            } catch (err: any) {
                this.logger.error(
                    "console",
                    `Failed to activate native interception: ${err.message}`,
                );
            }
        } else {
            this.logger.warn(
                "console",
                "XYPRISS_IPC_PATH not set — native interception unavailable",
            );
        }
    }

    public async stop(): Promise<void> {
        if (!this.isIntercepting) return;

        if (this.ipcPath) {
            try {
                const ipc = new XHSCDirectIPC(this.ipcPath);
                await ipc.sendCommand("console", "update-config", {
                    ...this.config,
                    enabled: false,
                });
                ipc.close();
            } catch (err) {
                // Ignore stop errors
            }
        }

        this.isIntercepting = false;
        this.stats.isActive = false;
    }

    public async getStats(): Promise<ConsoleInterceptionStats> {
        if (this.ipcPath && this.isIntercepting) {
            try {
                const ipc = new XHSCDirectIPC(this.ipcPath);
                const res = await ipc.sendCommand("console", "get-stats", {});
                ipc.close();
                // Merge/process remote stats if needed
                // For now, return local state with remote markers
                return { ...this.stats, methodCounts: res.data || {} };
            } catch (err) {
                return { ...this.stats };
            }
        }
        return { ...this.stats };
    }

    public async updateConfig(
        newConfig: Partial<ConsoleInterceptionConfig>,
    ): Promise<void> {
        this.config = {
            ...this.config,
            ...newConfig,
        };

        if (this.ipcPath) {
            try {
                const ipc = new XHSCDirectIPC(this.ipcPath);
                await ipc.sendCommand("console", "update-config", this.config);
                ipc.close();
            } catch (err: any) {
                this.logger.error(
                    "console",
                    `Failed to update console config: ${err.message}`,
                );
            }
        }
    }

    public setPluginEngine(engine: any): void {
        this.pluginEngine = engine;
    }

    /**
     * Called by LogProcessor when a log is received from the native engine.
     * This triggers the plugin hooks if enabled.
     */
    public handleNativeLog(log: any): void {
        if (this.isIntercepting && this.pluginEngine?.triggerConsoleLogHook) {
            this.pluginEngine.triggerConsoleLogHook(log);
        }
    }
}


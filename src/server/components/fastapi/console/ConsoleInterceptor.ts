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
import { XStringify } from "xypriss-security";
import { Configs } from "../../../..";
import { mergeWithDefaults } from "../../../../utils/mergeWithDefaults";
import { AsyncLocalStorage } from "async_hooks";

/**
 * XyPriss Console Interceptor (XCI)
 * High-performance log delegation and filtering via XHSC.
 * When useNative is enabled, it delegates all filtering and encryption to XHSC (Go).
 */

export class ConsoleInterceptor {
    private static instance: ConsoleInterceptor | null = null;
    private logger: Logger;
    private config: ConsoleInterceptionConfig;
    private isIntercepting = false;
    private stats: ConsoleInterceptionStats;
    private ipcPath: string | undefined;
    private pluginEngine: any;
    private originalConsole: Record<string, any> = {};
    private storage = new AsyncLocalStorage<boolean>();
    private hasSyncedConfig = false;
    private recentRawMessages: string[] = [];
    /** Counter for head mode: how many lines have been displayed so far */
    private displayLineCount = 0;
    /** Circular buffer for tail mode: holds the last N processed lines */
    private displayTailBuffer: string[] = [];

    public static getInstance(logger: Logger): ConsoleInterceptor {
        if (!ConsoleInterceptor.instance) {
            ConsoleInterceptor.instance = new ConsoleInterceptor(logger);
        }
        return ConsoleInterceptor.instance;
    }

    constructor(logger: Logger) {
        this.logger = logger;
        const globalConfig = Configs.get("logging")?.consoleInterception;

        // Use Configs.merge to combine defaults with existing config
        Configs.merge({
            logging: {
                consoleInterception: mergeWithDefaults(
                    DEFAULT_CONSOLE_CONFIG,
                    (globalConfig as any) || {},
                ),
            },
        });

        this.config = Configs.get("logging")
            ?.consoleInterception as ConsoleInterceptionConfig;

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

    /**
     * Decides whether a log line should be displayed given the current displayLimit config.
     * In `head` mode, only the first N lines are allowed through.
     * In `tail` mode, lines are always buffered; the buffer is printed on each new log.
     *
     * @returns true  when the line should be printed immediately (head/no-limit),
     *          false when suppressed (head limit reached) or deferred (tail, handled internally).
     */
    private shouldAllowDisplay(
        finalMsg: string,
        preserve: any,
        targetConsole: ((...a: any[]) => void) | undefined,
    ): boolean {
        const limit =
            preserve && typeof preserve === "object"
                ? (preserve as any).displayLimit
                : undefined;

        if (!limit || !limit.maxLines) {
            // No limit configured — always allow
            return true;
        }

        const mode: "head" | "tail" = limit.mode || "tail";
        const max: number = limit.maxLines;

        if (mode === "head") {
            if (this.displayLineCount >= max) {
                // Suppress: head limit already reached
                return false;
            }
            this.displayLineCount++;
            return true;
        }

        // tail mode: maintain a circular buffer and reprint
        if (this.displayTailBuffer.length >= max) {
            this.displayTailBuffer.shift();
        }
        this.displayTailBuffer.push(finalMsg);

        // Clear terminal lines equal to current buffer length, then reprint
        if (process.stdout.isTTY) {
            // Move cursor up by buffer length - 1 (the new entry is not yet printed)
            const linesToClear = this.displayTailBuffer.length - 1;
            if (linesToClear > 0) {
                process.stdout.write(`\x1b[${linesToClear}A\x1b[0J`);
            }
            this.displayTailBuffer.forEach((line) => targetConsole?.(line));
        } else {
            // Non-TTY (piped output, CI): just print the line normally
            return true;
        }

        // Already printed internally — skip the outer targetConsole call
        return false;
    }

    public async start(): Promise<void> {
        if (!this.config.enabled || this.isIntercepting) {
            return;
        }

        try {
            // Always patch console if enabled
            this.patchConsole();
            this.isIntercepting = true;
            this.stats.isActive = true;

            // Try to sync config if IPC is already available
            this.ipcPath = process.env.XYPRISS_IPC_PATH;
            if (this.ipcPath) {
                const ipc = new XHSCDirectIPC(this.ipcPath);
                await ipc.sendCommand("console", "update-config", this.config);
                ipc.close();
            }
        } catch (err: any) {
            // Silently fail in start - will retry in delegation
        }
    }

    private patchConsole(): void {
        const methods = this.config.interceptMethods || [
            "log",
            "error",
            "warn",
            "info",
            "debug",
        ];

        // Save all original console methods first
        const allMethods = ["log", "error", "warn", "info", "debug", "trace"];
        allMethods.forEach((m) => {
            if (typeof (console as any)[m] === "function") {
                // IMPORTANT: Do NOT overwrite if already saved to avoid recursive patching traps
                if (
                    !this.originalConsole[m] ||
                    !(console as any)[m].__isIntercepted
                ) {
                    this.originalConsole[m] = (console as any)[m];
                }
            }
        });

        // this.originalConsole.log?.(
        //     `[ConsoleInterceptor] Patching methods: ${methods.join(", ")}`,
        // );

        methods.forEach((method) => {
            if (typeof (console as any)[method] !== "function") return;

            // Prevent double patching
            if ((console as any)[method].__isIntercepted) return;

            (console as any)[method] = async (...args: any[]) => {
                if (this.storage.getStore() || !this.isIntercepting) {
                    return (this.originalConsole[method] || console.log).apply(
                        console,
                        args,
                    );
                }

                await this.storage.run(true, async () => {
                    try {
                        const message = args
                            .map((arg) =>
                                typeof arg === "object"
                                    ? JSON.stringify(arg)
                                    : String(arg),
                            )
                            .join(" ");

                        const level = this.methodToLevel(method);

                        // Trigger onLog if provided
                        if (typeof this.config.onLog === "function") {
                            try {
                                this.config.onLog({
                                    level,
                                    method,
                                    message,
                                    args,
                                });
                            } catch (e) {
                                // silent
                            }
                        }

                        const preserve = this.config.preserveOriginal;
                        const isObject =
                            preserve && typeof preserve === "object";
                        const allowDuplication = isObject
                            ? (preserve as any).allowDuplication
                            : true;

                        if (allowDuplication === false) {
                            // Check if message is in the last 20 logs (sliding window deduplication)
                            const cacheKey = `${level}:${message}`;
                            if (this.recentRawMessages.includes(cacheKey)) {
                                return; // Suppress duplicate log in sliding window
                            }
                            this.recentRawMessages.push(cacheKey);
                            if (this.recentRawMessages.length > 20) {
                                this.recentRawMessages.shift(); // Keep last 20 logs
                            }
                        }

                        const mode = isObject
                            ? (preserve as any).mode || "intercepted"
                            : preserve === true
                              ? "original"
                              : preserve === false
                                ? "none"
                                : "intercepted";

                        // this.originalConsole.log?.(`[DEBUG] Intercepting: "${message.substring(0, 30)}...", Mode: ${mode}`);

                        // Delegate to XHSC - AWAIT it to honor filtering
                        await this.delegateToXHSC(message, level, method, args);

                        // If mode is original or both, handle separate from delegation (which happens after await or before)
                        // Actually, to preserve original correctly and allow duplication without delay, we should do it here
                        if (
                            mode === "original" ||
                            mode === "both" ||
                            (mode === "none" && preserve === true)
                        ) {
                            // Fallback handling
                            if (mode !== "none") {
                                this.handlePreserveOriginal(
                                    method,
                                    args,
                                    message,
                                );
                            }
                        }
                    } catch (err: any) {
                        this.originalConsole.error?.(
                            "[ConsoleInterceptor] Error in patch:",
                            err.message,
                        );
                    }
                });
            };

            // Mark as intercepted
            (console as any)[method].__isIntercepted = true;
        });
    }

    private async delegateToXHSC(
        message: string,
        level: string,
        method: string,
        args: any[],
    ): Promise<void> {
        const ipcPath = this.ipcPath || process.env.XYPRISS_IPC_PATH;
        if (!ipcPath) {
            return;
        }

        // Cache it if found and sync config
        if (!this.ipcPath || !this.hasSyncedConfig) {
            this.ipcPath = ipcPath;
            try {
                const ipcConfig = { ...this.config };
                if (ipcConfig.filters) {
                    const mapPatterns = (patterns?: any[]) =>
                        patterns?.map((p) =>
                            p instanceof RegExp ? p.source : p,
                        ) || [];

                    ipcConfig.filters = {
                        ...ipcConfig.filters,
                        includePatterns: mapPatterns(
                            ipcConfig.filters.includePatterns,
                        ),
                        excludePatterns: mapPatterns(
                            ipcConfig.filters.excludePatterns,
                        ),
                        userAppPatterns: mapPatterns(
                            ipcConfig.filters.userAppPatterns,
                        ),
                        systemPatterns: mapPatterns(
                            ipcConfig.filters.systemPatterns,
                        ),
                    };
                }
                const ipc = new XHSCDirectIPC(ipcPath);
                await ipc.sendCommand("console", "update-config", ipcConfig);
                ipc.close();
                this.hasSyncedConfig = true;
            } catch (err) {
                // Ignore sync errors for now, will retry next time
                return;
            }
        }

        try {
            const ipc = new XHSCDirectIPC(ipcPath);
            const res = await ipc.sendCommand("console", "intercept", {
                message,
                level,
                worker_id: 0,
            });
            ipc.close();

            if (res) {
                // this.originalConsole.log?.(`[DEBUG] XHSC Response: processed=${!!res.processed}, level=${res.level}`);

                if (res.processed) {
                    const preserve = this.config.preserveOriginal;
                    const isObject = preserve && typeof preserve === "object";
                    const mode = isObject
                        ? (preserve as any).mode || "intercepted"
                        : preserve === true
                          ? "original"
                          : preserve === false
                            ? "none"
                            : "intercepted";

                    if (mode === "intercepted" || mode === "both") {
                        const separateStreams =
                            isObject && (preserve as any).separateStreams;
                        const onlyUserApp =
                            isObject && (preserve as any).onlyUserApp;

                        let shouldDisplay = true;
                        if (onlyUserApp) {
                            if (!res.processed.includes("[USERAPP]")) {
                                shouldDisplay = false;
                            }
                        }

                        if (shouldDisplay) {
                            const targetConsole =
                                separateStreams &&
                                (level === "error" || level === "warn")
                                    ? this.originalConsole[level] ||
                                      this.originalConsole.error
                                    : this.originalConsole.log;

                            let finalMsg = res.processed;
                            const showPrefix = isObject
                                ? (preserve as any).showPrefix
                                : true;
                            if (showPrefix === false) {
                                finalMsg = finalMsg.replace(
                                    /^.*?\d{2}:\d{2}:\d{2}\.\d{3}.*?\[.*?\]\[W\d+\].*?\s/,
                                    "",
                                );
                            }

                            const allowed = this.shouldAllowDisplay(
                                finalMsg,
                                preserve,
                                targetConsole,
                            );
                            if (allowed) {
                                targetConsole?.(finalMsg);
                            }
                        }
                    }

                    // Trigger plugin hooks with processed data
                    this.handleNativeLog({
                        level: res.level || level,
                        message: res.processed,
                        timestamp: new Date(),
                        component: "userApp",
                        args: args,
                    });
                } else {
                    // Log was filtered out by XHSC
                    this.stats.droppedMessages =
                        (this.stats.droppedMessages || 0) + 1;
                }
            } else {
                this.originalConsole.warn?.(
                    "[ConsoleInterceptor] XHSC returned null response",
                );
            }
        } catch (err: any) {
            this.originalConsole.error?.(
                "[ConsoleInterceptor] Delegation failed:",
                err.message,
            );
        }
    }

    private methodToLevel(method: string): string {
        switch (method) {
            case "error":
                return "error";
            case "warn":
                return "warn";
            case "debug":
            case "trace":
                return "debug";
            default:
                return "info";
        }
    }

    private handlePreserveOriginal(
        method: string,
        args: any[],
        _message: string,
    ): void {
        const preserve = this.config.preserveOriginal;
        if (!preserve) return;

        const isEnabled =
            typeof preserve === "boolean" ? preserve : preserve.enabled;
        if (!isEnabled) return;

        const mode =
            preserve && typeof preserve === "object"
                ? preserve.mode || "intercepted"
                : "original";

        if (mode === "original" || mode === "both") {
            let prefix = "";
            if ((preserve as any).showPrefix !== false) {
                prefix = (preserve as any).customPrefix || "[Original]";
            }

            const colorize = (preserve as any).colorize;
            if (colorize && prefix) {
                // simple ANSI color for prefix
                prefix = `\x1b[36m${prefix}\x1b[0m`;
                // If it's an error level, make it red
                if (method === "error") {
                    args = [`\x1b[31m`, ...args, `\x1b[0m`];
                } else if (method === "warn") {
                    args = [`\x1b[33m`, ...args, `\x1b[0m`];
                }
            }

            const separateStreams = (preserve as any).separateStreams;
            let logMethod = method;
            if (separateStreams) {
                if (method !== "error" && method !== "warn") logMethod = "log";
            } else {
                logMethod = "log"; // default everything to log if not separated
            }

            if (prefix) {
                this.originalConsole[logMethod]?.apply(console, [
                    prefix,
                    ...args,
                ]);
            } else {
                this.originalConsole[logMethod]?.apply(console, args);
            }
        }
    }

    public async stop(): Promise<void> {
        if (!this.isIntercepting) return;

        // Restore original console
        Object.keys(this.originalConsole).forEach((method) => {
            (console as any)[method] = this.originalConsole[method];
        });
        this.originalConsole = {};

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


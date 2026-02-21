/**
 * Logger.ts
 * Centralized logger for FastApi.ts — structured, typed, and console-friendly.
 *
 * Output format:  {gray timestamp} {color}[COMPONENT]{/} {color}message{/}
 *
 * Color logic:
 *  - error   → bright red   (level always wins)
 *  - warn    → yellow       (level always wins)
 *  - debug   → magenta      (level always wins)
 *  - verbose → gray         (level always wins)
 *  - info / startup / perf / etc. → component identity color
 */

import type {
    LogLevel,
    LogComponent,
    LogType,
    LogBuffer,
    LogEntry,
} from "../types";
import type { ServerOptions } from "../../src/types/types";

// ─────────────────────────────────────────────
// ANSI palette
// ─────────────────────────────────────────────

const C = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",
    gray: "\x1b[90m",
    white: "\x1b[37m",
    red: "\x1b[31m",
    brightRed: "\x1b[91m",
    yellow: "\x1b[33m",
    green: "\x1b[32m",
    brightGreen: "\x1b[92m",
    cyan: "\x1b[36m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
} as const;

/**
 * Whether to emit ANSI codes.
 * We intentionally do NOT check isTTY — VS Code integrated terminal, Bun, and
 * most modern runners fully support ANSI but often report isTTY = false.
 * To disable colors, set the NO_COLOR env var (https://no-color.org).
 */
const canColor = (): boolean =>
    typeof process === "undefined" || !("NO_COLOR" in process.env);

// ─────────────────────────────────────────────
// Level rank  (no badge — we display component, not level label)
// ─────────────────────────────────────────────

const LEVEL_RANK: Record<LogLevel, number> = {
    silent: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
    verbose: 5,
};

/**
 * When the level is error / warn / debug / verbose the entire line uses this
 * color instead of the component identity color, so severity is unmistakable.
 */
const LEVEL_COLOR: Partial<Record<LogLevel, string>> = {
    error: C.brightRed,
    warn: C.yellow,
    debug: C.magenta,
    verbose: C.gray,
};

/**
 * Identity color per component — used for info-class messages where the level
 * does not override the color.
 */
const COMPONENT_COLOR: Partial<Record<LogComponent, string>> = {
    server: C.green,
    cache: C.cyan,
    cluster: C.blue,
    performance: C.magenta,
    fileWatcher: C.cyan,
    plugins: C.blue,
    security: C.yellow,
    monitoring: C.green,
    routes: C.cyan,
    userApp: C.white,
    middleware: C.blue,
    router: C.cyan,
    typescript: C.blue,
    acpes: C.magenta,
    other: C.white,
    ipc: C.green,
    memory: C.yellow,
    lifecycle: C.brightGreen,
    routing: C.cyan,
    xems: C.magenta,
    console: C.white,
};

// ─────────────────────────────────────────────
// Default configuration
// ─────────────────────────────────────────────

type LoggerConfig = NonNullable<ServerOptions["logging"]>;

const DEFAULT_CONFIG: LoggerConfig = {
    enabled: true,
    level: "info",
    components: {
        server: true,
        cache: true,
        cluster: true,
        performance: true,
        fileWatcher: true,
        plugins: true,
        security: true,
        monitoring: true,
        routes: true,
        userApp: true,
        middleware: true,
        router: true,
        typescript: true,
        acpes: true,
        other: true,
        ipc: true,
        memory: true,
        lifecycle: true,
        routing: true,
        xems: true,
        console: false, // noisy by default
    },
    types: {
        startup: true,
        warnings: true,
        errors: true,
        performance: true,
        debug: false,
        hotReload: true,
        portSwitching: true,
        lifecycle: true,
    },
    format: {
        timestamps: true,
        colors: true,
        prefix: true,
        compact: false,
        includeMemory: false,
        includeProcessId: false,
        maxLineLength: 0,
    },
    buffer: {
        enabled: false,
        maxSize: 1000,
        flushInterval: 5000,
        autoFlush: true,
    },
    errorHandling: {
        maxErrorsPerMinute: 100,
        suppressRepeatedErrors: true,
        suppressAfterCount: 5,
        resetSuppressionAfter: 300_000,
    },
};

// ─────────────────────────────────────────────
// Logger
// ─────────────────────────────────────────────

export class Logger {
    // ── Singleton ────────────────────────────

    private static instance: Logger;

    public static getInstance(config?: LoggerConfig): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(config);
        } else if (config) {
            Logger.instance.updateConfig(config);
        }
        return Logger.instance;
    }

    // ── Instance state ───────────────────────

    private config: LoggerConfig;
    private buffer!: LogBuffer;
    private flushTimer?: NodeJS.Timeout;
    private isDisposed = false;

    private logQueue: LogEntry[] = [];
    private isProcessingQueue = false;

    private errorCount = 0;
    private lastErrorTime = 0;
    private suppressedComponents = new Set<LogComponent>();

    // ─────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────

    constructor(config?: LoggerConfig) {
        this.config = this.deepMerge(DEFAULT_CONFIG, config ?? {});
        this.initBuffer();
        this.initErrorHandling();
    }

    // ─────────────────────────────────────────
    // Public API — logging methods
    // ─────────────────────────────────────────

    public error(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("error", component, "errors", message, ...args);
    }

    public warn(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("warn", component, "warnings", message, ...args);
    }

    public info(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("info", component, undefined, message, ...args);
    }

    public debug(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("debug", component, "debug", message, ...args);
    }

    public verbose(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("verbose", component, "debug", message, ...args);
    }

    // ── Semantic helpers ─────────────────────

    public startup(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("info", component, "startup", message, ...args);
    }

    public performance(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("info", component, "performance", message, ...args);
    }

    public hotReload(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("info", component, "hotReload", message, ...args);
    }

    public portSwitching(
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        this.log("info", component, "portSwitching", message, ...args);
    }

    public securityWarning(message: string, ...args: any[]): void {
        this.log("warn", "security", "warnings", message, ...args);
    }

    // ─────────────────────────────────────────
    // Public API — config / lifecycle
    // ─────────────────────────────────────────

    public updateConfig(config: LoggerConfig): void {
        const prev = this.config;
        this.config = this.deepMerge(this.config, config ?? {});

        const bufferChanged =
            prev?.buffer?.enabled !== this.config?.buffer?.enabled ||
            prev?.buffer?.autoFlush !== this.config?.buffer?.autoFlush;

        if (bufferChanged) this.initBuffer();
    }

    public getConfig(): LoggerConfig {
        return this.config;
    }
    public getLevel(): LogLevel {
        return this.config?.level ?? "info";
    }
    public isEnabled(): boolean {
        return this.config?.enabled ?? false;
    }

    public isComponentEnabled(component: LogComponent): boolean {
        const cfg = this.config?.componentLevels?.[component];
        if (cfg && typeof cfg === "object") return cfg.enabled !== false;
        return this.config?.components?.[component] !== false;
    }

    public isTypeEnabled(type: LogType): boolean {
        return this.config?.types?.[type] !== false;
    }

    public getStats() {
        return {
            errorCount: this.errorCount,
            lastErrorTime: this.lastErrorTime,
            suppressedComponents: Array.from(this.suppressedComponents),
            bufferSize: this.buffer.entries.length,
            queueSize: this.logQueue.length,
        };
    }

    public clearSuppression(): void {
        this.suppressedComponents.clear();
        this.errorCount = 0;
        this.lastErrorTime = 0;
    }

    public flush(): void {
        if (this.buffer.entries.length === 0) return;
        const entries = this.buffer.entries.splice(0);
        this.buffer.lastFlush = Date.now();
        entries.forEach((e) => this.writeEntry(e));
    }

    public dispose(): void {
        this.isDisposed = true;

        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }

        this.flush();

        if (this.logQueue.length > 0) {
            this.logQueue.splice(0).forEach((e) => this.writeEntry(e));
        }
    }

    /** Create a scoped child logger inheriting (and optionally overriding) config. */
    public child(
        _component: LogComponent,
        config?: Partial<LoggerConfig>,
    ): Logger {
        return new Logger(this.deepMerge(this.config, config ?? {}));
    }

    // ─────────────────────────────────────────
    // Core — log pipeline
    // ─────────────────────────────────────────

    private log(
        level: LogLevel,
        component: LogComponent,
        type: LogType | undefined,
        message: string,
        ...args: any[]
    ): void {
        try {
            if (!this.shouldLog(level, component, type, message)) return;

            const entry: LogEntry = {
                timestamp: new Date(),
                level,
                component,
                type,
                message,
                args,
                processId: this.readProcessId(),
                memory: this.readMemoryMB(),
            };

            this.logQueue.push(entry);
            this.drainQueue();
        } catch (err) {
            this.emergencyLog("error", "server", "Logging failed", err);
        }
    }

    private drainQueue(): void {
        if (this.isProcessingQueue || this.logQueue.length === 0) return;
        this.isProcessingQueue = true;

        try {
            while (this.logQueue.length > 0) {
                const entry = this.logQueue.shift()!;

                if (this.config?.buffer?.enabled) {
                    this.buffer.entries.push(entry);
                    if (this.buffer.entries.length >= this.buffer.maxSize)
                        this.flush();
                } else {
                    this.writeEntry(entry);
                }
            }
        } catch (err) {
            this.emergencyLog("error", "server", "Queue drain failed", err);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    // ─────────────────────────────────────────
    // Core — shouldLog gate
    // ─────────────────────────────────────────

    private shouldLog(
        level: LogLevel,
        component: LogComponent,
        type?: LogType,
        message?: string,
    ): boolean {
        if (this.isDisposed) return false;
        if (!this.config?.enabled) return false;
        if (this.config?.level === "silent") return false;

        if (level === "error" && this.shouldSuppressError(component))
            return false;

        // Errors always pass (unless suppressed above)
        if (level === "error") return true;

        // Resolve effective level — component override takes precedence
        let effectiveLevel: LogLevel = this.config?.level ?? "info";
        const compCfg = this.config?.componentLevels?.[component];

        if (compCfg) {
            if (typeof compCfg === "string") {
                effectiveLevel = compCfg;
            } else if (typeof compCfg === "object") {
                if (compCfg.enabled === false) return false;
                if (compCfg.level) effectiveLevel = compCfg.level;
                if (type && compCfg.types?.[type] === false) return false;

                if (message && compCfg.suppressPatterns) {
                    for (const pattern of compCfg.suppressPatterns) {
                        const hit =
                            typeof pattern === "string"
                                ? message.includes(pattern)
                                : pattern.test(message);
                        if (hit) return false;
                    }
                }
            }
        }

        // Level hierarchy gate
        if (LEVEL_RANK[level] > LEVEL_RANK[effectiveLevel]) return false;

        // Component toggle (legacy flat map)
        if (this.config?.components?.[component] === false) return false;

        // Type toggle
        if (type && this.config?.types?.[type] === false) return false;

        return true;
    }

    private shouldSuppressError(component: LogComponent): boolean {
        if (!this.config?.errorHandling?.suppressRepeatedErrors) return false;

        const now = Date.now();
        const maxErrors = this.config.errorHandling?.maxErrorsPerMinute ?? 100;

        if (now - this.lastErrorTime > 60_000) {
            this.errorCount = 0;
            this.suppressedComponents.clear();
        }

        this.errorCount++;
        this.lastErrorTime = now;

        if (this.errorCount > maxErrors) {
            this.suppressedComponents.add(component);
            return true;
        }

        return this.suppressedComponents.has(component);
    }

    // ─────────────────────────────────────────
    // Core — output
    // ─────────────────────────────────────────

    private writeEntry(entry: LogEntry): void {
        try {
            if (this.config?.customLogger) {
                this.config.customLogger(
                    entry.level,
                    entry.component,
                    entry.message,
                    ...entry.args,
                );
                return;
            }

            const line = this.formatEntry(entry);

            switch (entry.level) {
                case "error":
                    console.error(line, ...entry.args);
                    break;
                case "warn":
                    console.warn(line, ...entry.args);
                    break;
                default:
                    console.log(line, ...entry.args);
                    break;
            }
        } catch (err) {
            this.emergencyLog("error", "server", "writeEntry failed", err);
        }
    }

    // ─────────────────────────────────────────
    // Core — formatting
    // ─────────────────────────────────────────

    /**
     * Produces a log line:
     *
     *   {gray}HH:MM:SS.mmm{/} {color}[COMPONENT]{/} {color}message{/}
     *
     * Color priority:
     *   1. Level color  — error=brightRed, warn=yellow, debug=magenta, verbose=gray
     *   2. Component color — each component has its own identity color (for info-class)
     *
     * Tag and message always share the same color so they read as one visual unit.
     */
    private formatEntry(entry: LogEntry): string {
        const colors = canColor() && this.config?.format?.colors !== false;
        const compact = this.config?.format?.compact ?? false;

        // Active color: level wins for error/warn/debug/verbose; else component identity
        const lineColor =
            LEVEL_COLOR[entry.level] ??
            COMPONENT_COLOR[entry.component] ??
            C.white;

        // ── Timestamp (gray) ──────────────────
        let timestamp = "";
        if (this.config?.format?.timestamps !== false) {
            const t = entry.timestamp;
            const hh = t.getHours().toString().padStart(2, "0");
            const mm = t.getMinutes().toString().padStart(2, "0");
            const ss = t.getSeconds().toString().padStart(2, "0");
            const ms = t.getMilliseconds().toString().padStart(3, "0");
            const raw = `${hh}:${mm}:${ss}.${ms}`;
            timestamp = colors ? `${C.gray}${raw}${C.reset}` : raw;
        }

        // ── [COMPONENT] tag ───────────────────
        const label = this.componentLabel(entry.component);
        const tag = colors
            ? `${lineColor}${C.bold}[${label}]${C.reset}`
            : `[${label}]`;

        // ── Message (same color as tag) ───────
        let msg = this.truncate(entry.message);
        if (colors) msg = `${lineColor}${msg}${C.reset}`;

        // ── Optional extras (pid, memory) ─────
        const extras: string[] = [];
        if (entry.processId !== undefined) {
            const s = `pid:${entry.processId}`;
            extras.push(colors ? `${C.gray}${s}${C.reset}` : s);
        }
        if (entry.memory !== undefined) {
            const s = `${entry.memory}MB`;
            extras.push(colors ? `${C.gray}${s}${C.reset}` : s);
        }

        // ── Compact mode ──────────────────────
        if (compact) {
            return [`[${label}]`, ...extras, msg].join(" ");
        }

        // ── Standard: timestamp [TAG] message ─
        const right = [tag, ...extras, msg].join(" ");
        return timestamp ? `${timestamp} ${right}` : right;
    }

    // ─────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────

    /** Human-readable uppercase label for a component. */
    private componentLabel(component: LogComponent): string {
        const ALIASES: Partial<Record<LogComponent, string>> = {
            server: "SYSTEM",
            cache: "SIMC",
        };
        return (ALIASES[component] ?? component).toUpperCase();
    }

    private truncate(message: string): string {
        const max = this.config?.format?.maxLineLength ?? 0;
        if (max === 0 || message.length <= max) return message;
        return `${message.substring(0, max - 3)}...`;
    }

    private readMemoryMB(): number | undefined {
        if (!this.config?.format?.includeMemory) return undefined;
        try {
            return typeof process !== "undefined"
                ? Math.round(process.memoryUsage().heapUsed / 1_048_576)
                : undefined;
        } catch {
            return undefined;
        }
    }

    private readProcessId(): number | undefined {
        if (!this.config?.format?.includeProcessId) return undefined;
        try {
            return typeof process !== "undefined" ? process.pid : undefined;
        } catch {
            return undefined;
        }
    }

    /** Bypass all filters — used only for logger-internal failures. */
    private emergencyLog(
        _level: LogLevel,
        component: LogComponent,
        message: string,
        ...args: any[]
    ): void {
        try {
            console.error(
                `${C.gray}${new Date().toISOString()}${C.reset} ${C.brightRed}${C.bold}[EMERGENCY:${component.toUpperCase()}]${C.reset} ${C.brightRed}${message}${C.reset}`,
                ...args,
            );
        } catch {
            process?.stderr?.write(`[LOGGER_FAILURE] ${message}\n`);
        }
    }

    // ─────────────────────────────────────────
    // Init
    // ─────────────────────────────────────────

    private initBuffer(): void {
        this.buffer = {
            entries: [],
            maxSize: this.config?.buffer?.maxSize ?? 1000,
            flushInterval: this.config?.buffer?.flushInterval ?? 5000,
            lastFlush: Date.now(),
        };

        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }

        if (this.config?.buffer?.enabled && this.config?.buffer?.autoFlush) {
            this.flushTimer = setInterval(
                () => this.flush(),
                this.buffer.flushInterval,
            );
        }
    }

    private initErrorHandling(): void {
        // Reset per-minute error counter
        setInterval(() => {
            this.errorCount = 0;
            this.lastErrorTime = 0;

            const resetAfter =
                this.config?.errorHandling?.resetSuppressionAfter ?? 300_000;
            if (Date.now() - this.lastErrorTime > resetAfter) {
                this.suppressedComponents.clear();
            }
        }, 60_000);

        if (typeof process === "undefined") return;

        process.on("uncaughtException", (error: Error) => {
            this.emergencyLog(
                "error",
                "server",
                "Uncaught Exception",
                error.message,
                error.stack,
            );
        });

        process.on(
            "unhandledRejection",
            (reason: unknown, promise: Promise<unknown>) => {
                this.emergencyLog(
                    "error",
                    "server",
                    "Unhandled Promise Rejection",
                    reason,
                    promise,
                );
            },
        );
    }

    // ─────────────────────────────────────────
    // Utility
    // ─────────────────────────────────────────

    private deepMerge<T extends object>(target: T, source: Partial<T>): T {
        const result: any = { ...target };

        for (const key in source) {
            const val = source[key];
            if (
                val !== null &&
                typeof val === "object" &&
                !Array.isArray(val)
            ) {
                result[key] = this.deepMerge(result[key] ?? {}, val as any);
            } else {
                result[key] = val;
            }
        }

        return result as T;
    }
}

// ─────────────────────────────────────────────
// Module helpers
// ─────────────────────────────────────────────

/** Shared singleton — ready to use immediately. */
export const logger = Logger.getInstance();

/** Configure and return the singleton logger. */
export function initializeLogger(config?: LoggerConfig): Logger {
    return Logger.getInstance(config);
}

/** Flush + dispose the singleton — call on graceful shutdown. */
export function cleanupLogger(): void {
    Logger.getInstance().dispose();
}

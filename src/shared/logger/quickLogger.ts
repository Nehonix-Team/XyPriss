
/**
 * ANSI color codes for terminal output
 */
const ANSI = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",

    // Foreground colors
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",

    // Bright foreground
    brightRed: "\x1b[91m",
    brightGreen: "\x1b[92m",
    brightYellow: "\x1b[93m",
    brightBlue: "\x1b[94m",
    brightMagenta: "\x1b[95m",
    brightCyan: "\x1b[96m",
    brightWhite: "\x1b[97m",

    // Background colors
    bgRed: "\x1b[41m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
    bgBlue: "\x1b[44m",
    bgMagenta: "\x1b[45m",
    bgCyan: "\x1b[46m",
} as const;

type LogLevel =
    | "info"
    | "success"
    | "warn"
    | "error"
    | "debug"
    | "http"
    | "swagger"
    | "db"
    | "auth";

interface LogConfig {
    icon: string;
    color: string;
    label: string;
    labelColor: string;
}

const LOG_CONFIGS: Record<LogLevel, LogConfig> = {
    info: {
        icon: "ℹ️ ",
        color: ANSI.brightCyan,
        label: "INFO",
        labelColor: `${ANSI.bgCyan}${ANSI.black}`,
    },
    success: {
        icon: "✅",
        color: ANSI.brightGreen,
        label: "OK",
        labelColor: `${ANSI.bgGreen}${ANSI.black}`,
    },
    warn: {
        icon: "⚠️ ",
        color: ANSI.brightYellow,
        label: "WARN",
        labelColor: `${ANSI.bgYellow}${ANSI.black}`,
    },
    error: {
        icon: "❌",
        color: ANSI.brightRed,
        label: "ERROR",
        labelColor: `${ANSI.bgRed}${ANSI.white}`,
    },
    debug: {
        icon: "🐛",
        color: ANSI.gray,
        label: "DEBUG",
        labelColor: `${ANSI.bgMagenta}${ANSI.white}`,
    },
    http: {
        icon: "🌐",
        color: ANSI.brightBlue,
        label: "HTTP",
        labelColor: `${ANSI.bgBlue}${ANSI.white}`,
    },
    swagger: {
        icon: "🛡️ ",
        color: ANSI.brightMagenta,
        label: "SWAGGER",
        labelColor: `${ANSI.bgMagenta}${ANSI.white}`,
    },
    db: {
        icon: "🗄️ ",
        color: ANSI.yellow,
        label: "DB",
        labelColor: `${ANSI.bgYellow}${ANSI.black}`,
    },
    auth: {
        icon: "🔐",
        color: ANSI.brightYellow,
        label: "AUTH",
        labelColor: `${ANSI.bgYellow}${ANSI.black}`,
    },
};

export class QuickLogger {
    private context: string;
    private static showTimestamp = true;

    constructor(context: string) {
        this.context = context;
    }

    // ─── Static factory ───────────────────────────────────────────────────────

    static for(context: string): QuickLogger {
        return new QuickLogger(context);
    }

    static disableTimestamp(): void {
        QuickLogger.showTimestamp = false;
    }

    // ─── Core log method ──────────────────────────────────────────────────────

    private log(level: LogLevel, ...args: unknown[]): void {
        const cfg = LOG_CONFIGS[level];
        const timestamp = QuickLogger.showTimestamp
            ? `${ANSI.dim}${ANSI.gray}${new Date().toISOString()}${ANSI.reset} `
            : "";
        const label = `${cfg.labelColor}${ANSI.bold} ${cfg.label} ${ANSI.reset}`;
        const ctx = `${ANSI.dim}${ANSI.cyan}[${this.context}]${ANSI.reset}`;

        // First arg gets the level color + icon, rest are passed raw so Node.js
        // pretty-prints objects/arrays/Errors natively (no JSON.stringify needed).
        const [first, ...rest] = args;
        const prefix = `${timestamp}${label} ${ctx} ${cfg.color}${cfg.icon}  ${String(first)}${ANSI.reset}`;

        const consoleFn =
            level === "error"
                ? console.error
                : level === "warn"
                  ? console.warn
                  : console.log;

        rest.length > 0 ? consoleFn(prefix, ...rest) : consoleFn(prefix);
    }

    // ─── Public methods ───────────────────────────────────────────────────────

    info(...args: unknown[]): void {
        this.log("info", ...args);
    }

    success(...args: unknown[]): void {
        this.log("success", ...args);
    }

    warn(...args: unknown[]): void {
        this.log("warn", ...args);
    }

    error(...args: unknown[]): void {
        this.log("error", ...args);
    }

    debug(...args: unknown[]): void {
        this.log("debug", ...args);
    }

    http(...args: unknown[]): void {
        this.log("http", ...args);
    }

    swagger(...args: unknown[]): void {
        this.log("swagger", ...args);
    }

    db(...args: unknown[]): void {
        this.log("db", ...args);
    }

    auth(...args: unknown[]): void {
        this.log("auth", ...args);
    }

    // ─── Convenience: banner / separator ─────────────────────────────────────

    banner(title: string): void {
        const line = `${ANSI.blue}${"─".repeat(60)}${ANSI.reset}`;
        const centered = title
            .padStart(30 + Math.floor(title.length / 2))
            .padEnd(60);
        console.log(`\n${line}`);
        console.log(`${ANSI.bold}${ANSI.brightCyan}${centered}${ANSI.reset}`);
        console.log(`${line}\n`);
    }
}

// ─── Default singleton logger ──────────────────────────────────────────────


// export const logger = QuickLogger.for("");
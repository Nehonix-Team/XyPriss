/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************** */

/**
 * All supported log levels, ordered by increasing severity.
 *
 * | Level     | Rank | Use case                                              |
 * |-----------|------|-------------------------------------------------------|
 * | `debug`   | 0    | Low-level diagnostic traces, dev-only                 |
 * | `info`    | 1    | General operational messages                          |
 * | `success` | 2    | Confirmation that an operation completed successfully |
 * | `warn`    | 3    | Non-fatal issues that deserve attention               |
 * | `error`   | 4    | Recoverable failures — operation did not complete     |
 * | `fatal`   | 5    | Unrecoverable failures — system integrity at risk     |
 *
 * Used as the `minLevel` option to silence everything below a given rank.
 *
 * @example
 * ```ts
 * const log = new LoggerUtils({ minLevel: "warn" });
 * // → only "warn", "error", and "fatal" are printed
 * ```
 */
export type LogLevel =
    | "debug"
    | "info"
    | "success"
    | "warn"
    | "error"
    | "fatal";

/**
 * Configuration options accepted by the {@link LoggerUtils} constructor.
 *
 * All fields are optional — the logger works out of the box with zero config.
 *
 * @example
 * ```ts
 * // Minimal — global logger, all levels visible, ANSI colors on
 * new LoggerUtils();
 *
 * // Scoped production logger — only warnings and above, no colors
 * new LoggerUtils({ namespace: "API", minLevel: "warn", plain: true });
 *
 * // Dev logger with timestamps disabled (cleaner for rapid iteration)
 * new LoggerUtils({ namespace: "Dev", timestamps: false });
 * ```
 */
export interface LoggerOptions {
    /**
     * A short label prepended to every log line, rendered in bold cyan.
     *
     * Namespaces are composable: {@link LoggerUtils.child} automatically
     * concatenates parent and child names with a colon separator.
     *
     * @example
     * ```ts
     * new LoggerUtils({ namespace: "DB" });
     * // output → ... [DB] Connected to postgres
     *
     * const child = log.child("Pool");
     * // output → ... [DB:Pool] Acquired connection
     * ```
     *
     * @default "" (no prefix)
     */
    namespace?: string;

    /**
     * The lowest {@link LogLevel} that will be printed.
     * Any level with a lower rank is silently discarded.
     *
     * Typical environment presets:
     * - Development → `"debug"` (see everything)
     * - Staging     → `"info"`  (skip debug noise)
     * - Production  → `"warn"`  (only actionable signals)
     *
     * @example
     * ```ts
     * const log = new LoggerUtils({ minLevel: "info" });
     * log.debug("Verbose trace"); // ← silently dropped
     * log.info("User signed in"); // ← printed ✔
     * ```
     *
     * @default "debug"
     */
    minLevel?: LogLevel;

    /**
     * When `true`, each line is prefixed with a full `YYYY-MM-DD HH:mm:ss.mmm`
     * timestamp, which helps correlate logs with external events or other systems.
     *
     * Disable when timestamps are added by an outer log aggregator (e.g. Docker,
     * systemd, Datadog) to avoid duplication.
     *
     * @example
     * ```ts
     * new LoggerUtils({ timestamps: false });
     * // output → [INFO] ℹ️  [App] Server started
     * //        (no date prefix)
     * ```
     *
     * @default true
     */
    timestamps?: boolean;

    /**
     * When `true`, all ANSI escape codes (colors, bold, dim) are stripped from
     * the output, producing clean plain text.
     *
     * Recommended for:
     * - CI environments (GitHub Actions, GitLab CI, Jenkins)
     * - Log files that will be processed by grep / awk / sed
     * - Terminals that do not support ANSI (some Windows consoles)
     *
     * @example
     * ```ts
     * const log = new LoggerUtils({ plain: true });
     * log.warn("Disk usage high");
     * // output → [2025-06-01 12:00:00.000] [WARN] ⚠️  Disk usage high
     * ```
     *
     * @default false
     */
    plain?: boolean;
}

// ─── ANSI color palette ───────────────────────────────────────────────────────
const C = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    dim: "\x1b[2m",

    // foreground
    white: "\x1b[97m",
    gray: "\x1b[90m",
    cyan: "\x1b[96m",
    blue: "\x1b[94m",
    green: "\x1b[92m",
    yellow: "\x1b[93m",
    orange: "\x1b[38;5;208m",
    red: "\x1b[91m",
    magenta: "\x1b[95m",

    // background
    bgBlue: "\x1b[44m",
    bgGreen: "\x1b[42m",
    bgYellow: "\x1b[43m",
    bgRed: "\x1b[41m",
    bgMagenta: "\x1b[45m",
    bgCyan: "\x1b[46m",
} as const;

// ─── Level metadata ───────────────────────────────────────────────────────────
interface LevelMeta {
    rank: number;
    badge: string; // fixed-width label shown in the colored badge
    color: string; // badge foreground ANSI code
    bg: string; // badge background ANSI code
    icon: string; // emoji shown after the badge
    msgColor: string; // ANSI code applied to the message text
}

const LEVELS: Record<LogLevel, LevelMeta> = {
    debug: {
        rank: 0,
        badge: " DEBUG ",
        color: C.white,
        bg: C.bgCyan,
        icon: "🔍",
        msgColor: C.gray,
    },
    info: {
        rank: 1,
        badge: "  INFO ",
        color: C.white,
        bg: C.bgBlue,
        icon: "ℹ️ ",
        msgColor: C.white,
    },
    success: {
        rank: 2,
        badge: "  OK   ",
        color: C.white,
        bg: C.bgGreen,
        icon: "✅",
        msgColor: C.green,
    },
    warn: {
        rank: 3,
        badge: "  WARN ",
        color: C.white,
        bg: C.bgYellow,
        icon: "⚠️ ",
        msgColor: C.yellow,
    },
    error: {
        rank: 4,
        badge: " ERROR ",
        color: C.white,
        bg: C.bgRed,
        icon: "❌",
        msgColor: C.red,
    },
    fatal: {
        rank: 5,
        badge: " FATAL ",
        color: C.white,
        bg: C.bgMagenta,
        icon: "💀",
        msgColor: C.magenta,
    },
};

const RANK_ORDER: LogLevel[] = [
    "debug",
    "info",
    "success",
    "warn",
    "error",
    "fatal",
];

// ─── Internal helpers ─────────────────────────────────────────────────────────
function pad2(n: number): string {
    return n.toString().padStart(2, "0");
}

function timestamp(): string {
    const d = new Date();
    const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${d.getMilliseconds().toString().padStart(3, "0")}`;
    return `${date} ${time}`;
}

function formatExtra(extra: unknown[], plain: boolean): string {
    if (!extra.length) return "";
    const serialized = extra.map((e) => {
        if (e instanceof Error) return `\n  ${e.stack ?? e.message}`;
        if (typeof e === "object" && e !== null) {
            try {
                return (
                    "\n  " + JSON.stringify(e, null, 2).replace(/\n/g, "\n  ")
                );
            } catch {
                return String(e);
            }
        }
        return String(e);
    });
    if (plain) return " " + serialized.join(" ");
    return C.dim + " " + serialized.join(" ") + C.reset;
}

// ─── Logger class ─────────────────────────────────────────────────────────────

/**
 * **LoggerUtils** — Structured, colorful console logger for XyPriss.
 *
 * Provides six severity levels, ANSI-colored output, optional namespacing,
 * child loggers, execution timers, and visual log groups — all with zero
 * external dependencies.
 *
 * ---
 *
 * ### Quick start
 * ```ts
 * // Global logger — no configuration needed
 * const log = new LoggerUtils();
 * log.info("App started");
 *
 * // Scoped logger — namespace visible in every line
 * const log = new LoggerUtils({ namespace: "Auth", minLevel: "info" });
 * log.success("User authenticated", { userId: "u_42" });
 * ```
 *
 * ### Log levels (low → high severity)
 * ```ts
 * log.debug("Verbose trace");                          // 🔍 dev-only
 * log.info("Server listening", { port: 3000 });        // ℹ️  general
 * log.success("Migration complete");                   // ✅ confirmation
 * log.warn("Rate limit at 90%", { remaining: 10 });    // ⚠️  attention needed
 * log.error("Payment failed", new Error("Timeout"));   // ❌ recoverable
 * log.fatal("DB unreachable — aborting");              // 💀 unrecoverable
 * ```
 *
 * ### Advanced features
 * ```ts
 * // ── Execution timer
 * const stop = log.time("Fetch users");
 * await fetchUsers();
 * stop(); // → ✅ [Auth] Fetch users — 38 ms
 *
 * // ── Visual group
 * log.group("Bootstrap", () => {
 *   log.info("Loading config");
 *   log.info("Connecting to DB");
 * });
 *
 * // ── Child logger (inherits namespace + options)
 * const dbLog = log.child("DB"); // namespace → "Auth:DB"
 * dbLog.debug("Query plan", { sql: "SELECT ..." });
 *
 * // ── CI / plain-text mode
 * const ciLog = new LoggerUtils({ plain: true });
 * ```
 */
export class LoggerUtils {
    private readonly ns: string;
    private readonly minRank: number;
    private readonly timestamps: boolean;
    private readonly plain: boolean;

    /**
     * Create a new `LoggerUtils` instance.
     *
     * All options are optional — calling `new LoggerUtils()` produces a ready-to-use
     * global logger that prints every level with ANSI colors and timestamps.
     *
     * @param opts - {@link LoggerOptions} configuration bag.
     *
     * @example
     * ```ts
     * // Zero-config global logger
     * const log = new LoggerUtils();
     *
     * // Namespaced, production-safe logger
     * const log = new LoggerUtils({
     *   namespace:  "PaymentService",
     *   minLevel:   "warn",
     *   timestamps: true,
     *   plain:      false,
     * });
     * ```
     */
    constructor(opts: LoggerOptions = {}) {
        this.ns = opts.namespace ?? "";
        this.minRank = LEVELS[opts.minLevel ?? "debug"].rank;
        this.timestamps = opts.timestamps ?? true;
        this.plain = opts.plain ?? false;
    }

    // ── Core (private) ────────────────────────────────────────────────────────

    private emit(level: LogLevel, message: string, ...extra: unknown[]): void {
        const meta = LEVELS[level];
        if (meta.rank < this.minRank) return;

        const method: "log" | "warn" | "error" =
            level === "error" || level === "fatal"
                ? "error"
                : level === "warn"
                  ? "warn"
                  : "log";

        const line = this.plain
            ? this.buildPlain(meta, message, extra)
            : this.buildAnsi(meta, message, extra);

        console[method](line);
    }

    private buildAnsi(
        meta: LevelMeta,
        message: string,
        extra: unknown[],
    ): string {
        const parts: string[] = [];
        if (this.timestamps) parts.push(`${C.dim}${timestamp()}${C.reset}`);
        parts.push(`${meta.bg}${C.bold}${meta.color}${meta.badge}${C.reset}`);
        parts.push(meta.icon);
        if (this.ns) parts.push(`${C.bold}${C.cyan}[${this.ns}]${C.reset}`);
        parts.push(`${meta.msgColor}${message}${C.reset}`);
        parts.push(formatExtra(extra, false));
        return parts.filter(Boolean).join(" ");
    }

    private buildPlain(
        meta: LevelMeta,
        message: string,
        extra: unknown[],
    ): string {
        const parts: string[] = [];
        if (this.timestamps) parts.push(`[${timestamp()}]`);
        parts.push(`[${meta.badge.trim()}]`);
        if (this.ns) parts.push(`[${this.ns}]`);
        parts.push(message);
        parts.push(formatExtra(extra, true));
        return parts.filter(Boolean).join(" ");
    }

    // ── Public log methods ────────────────────────────────────────────────────

    /**
     * Print a **debug** message — rank 0, lowest severity.
     *
     * Use for low-level diagnostic traces that are too noisy for production:
     * variable states, iteration counters, internal decisions.
     * Silenced whenever `minLevel` is set to `"info"` or above.
     *
     * Output style: `🔍` icon · gray message text · cyan `DEBUG` badge.
     *
     * @param message - Human-readable description of what is being traced.
     * @param extra   - Any additional values to print after the message.
     *                  Objects are pretty-printed as indented JSON.
     *                  `Error` instances show the full stack trace.
     *
     * @example
     * ```ts
     * log.debug("Cache miss — fetching from DB", { key: "user:42" });
     * log.debug("Loop iteration", { index: i, total: arr.length });
     * ```
     */
    debug(message: string, ...extra: unknown[]): void {
        this.emit("debug", message, ...extra);
    }

    /**
     * Print an **info** message — rank 1.
     *
     * Use for general operational milestones that are always relevant:
     * server start, feature flags loaded, scheduled job triggered.
     * Visible unless `minLevel` is set to `"success"` or above.
     *
     * Output style: `ℹ️` icon · white message text · blue `INFO` badge.
     *
     * @param message - A concise description of the event.
     * @param extra   - Optional context values (objects, primitives, Errors).
     *
     * @example
     * ```ts
     * log.info("HTTP server listening", { port: 3000, env: "production" });
     * log.info("Feature flag enabled", { flag: "new-checkout-flow" });
     * ```
     */
    info(message: string, ...extra: unknown[]): void {
        this.emit("info", message, ...extra);
    }

    /**
     * Print a **success** message — rank 2.
     *
     * Use to confirm that an operation completed as expected:
     * migration applied, file uploaded, payment processed.
     *
     * Output style: `✅` icon · green message text · green `OK` badge.
     *
     * @param message - What succeeded.
     * @param extra   - Optional result details or metadata.
     *
     * @example
     * ```ts
     * log.success("User authenticated", { userId: "u_42", method: "OAuth" });
     * log.success("Email delivered", { to: "user@example.com", messageId: "msg_7" });
     * ```
     */
    success(message: string, ...extra: unknown[]): void {
        this.emit("success", message, ...extra);
    }

    /**
     * Print a **warn** message — rank 3.
     *
     * Use for non-fatal anomalies that should be investigated but do not
     * stop the current operation: deprecated API usage, high latency,
     * approaching a quota limit, missing optional configuration.
     *
     * Routes to `console.warn` so it appears in the Warnings channel of
     * browser DevTools and some log aggregators.
     *
     * Output style: `⚠️` icon · yellow message text · yellow `WARN` badge.
     *
     * @param message - What is concerning and why.
     * @param extra   - Any relevant context (thresholds, current values, etc.).
     *
     * @example
     * ```ts
     * log.warn("Memory usage above 80%", { usedMb: 820, limitMb: 1024 });
     * log.warn("Deprecated endpoint called", { path: "/v1/users", caller: req.ip });
     * ```
     */
    warn(message: string, ...extra: unknown[]): void {
        this.emit("warn", message, ...extra);
    }

    /**
     * Print an **error** message — rank 4.
     *
     * Use when an operation has failed but the system can continue running:
     * a failed HTTP request, a rejected promise, an unexpected null value.
     * Always pass the originating `Error` object as an extra argument so the
     * stack trace is preserved in the output.
     *
     * Routes to `console.error`.
     *
     * Output style: `❌` icon · red message text · red `ERROR` badge.
     *
     * @param message - What failed.
     * @param extra   - The originating `Error` and/or contextual metadata.
     *
     * @example
     * ```ts
     * try {
     *   await db.query(sql);
     * } catch (err) {
     *   log.error("Query execution failed", err, { sql, params });
     * }
     *
     * log.error("Stripe charge rejected", { code: "card_declined", userId: "u_7" });
     * ```
     */
    error(message: string, ...extra: unknown[]): void {
        this.emit("error", message, ...extra);
    }

    /**
     * Print a **fatal** message — rank 5, highest severity.
     *
     * Use when the system has entered an unrecoverable state and must halt:
     * database unreachable at startup, a required secret missing, an invariant
     * violated that makes further execution unsafe.
     *
     * After calling `fatal`, you should typically terminate the process
     * (`process.exit(1)`) or trigger a circuit-breaker.
     *
     * Routes to `console.error`.
     *
     * Output style: `💀` icon · magenta message text · magenta `FATAL` badge.
     *
     * @param message - What went wrong and why it is unrecoverable.
     * @param extra   - The originating `Error` and/or diagnostic context.
     *
     * @example
     * ```ts
     * if (!process.env.DATABASE_URL) {
     *   log.fatal("DATABASE_URL is not set — cannot start", { env: process.env.NODE_ENV });
     *   process.exit(1);
     * }
     *
     * process.on("uncaughtException", (err) => {
     *   log.fatal("Uncaught exception — shutting down", err);
     *   process.exit(1);
     * });
     * ```
     */
    fatal(message: string, ...extra: unknown[]): void {
        this.emit("fatal", message, ...extra);
    }

    // ── Utilities ─────────────────────────────────────────────────────────────

    /**
     * Start a high-resolution execution timer and return a **stop function**.
     *
     * Call the stop function when the measured work is done; it logs a
     * {@link success} line with the elapsed time in milliseconds (2 decimal places).
     *
     * Internally uses `performance.now()` for sub-millisecond precision.
     *
     * > **Tip:** the stop function can be called multiple times — each call
     * > measures from the original `time()` invocation, so it doubles as a
     * > checkpoint logger.
     *
     * @param label - A short description of the operation being timed.
     *                Shown verbatim in the success message.
     * @returns A zero-argument function that stops the timer and emits the result.
     *
     * @example
     * ```ts
     * // Async operation
     * const stop = log.time("Fetch user profile");
     * const user = await userService.getById(id);
     * stop(); // ✅ [Auth] Fetch user profile — 42.31 ms
     *
     * // Sync operation
     * const stop = log.time("Parse config");
     * const cfg = JSON.parse(raw);
     * stop(); // ✅ Parse config — 0.18 ms
     *
     * // Checkpoint pattern
     * const stop = log.time("DB seed");
     * await insertUsers(users);
     * stop(); // ✅ DB seed — 120 ms  (users done)
     * await insertPosts(posts);
     * stop(); // ✅ DB seed — 380 ms  (total, from start)
     * ```
     */
    time(label: string): () => void {
        const start = performance.now();
        return () => {
            const ms = (performance.now() - start).toFixed(2);
            this.success(`${label} — ${ms} ms`);
        };
    }

    /**
     * Wrap a synchronous callback in a **visually separated log group**.
     *
     * Prints a labeled divider line before and a closing divider after the
     * callback, making it easy to visually isolate related log output (e.g.
     * a startup sequence, a batch job, a request lifecycle).
     *
     * > **Note:** this method is synchronous. For async callbacks, await the
     * > work inside the callback and let the outer caller handle the promise:
     * > ```ts
     * > log.group("Init", () => { /* sync logs only *\/ });
     * > // For async: manually print dividers with log.spacer() instead.
     * > ```
     *
     * @param label - Title shown in the opening divider.
     * @param fn    - Synchronous callback containing the grouped log calls.
     *
     * @example
     * ```ts
     * log.group("Bootstrap", () => {
     *   log.info("Loading environment variables");
     *   log.info("Connecting to PostgreSQL");
     *   log.success("All systems ready");
     * });
     * // ── Bootstrap ────────────────────────────────
     * // ℹ️  Loading environment variables
     * // ℹ️  Connecting to PostgreSQL
     * // ✅ All systems ready
     * // ────────────────────────────────────────────
     *
     * // Nested groups are supported
     * log.group("DB", () => {
     *   log.group("Migrations", () => {
     *     log.success("Applied 3 migrations");
     *   });
     *   log.info("Seeding complete");
     * });
     * ```
     */
    group(label: string, fn: () => void): void {
        const divider = this.plain
            ? `── ${label} ${"─".repeat(Math.max(0, 40 - label.length))}`
            : `${C.bold}${C.cyan}── ${label} ${C.dim}${"─".repeat(Math.max(0, 40 - label.length))}${C.reset}`;

        console.log(divider);
        fn();
        console.log(
            this.plain ? "─".repeat(44) : `${C.dim}${"─".repeat(44)}${C.reset}`,
        );
    }

    /**
     * Create a **child logger** that inherits all options from this instance
     * but appends `subNamespace` to the current namespace with a `:` separator.
     *
     * Child loggers are useful for module or layer-level scoping without
     * repeating configuration. The parent's `minLevel`, `timestamps`, and
     * `plain` settings are all propagated automatically.
     *
     * Namespaces are composed as `"<parent>:<child>"`. Nesting is unlimited:
     * `App → App:DB → App:DB:Pool → App:DB:Pool:Query`.
     *
     * @param subNamespace - The label appended to the current namespace.
     * @returns A new {@link LoggerUtils} instance with the extended namespace.
     *
     * @example
     * ```ts
     * const log     = new LoggerUtils({ namespace: "App", minLevel: "info" });
     * const dbLog   = log.child("DB");       // namespace → "App:DB"
     * const poolLog = dbLog.child("Pool");   // namespace → "App:DB:Pool"
     *
     * dbLog.info("Connected to postgres");
     * // ℹ️  [App:DB] Connected to postgres
     *
     * poolLog.warn("Pool exhausted", { size: 10, waiting: 3 });
     * // ⚠️  [App:DB:Pool] Pool exhausted { size: 10, waiting: 3 }
     *
     * // minLevel is inherited — debug calls on dbLog are silenced too
     * dbLog.debug("This won't print"); // ← silenced (minLevel = "info")
     * ```
     */
    child(subNamespace: string): LoggerUtils {
        return new LoggerUtils({
            namespace: this.ns ? `${this.ns}:${subNamespace}` : subNamespace,
            minLevel: RANK_ORDER[this.minRank],
            timestamps: this.timestamps,
            plain: this.plain,
        });
    }

    /**
     * Emit a **blank line** to the console — no level, no badge, no timestamp.
     *
     * A small but effective tool for creating visual breathing room between
     * unrelated log blocks, section separators, or before a {@link group}.
     *
     * @example
     * ```ts
     * log.success("Phase 1 complete");
     * log.spacer();
     * log.info("Starting phase 2...");
     *
     * // Combine with group for clear section separation
     * log.spacer();
     * log.group("Cleanup", () => {
     *   log.info("Removing temp files");
     * });
     * log.spacer();
     * ```
     */
    spacer(): void {
        console.log();
    }
}


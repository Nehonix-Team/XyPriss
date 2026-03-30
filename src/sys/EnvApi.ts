import {
    EnvAccessError,
    EnvAllOptions,
    EnvGetStrictOptions,
    EnvKeyError,
    EnvSnapshot,
    EnvStoreError,
    FORBIDDEN_VALUE_PATTERN,
    IEnvApi,
    XY_ENV_STORE_KEY,
} from "./api/env/env";
import { XyPrissRunner } from "./XyPrissRunner";

export class EnvApi implements IEnvApi {
    /**
     * The current execution mode. Set once at construction; never mutated.
     */
    public readonly mode: string;

    private readonly runner: XyPrissRunner;

    /**
     * Keys that may pass through the Shield to the real `process.env` without
     * restriction. Stored as a `Set` for O(1) lookup inside the Proxy trap.
     *
     * This list covers OS and Node.js internals required for system stability.
     * Application secrets must never be added here.
     */
    private readonly whitelistedFields: ReadonlySet<string> = new Set([
        "PORT",
        "TERM",
        "PATH",
        "PWD",
        "HOME",
        "USER",
        "LANG",
        "COLORTERM",
        "FORCE_COLOR",
        "TERM_PROGRAM",
        "EDITOR",
        "SHELL",
        "SHLVL",
        "NO_DEPRECATION",
        "DEBUG_FD",
        "DEBUG",
        "NODE_DEBUG",
        "NODE_OPTIONS",
        "NODE_ENV",
        "ENC_SECRET_KEY",
        "ENC_SECRET_SEED",
        "ENC_SECRET_SALT",
        "TRACE_DEPRECATION",
        "APPEND_DEPRECATION",
        "READABLE_STREAM",
        "BUN_CONFIG_VERBOSE_FETCH",
        "XYPRISS_ENV_SHIELD",
        "BUN_DISABLE_DYNAMIC_CHUNK_SIZE",
    ]);

    /**
     * @param runner - The XyPrissRunner used to invoke native Go binaries.
     * @param mode   - The execution mode. Defaults to `"development"`.
     */
    constructor(runner: XyPrissRunner, mode: string = "development") {
        this.runner = runner;
        this.mode = mode;
        this.applyShield();
    }

    // -------------------------------------------------------------------------
    // Write
    // -------------------------------------------------------------------------

    /**
     * Writes a variable to the secure internal store.
     *
     * The key must be non-empty and must not consist solely of whitespace.
     * The value must not contain CR (`\r`), LF (`\n`), or NUL (`\0`) — these
     * characters can corrupt downstream parsers and log sinks.
     *
     * @param key   - Variable name.
     * @param value - Value to store.
     * @throws {EnvKeyError}   When the key or value fails validation.
     * @throws {EnvStoreError} When the store has not been initialised.
     *
     * @example
     * __sys__.__env__.set("MAINTENANCE_MODE", "true");
     *
     * const resolvedBase = resolveBaseUrl(config);
     * __sys__.__env__.set("APP_BASE_URL", resolvedBase);
     */
    public set(key: string, value: string): void {
        this.validateKey(key);
        this.validateValue(key, value);

        const store = this.requireStore();
        store[key] = value;

        // Keep process.env in sync for third-party libraries that read it at
        // startup before the Shield intercepts their access.
        try {
            process.env[key] = value;
        } catch {
            // Shield is locked (writable: false) — the store write is sufficient.
        }
    }

    /**
     * Removes a variable from the secure internal store and from `process.env`.
     * Deleting a key that does not exist is a no-op; no error is thrown.
     *
     * @param key - Variable name to remove.
     * @throws {EnvStoreError} When the store has not been initialised.
     *
     * @example
     * // Revoke a short-lived deployment credential immediately after use
     * __sys__.__env__.delete("CI_DEPLOY_TOKEN");
     */
    public delete(key: string): void {
        const store = this.requireStore();
        delete store[key];

        try {
            delete process.env[key];
        } catch {
            // Shield may block deletion — the store deletion is authoritative.
        }
    }

    // -------------------------------------------------------------------------
    // Read
    // -------------------------------------------------------------------------

    /**
     * Reads a variable from the secure internal store.
     *
     * @param key          - Variable name to look up.
     * @param defaultValue - Fallback when the key is absent.
     * @returns The stored string, or `defaultValue` / `undefined`.
     * @throws {EnvStoreError} When the store has not been initialised.
     *
     * @example
     * // May return undefined — handle it explicitly
     * const region = __sys__.__env__.get("AWS_REGION");
     *
     * // Always returns a string when a default is provided
     * const timeout = __sys__.__env__.get("REQUEST_TIMEOUT_MS", "5000");
     * const ms = parseInt(timeout, 10);
     *
     * // Concise fallback with nullish coalescing
     * const logLevel = __sys__.__env__.get("LOG_LEVEL") ?? "info";
     */
    public get(key: string): string | undefined;
    public get(key: string, defaultValue: string): string;
    public get(key: string, defaultValue?: string): string | undefined {
        const store = this.requireStore();
        const value = store[key];
        return value !== undefined ? value : defaultValue;
    }

    /**
     * Reads a required variable from the secure internal store and throws if
     * it cannot be resolved.
     *
     * Use this method for every variable that is mandatory for application
     * correctness. It surfaces configuration errors at startup rather than
     * silently producing `undefined` at the point of use.
     *
     * @param key     - Variable name to look up.
     * @param options - Optional validation settings.
     * @returns The stored value, guaranteed non-undefined.
     * @throws {EnvAccessError} When the variable is missing or empty.
     * @throws {EnvStoreError}  When the store has not been initialised.
     *
     * @example
     * // Fail fast at boot if a critical variable is absent
     * const databaseUrl = __sys__.__env__.getStrict("DATABASE_URL");
     * const jwtSecret   = __sys__.__env__.getStrict("JWT_SECRET", { rejectEmpty: true });
     * const smtpHost    = __sys__.__env__.getStrict("SMTP_HOST");
     *
     * // Collect all required variables once at module initialisation
     * const config = {
     *   db:   __sys__.__env__.getStrict("DATABASE_URL"),
     *   jwt:  __sys__.__env__.getStrict("JWT_SECRET", { rejectEmpty: true }),
     *   smtp: __sys__.__env__.getStrict("SMTP_HOST"),
     * };
     */
    public getStrict(key: string, options?: EnvGetStrictOptions): string {
        const store = this.requireStore();
        const value = store[key];

        if (value === undefined) {
            throw new EnvAccessError(key, "missing");
        }
        if (options?.rejectEmpty && value === "") {
            throw new EnvAccessError(key, "empty");
        }

        return value;
    }

    /**
     * Returns `true` when the given key is present in the secure internal
     * store, regardless of its value (including empty strings).
     *
     * @param key - Variable name to test.
     * @throws {EnvStoreError} When the store has not been initialised.
     *
     * @example
     * if (__sys__.__env__.has("SENTRY_DSN")) {
     *   Sentry.init({ dsn: __sys__.__env__.get("SENTRY_DSN") });
     * }
     *
     * const betaEnabled = __sys__.__env__.has("ENABLE_BETA_UI");
     */
    public has(key: string): boolean {
        const store = this.requireStore();
        return store[key] !== undefined;
    }

    /**
     * Returns a frozen, point-in-time snapshot of stored variables.
     *
     * The object is frozen at the moment of the call; subsequent `set` or
     * `delete` calls do not affect it.
     *
     * Providing `options.keys` is strongly recommended in production code.
     * Returning the full store risks inadvertently capturing secrets in log
     * statements or JSON serialisations.
     *
     * @param options - Optional filter configuration.
     * @returns A frozen {@link EnvSnapshot}.
     * @throws {EnvStoreError} When the store has not been initialised.
     *
     * @example
     * // Filtered snapshot — preferred in all production code paths
     * const dbConfig = __sys__.__env__.all({
     *   keys: ["DATABASE_URL", "DATABASE_POOL_SIZE", "DATABASE_TIMEOUT_MS"],
     * });
     *
     * // Full snapshot — use only for diagnostics / startup validation
     * const full = __sys__.__env__.all();
     * logger.debug("Env snapshot", { count: Object.keys(full).length });
     */
    public all(options?: EnvAllOptions): EnvSnapshot {
        const store = this.requireStore();

        if (options?.keys && options.keys.length > 0) {
            const subset: Record<string, string | undefined> = {};
            for (const key of options.keys) {
                subset[key] = store[key];
            }
            return Object.freeze(subset);
        }

        return Object.freeze({ ...store });
    }

    // -------------------------------------------------------------------------
    // Mode helpers
    // -------------------------------------------------------------------------

    /**
     * Returns `true` when the execution mode is `"production"`.
     *
     * @example
     * const logger = createLogger({
     *   level: __sys__.__env__.isProduction() ? "error" : "debug",
     * });
     */
    public isProduction(): boolean {
        return this.mode === "production";
    }

    /**
     * Returns `true` when the execution mode is `"development"`.
     *
     * @example
     * if (__sys__.__env__.isDevelopment()) {
     *   app.use(requestLogger({ colorize: true }));
     * }
     */
    public isDevelopment(): boolean {
        return this.mode === "development";
    }

    /**
     * Returns `true` when the execution mode is `"staging"`.
     *
     * @example
     * if (__sys__.__env__.isStaging()) {
     *   payment.useSandbox();
     * }
     */
    public isStaging(): boolean {
        return this.mode === "staging";
    }

    /**
     * Returns `true` when the execution mode is `"test"`.
     *
     * @example
     * const dbUrl = __sys__.__env__.isTest()
     *   ? __sys__.__env__.getStrict("TEST_DATABASE_URL")
     *   : __sys__.__env__.getStrict("DATABASE_URL");
     */
    public isTest(): boolean {
        return this.mode === "test";
    }

    /**
     * Returns `true` when the execution mode exactly matches `envName`
     * (case-sensitive).
     *
     * @param envName - Mode name to compare against.
     *
     * @example
     * if (__sys__.__env__.is("canary")) {
     *   featureFlags.enableAll();
     * }
     */
    public is(envName: string): boolean {
        return this.mode === envName;
    }

    // -------------------------------------------------------------------------
    // Native / system
    // -------------------------------------------------------------------------

    /**
     * Retrieves the OS-level username of the current process owner by invoking
     * the XHSC native Go binary.
     *
     * This method is synchronous and blocks until the native call completes.
     * Do not call it in request hot paths. Returns `""` on failure so callers
     * can safely use the result without null checks.
     *
     * @returns The current OS username, or `""` on failure.
     *
     * @example
     * const actor = __sys__.__env__.user() || "<unknown>";
     * auditLog.write({ actor, action: "deploy" });
     */
    public user(): string {
        try {
            const result = this.runner.runSync("sys", "user") as {
                username?: string;
            };
            return result?.username ?? "";
        } catch {
            return "";
        }
    }

    // -------------------------------------------------------------------------
    // Private — store access
    // -------------------------------------------------------------------------

    /**
     * Returns the internal store, throwing {@link EnvStoreError} if it has not
     * yet been initialised.
     *
     * SECURITY: This is the single point of store access. Every read and write
     * method must go through here — never access `globalThis[XY_ENV_STORE_KEY]`
     * directly outside this method.
     *
     * Eliminating the `?? process.env` fallback is intentional. A silent
     * fallback to `process.env` during the bootstrap race window would bypass
     * the Shield and leak values without any warning. A thrown error is
     * immediately visible during development and integration testing.
     *
     * @internal
     * @throws {EnvStoreError}
     */
    private requireStore(): Record<string, string | undefined> {
        const store = (globalThis as any)[XY_ENV_STORE_KEY] as
            | Record<string, string | undefined>
            | undefined;

        if (!store) {
            throw new EnvStoreError();
        }

        return store;
    }

    // -------------------------------------------------------------------------
    // Private — validation
    // -------------------------------------------------------------------------

    /**
     * Asserts that `key` is a valid environment variable name.
     *
     * @internal
     * @throws {EnvKeyError}
     */
    private validateKey(key: string): void {
        if (key.length === 0) {
            throw new EnvKeyError(key, "key must not be empty");
        }
        if (key.trim().length === 0) {
            throw new EnvKeyError(
                key,
                "key must not consist solely of whitespace",
            );
        }
    }

    /**
     * Asserts that `value` does not contain characters that can corrupt
     * downstream parsers, log sinks, or HTTP serialisers.
     *
     * Rejected characters:
     * - CR (`\r`) and LF (`\n`) — break line-oriented `.env` parsers and
     *   enable log injection attacks.
     * - NUL (`\0`) — truncates strings in C-based runtimes and can bypass
     *   suffix-based extension checks in some file path handling code.
     *
     * @internal
     * @throws {EnvKeyError}
     */
    private validateValue(key: string, value: string): void {
        if (FORBIDDEN_VALUE_PATTERN.test(value)) {
            throw new EnvKeyError(
                key,
                "value must not contain carriage return (\\r), line feed (\\n), " +
                    "or NUL (\\0) characters — these can corrupt parsers and enable log injection",
            );
        }
    }

    // -------------------------------------------------------------------------
    // Private — Shield
    // -------------------------------------------------------------------------

    /**
     * **Environment Security Shield**
     *
     * Replaces the `process.env` object with a hardened Proxy that enforces
     * the following policies on every property access:
     *
     * **Read trap**
     * - Whitelisted keys (see {@link EnvApi.whitelistedFields}) and keys
     *   matching the prefixes `XY_`, `XYPRISS_`, `ENC_`, `DOTENV_`, or `__`
     *   pass through to the real value.
     * - All other reads return `undefined`. A one-time per-key warning is
     *   written to `process.stderr` (suppressed when
     *   `XYPRISS_ENV_SHIELD=silent`).
     *
     * **`ownKeys` and `has` traps**
     * - Restrict the apparent key set to the whitelist. This prevents
     *   third-party code from enumerating the real store through
     *   `Object.keys(process.env)`, `JSON.stringify(process.env)`, or spread
     *   operators — all of which bypass the `get` trap.
     *
     * The descriptor is applied with `writable: false` to prevent replacement
     * by application code, and `configurable: true` to allow test teardown.
     *
     * @internal
     */
    private applyShield(): void {
        // Per-key deduplication: every distinct blocked key gets exactly one
        // warning, preserving actionable signal without log flooding.
        const warnedKeys = new Set<string>();
        const self = this;

        const envShield = new Proxy(process.env, {
            get(target, prop: string | symbol, receiver) {
                if (typeof prop !== "string") {
                    return Reflect.get(target, prop, receiver);
                }

                // Pass through whitelisted keys and framework-reserved prefixes.
                if (
                    self.whitelistedFields.has(prop) ||
                    prop.startsWith("XY_") ||
                    prop.startsWith("XYPRISS_") ||
                    prop.startsWith("ENC_") ||
                    prop.startsWith("DOTENV_") ||
                    prop.startsWith("__")
                ) {
                    return Reflect.get(target, prop, receiver);
                }

                // Emit one warning per unique blocked key.
                if (!warnedKeys.has(prop)) {
                    const isSilent =
                        // Check store first (preferred), fall back to raw target
                        // only for this specific whitelisted key.
                        (globalThis as any)[XY_ENV_STORE_KEY]?.[
                            "XYPRISS_ENV_SHIELD"
                        ] === "silent" ||
                        target["XYPRISS_ENV_SHIELD"] === "silent";

                    if (!isSilent) {
                        process.stderr.write(
                            `\x1b[33m[SECURITY]\x1b[0m ` +
                                `Direct access to process.env["${prop}"] is blocked. ` +
                                `Use \x1b[36m__sys__.__env__.get("${prop}")\x1b[0m ` +
                                `or \x1b[36m__sys__.__env__.getStrict("${prop}")\x1b[0m instead.\n`,
                        );
                    }
                    warnedKeys.add(prop);
                }

                return undefined;
            },

            // Harden enumeration: restrict what callers see when they iterate
            // or spread process.env. Without this trap, spread operators and
            // Object.keys() bypass the get trap entirely.
            ownKeys(_target) {
                return [...self.whitelistedFields];
            },

            // Align `in` operator behaviour with the restricted key set.
            has(_target, prop: string | symbol) {
                if (typeof prop !== "string") return false;
                return self.whitelistedFields.has(prop);
            },
        });

        try {
            Object.defineProperty(process, "env", {
                value: envShield,
                writable: false,
                configurable: true,
                enumerable: true,
            });
        } catch {
            // Silently degrade — the Shield could not be applied (e.g., inside
            // certain container or VM environments with locked descriptors).
            // The Symbol-keyed internal store remains the authoritative and
            // isolated source for all EnvApi reads.
        }
    }
}


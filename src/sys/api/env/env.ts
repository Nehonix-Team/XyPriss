// ---------------------------------------------------------------------------
// Internal store key — never exported.
//
// Using a module-scoped Symbol as the globalThis property key means that
// external code cannot access the store without a reference to this exact
// Symbol. There is no string key to guess or enumerate.
//
// SECURITY: Do not export or expose this Symbol through any public API.
// ---------------------------------------------------------------------------
export const XY_ENV_STORE_KEY = Symbol("__xy_env_store__");
export const XY_SYS_REGISTER_FS = Symbol("__xy_sys_register_fs__");

// ---------------------------------------------------------------------------
// Internal value sanitisation
//
// Detects byte sequences that can corrupt downstream parsers, log sinks, or
// serialisers when stored as environment variable values.
// ---------------------------------------------------------------------------

/** Characters that are unconditionally rejected in environment variable values. */
export const FORBIDDEN_VALUE_PATTERN = /[\r\n\0]/;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Represents the result of a bulk environment variable retrieval.
 *
 * The object is frozen at the moment of creation. Keys map to their
 * corresponding string values, or `undefined` if the key was requested via
 * `options.keys` but was not present in the store.
 */
export type EnvSnapshot = Readonly<Record<string, string | undefined>>;

/**
 * Options accepted by {@link EnvApi.getStrict} to control validation behaviour.
 */
export interface EnvGetStrictOptions {
    /**
     * When `true`, an empty string is treated as a missing value and triggers
     * the same {@link EnvAccessError} as a completely absent key.
     *
     * @default false
     */
    rejectEmpty?: boolean;
}

/**
 * Options accepted by {@link EnvApi.all}.
 */
export interface EnvAllOptions {
    /**
     * Restricts the snapshot to the listed keys. Keys absent from the store
     * are included with value `undefined`. When omitted, all stored keys are
     * returned.
     *
     * Providing an explicit key list is strongly preferred in production code
     * to avoid accidentally surfacing secrets in logs or serialised payloads.
     *
     * @example
     * const subset = __sys__.__env__.all({
     *   keys: ["DATABASE_URL", "REDIS_URL"],
     * });
     */
    keys?: string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/**
 * Thrown by {@link EnvApi.getStrict} when a required environment variable is
 * absent or — when `rejectEmpty` is set — when it is present but empty.
 *
 * @example
 * try {
 *   const dbUrl = __sys__.__env__.getStrict("DATABASE_URL");
 * } catch (err) {
 *   if (err instanceof EnvAccessError) {
 *     process.exit(1); // Fail fast on missing critical configuration
 *   }
 * }
 */
export class EnvAccessError extends Error {
    /** The variable name that could not be resolved. */
    public readonly key: string;

    constructor(key: string, reason: "missing" | "empty") {
        super(
            reason === "empty"
                ? `Environment variable "${key}" is set but contains an empty value. ` +
                      `Use __sys__.__env__.get("${key}") if an empty value is acceptable.`
                : `Required environment variable "${key}" is not defined. ` +
                      `Ensure it is present in your .env file or execution environment.`,
        );
        this.name = "EnvAccessError";
        this.key = key;
        Object.setPrototypeOf(this, EnvAccessError.prototype);
    }
}

/**
 * Thrown by {@link EnvApi.set} when the key or value fails validation.
 *
 * @example
 * try {
 *   __sys__.__env__.set("", "value");        // empty key
 *   __sys__.__env__.set("FOO", "bar\nbaz");  // newline injection attempt
 * } catch (err) {
 *   if (err instanceof EnvKeyError) {
 *     logger.error("Invalid env write", { key: err.key, reason: err.message });
 *   }
 * }
 */
export class EnvKeyError extends Error {
    public readonly key: string;

    constructor(key: string, reason: string) {
        super(`Invalid environment variable "${key}": ${reason}`);
        this.name = "EnvKeyError";
        this.key = key;
        Object.setPrototypeOf(this, EnvKeyError.prototype);
    }
}

/**
 * Thrown when {@link EnvApi} methods are called before the internal store has
 * been initialised by the XyPriss bootstrap process.
 *
 * This error should never occur in correctly bootstrapped applications.
 * If it does, it indicates that framework initialisation was bypassed.
 */
export class EnvStoreError extends Error {
    constructor() {
        super(
            "The XyPriss environment store has not been initialised. " +
                "Ensure that createServer() has completed before accessing __sys__.__env__.",
        );
        this.name = "EnvStoreError";
        Object.setPrototypeOf(this, EnvStoreError.prototype);
    }
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

/**
 * Public contract for the XyPriss Environment Manager.
 *
 * All access to environment variables within XyPriss applications must go
 * through this interface. Direct use of `process.env` is blocked by the
 * Environment Security Shield and returns `undefined` at runtime.
 *
 * @see {@link EnvApi} for the concrete implementation.
 *
 * @example
 * // Reading with a fallback
 * const port = __sys__.__env__.get("PORT", "3000");
 *
 * // Reading a required variable — throws EnvAccessError if absent
 * const secret = __sys__.__env__.getStrict("JWT_SECRET");
 *
 * // Checking the execution mode
 * if (__sys__.__env__.isProduction()) {
 *   // Apply production hardening
 * }
 */
export interface IEnvApi {
    /**
     * The current execution mode (`"development"`, `"production"`,
     * `"staging"`, `"test"`, or a custom value). Set once at bootstrap;
     * never mutated at runtime.
     */
    readonly mode: string;

    /**
     * Writes an environment variable to the secure internal store.
     *
     * @param key   - Non-empty variable name without surrounding whitespace.
     * @param value - The value to assign. Must not contain CR, LF, or NUL.
     * @throws {EnvKeyError} When the key or value fails validation.
     * @throws {EnvStoreError} When called before store initialisation.
     */
    set(key: string, value: string): void;

    /**
     * Reads an environment variable from the secure internal store.
     *
     * @param key          - The variable name to look up.
     * @param defaultValue - Returned when the key is not defined.
     * @returns The stored value, or `defaultValue` / `undefined`.
     * @throws {EnvStoreError} When called before store initialisation.
     *
     * @example
     * const host = __sys__.__env__.get("HOST", "0.0.0.0");
     */
    get(key: string): string | undefined;
    get(key: string, defaultValue: string): string;
    get(key: string, defaultValue?: string): string | undefined;

    /**
     * Reads a required environment variable. Throws when absent.
     *
     * @param key     - The variable name to look up.
     * @param options - Optional validation settings.
     * @returns The stored value as a guaranteed non-undefined string.
     * @throws {EnvAccessError} When the variable is missing or empty.
     * @throws {EnvStoreError} When called before store initialisation.
     *
     * @example
     * const dbUrl    = __sys__.__env__.getStrict("DATABASE_URL");
     * const jwtKey   = __sys__.__env__.getStrict("JWT_SECRET", { rejectEmpty: true });
     */
    getStrict(key: string, options?: EnvGetStrictOptions): string;

    /**
     * Returns `true` when the variable is present in the store, regardless of
     * its value (including empty strings).
     *
     * @throws {EnvStoreError} When called before store initialisation.
     *
     * @example
     * if (__sys__.__env__.has("SENTRY_DSN")) {
     *   Sentry.init({ dsn: __sys__.__env__.get("SENTRY_DSN") });
     * }
     */
    has(key: string): boolean;

    /**
     * Removes a variable from the secure internal store and from `process.env`.
     * Deleting a non-existent key is a no-op.
     *
     * @throws {EnvStoreError} When called before store initialisation.
     *
     * @example
     * __sys__.__env__.delete("CI_DEPLOY_TOKEN");
     */
    delete(key: string): void;

    /**
     * Returns a frozen, point-in-time snapshot of stored variables.
     *
     * Providing `options.keys` is strongly recommended in production to avoid
     * accidentally capturing secrets in logs or serialised payloads.
     *
     * @throws {EnvStoreError} When called before store initialisation.
     *
     * @example
     * const dbConfig = __sys__.__env__.all({
     *   keys: ["DATABASE_URL", "DATABASE_POOL_SIZE"],
     * });
     */
    all(options?: EnvAllOptions): EnvSnapshot;

    /** Returns `true` when the current execution mode is `"production"`. */
    isProduction(): boolean;

    /** Returns `true` when the current execution mode is `"development"`. */
    isDevelopment(): boolean;

    /** Returns `true` when the current execution mode is `"staging"`. */
    isStaging(): boolean;

    /** Returns `true` when the current execution mode is `"test"`. */
    isTest(): boolean;

    /**
     * Returns `true` when the execution mode matches `envName` exactly
     * (case-sensitive). Useful for custom environments beyond the four presets.
     *
     * @example
     * if (__sys__.__env__.is("canary")) {
     *   featureFlags.enableAll();
     * }
     */
    is(envName: string): boolean;

    /**
     * Returns the OS-level username of the process owner, resolved via the
     * XHSC native binary. Returns `""` on failure.
     *
     * @example
     * const actor = __sys__.__env__.user() || "<unknown>";
     * auditLog.write({ actor, action: "deploy" });
     */
    user(): string;
}


import crypto from "node:crypto";
import {
    EnvAccessError,
    EnvAllOptions,
    EnvGetStrictOptions,
    EnvKeyError,
    EnvSnapshot,
    EnvStoreError,
    FORBIDDEN_VALUE_PATTERN,
    IEnvApi,
    XY_ENV_INTERNAL_GET_FOR_ROOT,
    XY_ENV_CONFIGURE_SHIELD,
} from "./api/env/env";
import { XyPrissRunner } from "./XyPrissRunner";
import {
    captureNativeFrames,
    getCallerProjectRoot,
    getVerifiedCallerInfo,
    isCoreFrameworkPath,
    isEngineCorePath,
    isImmediateInternalEngineCall,
    _StringIncludes,
    _StringReplace,
    _StringStartsWith,
} from "../utils/ProjectDiscovery";
import { logger } from "../shared/logger/Logger";

const _envRunnerStore = new WeakMap<EnvApi, XyPrissRunner>();
const _sealKeyStore = new WeakMap<EnvApi, string>();
const _shieldedInstances = new WeakSet<object>();
const SHIELD_MARKER = Symbol("xypriss.internal.env.shielded");

export class EnvApi implements IEnvApi {
    public readonly mode: string;
    private readonly isDynamic: boolean;

    /**
     * Keys that may pass through the Shield to the real `process.env` without
     * restriction. Stored as a `Set` for O(1) lookup inside the Proxy trap.
     *
     * This list covers OS and Node.js internals required for system stability.
     * Application secrets must never be added here.
     */
    private readonly defaultWhitelist: ReadonlySet<string> = new Set([
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
        "TRACE_DEPRECATION",
        "APPEND_DEPRECATION",
        "READABLE_STREAM",
        "BUN_CONFIG_VERBOSE_FETCH",
        "XYPRISS_ENV_SHIELD",
        "XYPRISS_SHIELD",
        "BUN_DISABLE_DYNAMIC_CHUNK_SIZE",
        // Node / Bun core HTTPS variables (read allowed for network clients, writes strictly guarded in set trap)
        "NODE_TLS_REJECT_UNAUTHORIZED",
        "NODE_EXTRA_CA_CERTS",
        // Standard OS environment paths (Windows / Cross-platform stability)
        "APPDATA",
        "LOCALAPPDATA",
        "USERPROFILE",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "SYSTEMROOT",
        "TEMP",
        "TMP",
    ]);

    private whitelistedFields: Set<string> = new Set(this.defaultWhitelist);

    /**
     * In-memory cache for whitelisted environment variables.
     * Populated directly from the Vault during engine bootstrap, enabling O(1)
     * synchronous reads from process.env without IPC or caller validation conflicts.
     *
     * @see XSA-XESS-019
     */
    private _whitelistedCache: Map<string, string> = new Map();

    /**
     * @param runner - The XyPrissRunner used to invoke native Go binaries.
     * @param mode   - The execution mode. Defaults to `"development"`.
     * @param isDynamic - Whether this EnvApi should use dynamic project discovery (Sandboxing).
     */
    constructor(
        runner: XyPrissRunner,
        mode: string = "development",
        isDynamic: boolean = false,
    ) {
        _envRunnerStore.set(this, runner);

        const sealKey = crypto.randomBytes(32).toString("hex");
        _sealKeyStore.set(this, sealKey);
        try {
            runner.runSync("env", "seal", [sealKey], { __seal__: sealKey, pid: process.pid });
        } catch {}

        this.mode = mode;
        this.isDynamic = isDynamic;
        this.applyShield();
    }

    private getSealKey(): string {
        let key = _sealKeyStore.get(this);
        if (!key) {
            key = crypto.randomBytes(32).toString("hex");
            _sealKeyStore.set(this, key);
        }
        return key;
    }

    private executeEnvCall<T>(action: string, args: string[] = [], options: any = {}): T {
        const sealKey = this.getSealKey();
        const runner = _envRunnerStore.get(this);
        if (!runner) {
            throw new EnvStoreError();
        }
        const optsWithSeal = { ...options, __seal__: sealKey, pid: process.pid };
        try {
            return runner.runSync<T>("env", action, args, optsWithSeal);
        } catch (err: any) {
            if (
                err?.message?.includes("missing environment capability seal") ||
                err?.message?.includes("UNAUTHORIZED")
            ) {
                try {
                    runner.runSync("env", "seal", [sealKey], { __seal__: sealKey, pid: process.pid });
                    return runner.runSync<T>("env", action, args, optsWithSeal);
                } catch {
                    throw err;
                }
            }
            throw err;
        }
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

        const root = this.resolveAuthorizedRoot();
        if (!root) {
            return;
        }

        this.executeEnvCall("set", [key, value], { root });

        // Keep process.env in sync strictly for declared whitelisted non-secret keys.
        // @see XSA-XESS-017: Never mirror XEMS_*, ENC_*, DOTENV_*, XY_*, or __* into process.env,
        // because Bun.env and import.meta.env bypass the Proxy shield and would expose plain secrets.
        // @see XSA-XESS-019: Maintain in-memory whitelisted cache for O(1) process.env reads.
        if (this.whitelistedFields.has(key)) {
            this._whitelistedCache.set(key, value);
            try {
                process.env[key] = value;
            } catch {
                // Shield is locked
            }
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
        const root = this.resolveAuthorizedRoot();
        if (!root) {
            return;
        }

        this.executeEnvCall("delete", [key], { root });

        // @see XSA-XESS-017
        // @see XSA-XESS-019: Invalidate whitelisted cache on delete.
        if (this.whitelistedFields.has(key)) {
            this._whitelistedCache.delete(key);
            try {
                delete process.env[key];
            } catch {
                // Shield may block deletion
            }
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
        const root = this.resolveAuthorizedRoot();
        if (!root) {
            return defaultValue;
        }

        if (key === "__root__") {
            return root;
        }

        const res = this.executeEnvCall<{ found?: boolean; value?: string }>(
            "get",
            [key],
            { root },
        );
        return res?.found && res.value !== undefined ? res.value : defaultValue;
    }

    /**
     * Reads a variable from the secure internal store for a specific root.
     *
     * **Security Note:**
     * Formerly exposed as `getForRoot(key, root)`. It was removed from the public API
     * because it functioned as a zero-trust bypass: plugins could manually pass the host project
     * root and read host secrets. It is now private to the engine and keyed by an internal Symbol.
     *
     * @internal
     * @param key  - Variable name to look up.
     * @param root - Absolute project root path.
     * @returns The resolved variable value or undefined.
     */
    public [XY_ENV_INTERNAL_GET_FOR_ROOT](key: string, root: string): string | undefined {
        const callerInfo = getVerifiedCallerInfo();
        if (callerInfo.isUntrusted || !isImmediateInternalEngineCall()) {
            return undefined;
        }

        if (key === "__root__") {
            return root;
        }

        const res = this.executeEnvCall<{ found?: boolean; value?: string }>(
            "get",
            [key],
            { root },
        );
        return res?.found ? res.value : undefined;
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
        const value = this.get(key);

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
        const root = this.resolveAuthorizedRoot();
        if (!root) {
            return false;
        }

        const res = this.executeEnvCall<{ found?: boolean }>(
            "has",
            [key],
            { root },
        );
        return Boolean(res?.found);
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
        const root = this.resolveAuthorizedRoot();
        if (!root) {
            return Object.freeze({});
        }

        const res = this.executeEnvCall<{ secrets?: Record<string, string> }>(
            "all",
            [],
            { root },
        );
        const store = res?.secrets || {};

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

    /**
     * Configures the XESS (XyPriss Environment Security Shield) dynamically.
     *
     * **Security Note:**
     * Formerly exposed as `public configureShield(...)`. It was removed from the public API
     * because any untrusted caller could modify the whitelist of allowed `process.env` properties,
     * effectively destroying the Environment Security Shield. It is now private to the engine
     * and only accessible via this internal Symbol during early bootstrap.
     *
     * @internal
     * @see XSA-XESS-015
     * @see XSA-XESS-018
     * @see XSA-XESS-019
     * @param config - XESS configuration options.
     */
    public [XY_ENV_CONFIGURE_SHIELD](config?: {
        whitelist?: string[];
        replaceDefaultWhitelist?: boolean;
    }): void {
        const callerInfo = getVerifiedCallerInfo();
        if (callerInfo.isUntrusted || !isImmediateInternalEngineCall()) {
            return;
        }
        if (!config) return;

        if (config.whitelist !== undefined) {
            if (config.replaceDefaultWhitelist) {
                this.whitelistedFields = new Set(config.whitelist);
            } else {
                this.whitelistedFields = new Set([
                    ...this.defaultWhitelist,
                    ...config.whitelist,
                ]);
            }
        }

        // Cache all whitelisted values from the vault during trusted bootstrap
        this.refreshWhitelistedCache();
    }

    /**
     * Pre-populates the in-memory cache of whitelisted variables from the secure vault
     * during trusted engine bootstrap.
     *
     * This provides O(1) synchronous lookups for `process.env` without invoking `runner.runSync`,
     * preventing any conflict with Zero-Trust caller verification on restricted modules.
     *
     * @internal
     * @see XSA-XESS-019
     */
    private refreshWhitelistedCache(): void {
        const runner = _envRunnerStore.get(this);
        const hostRoot = runner ? runner.getRoot() : "";
        for (const key of this.whitelistedFields) {
            if (!this.defaultWhitelist.has(key) || key === "PORT") {
                try {
                    const res = this.executeEnvCall<{ found?: boolean; value?: string }>(
                        "get",
                        [key],
                        { root: hostRoot },
                    );
                    if (res?.found && res.value !== undefined) {
                        this._whitelistedCache.set(key, res.value);
                    }
                } catch {
                    // Vault might not be initialized or key not present yet
                }
            }
        }
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
            const runner = _envRunnerStore.get(this);
            if (!runner) return "";
            const result = runner.runSync("sys", "user") as {
                username?: string;
            };
            return result?.username ?? "";
        } catch {
            return "";
        }
    }

    // -------------------------------------------------------------------------
    // Private — Zero-Trust Caller Verification (V8 C++ CallSites + libSynapx)
    // -------------------------------------------------------------------------

    /**
     * Resolves the authorized project root for the current caller using native V8 C++ CallSites.
     *
     * SECURITY POLICY:
     * - If the caller originates from an undeclared `node_modules/` dependency or dynamic `eval` / `new Function`,
     *   `callerInfo.isUntrusted` is true and this method returns `null` (NEVER falling back to `this.runner.getRoot()`).
     * - Zero secrets are stored in JavaScript RAM; all queries go through `this.runner.runSync("env", ...)` (`libSynapx`).
     *
     * @internal
     */
    private resolveAuthorizedRoot(explicitRoot?: string): string | null {
        if (explicitRoot) {
            return explicitRoot;
        }

        const callerInfo = getVerifiedCallerInfo();
        if (callerInfo.isUntrusted) {
            return null;
        }

        if (this.isDynamic && callerInfo.root) {
            return callerInfo.root;
        }

        const runner = _envRunnerStore.get(this);
        const hostRoot = runner ? runner.getRoot() : null;
        return hostRoot || callerInfo.root || null;
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
        // Issue #43 / XSA-008: Guard against multi-server sequential startup re-wrapping process.env.
        // Uses unforgeable private Symbol and WeakSet to defeat pre-bootstrap spoofing attacks.
        if (_shieldedInstances.has(process.env) || (process.env as any)[SHIELD_MARKER] === true) {
            return;
        }

        // Per-key deduplication: every distinct blocked key gets exactly one
        // warning, preserving actionable signal without log flooding.
        const warnedKeys = new Set<string>();
        const self = this;

        // Critical environment keys that must NEVER be mutated or poisoned by application or third-party code
        const CRITICAL_IMMUTABLE_ENV = new Set([
            "NODE_OPTIONS",
            "NODE_TLS_REJECT_UNAUTHORIZED",
            "NODE_EXTRA_CA_CERTS",
            "PATH",
            "LD_PRELOAD",
            "LD_LIBRARY_PATH",
            "DYLD_INSERT_LIBRARIES",
            "DYLD_LIBRARY_PATH",
        ]);

        let isInsideShieldCheck = false;

        /**
         * Verifies whether the caller that directly triggered a process.env Proxy trap
         * belongs to the internal XyPriss engine core or to external user/plugin code.
         *
         * @see XSA-XESS-015 - Immune to prototype pollution on String.prototype
         */
        function isProxyCallerEngineCore(): boolean {
            const frames = captureNativeFrames();
            let seenTrap = false;
            for (let i = 0; i < frames.length; i++) {
                const { filePath, fnName } = frames[i];
                if (!filePath) continue;
                if (
                    _StringStartsWith(filePath, "node:") ||
                    _StringStartsWith(filePath, "bun:") ||
                    filePath === "native" ||
                    _StringIncludes(filePath, "[eval]")
                ) {
                    continue;
                }
                if (
                    fnName === "captureNativeFrames" ||
                    fnName === "isProxyCallerEngineCore"
                ) {
                    continue;
                }
                // The first frame after capture plumbing is the Proxy trap itself
                if (!seenTrap) {
                    seenTrap = true;
                    continue;
                }
                // The very first frame after the Proxy trap is the consumer that accessed process.env!
                return isEngineCorePath(_StringReplace(filePath, /\\/g, "/"));
            }
            return false;
        }

        const envShield = new Proxy(process.env, {
            get(target, prop: string | symbol, receiver) {
                if (prop === SHIELD_MARKER) {
                    return true;
                }

                if (typeof prop !== "string") {
                    return Reflect.get(target, prop, receiver);
                }

                /**
                 * Fast bypass for internal engine shield checks to prevent proxy re-entrancy.
                 * @see XSA-XESS-018
                 * @see XSA-XESS-019
                 */
                if (
                    isInsideShieldCheck ||
                    prop === "XYPRISS_PROJECT_ROOT" ||
                    prop === "XYPRISS_ENV_SHIELD" ||
                    prop === "XYPRISS_SHIELD"
                ) {
                    return Reflect.get(target, prop, receiver);
                }

                /**
                 * Whitelisted environment fields resolution:
                 * Resolves in O(1) from the secure in-memory cache populated from the Vault.
                 * Third-party packages in node_modules can read declared whitelisted keys safely
                 * without triggering runner.runSync Zero-Trust caller rejection.
                 *
                 * @see XSA-XESS-019
                 */
                if (self.whitelistedFields.has(prop)) {
                    if (self._whitelistedCache.has(prop)) {
                        return self._whitelistedCache.get(prop);
                    }
                    return Reflect.get(target, prop, receiver);
                }

                // Internal framework operations: allow verified engine callers to read environment safely
                isInsideShieldCheck = true;
                try {
                    const caller = getVerifiedCallerInfo();
                    if (!caller.isUntrusted && isProxyCallerEngineCore()) {
                        return Reflect.get(target, prop, receiver);
                    }
                } finally {
                    isInsideShieldCheck = false;
                }

                // All other keys (including ENC_*, DOTENV_*, __*, and application secrets):
                // direct process.env reads by untrusted/external callers are strictly intercepted and blocked!
                if (!warnedKeys.has(prop)) {
                    /**
                     * Check silent mode flags directly from the backing target object
                     * to permanently prevent recursive proxy invocations.
                     *
                     * @see XSA-XESS-018
                     * @see XSA-XESS-019
                     */
                    const isSilent =
                        target["XYPRISS_ENV_SHIELD"] === "silent" ||
                        target["XYPRISS_SHIELD"] === "silent";

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

            /**
             * Strict `set` trap on `process.env`.
             * Blocks tampering with critical system environment variables (CWE-471).
             * Restricts internal prefixes to verified engine callers.
             */
            set(target, prop: string | symbol, value: any, receiver: any) {
                if (typeof prop !== "string") {
                    return Reflect.set(target, prop, value, receiver);
                }

                const key = prop;

                // Faille 4 (XSA_2026_XESS_007): Prevent poisoning of critical runtime & system variables
                if (CRITICAL_IMMUTABLE_ENV.has(key)) {
                    if (!warnedKeys.has(key)) {
                        process.stderr.write(
                            `\x1b[31m[SECURITY]\x1b[0m ` +
                                `Direct modification to critical system environment variable process.env["${key}"] is permanently blocked.\n`,
                        );
                        warnedKeys.add(key);
                    }
                    return true; // Return true to avoid throwing in strict runtime modes while dropping the poisoned write
                }

                // Internal framework prefixes: only mutable by verified internal callers
                // @see XSA-XESS-017: Harmonize prefixes to prevent contradictory [SECURITY] warnings
                if (
                    key.startsWith("XYPRISS_") ||
                    key.startsWith("LIBXESS_") ||
                    key.startsWith("XEMS_") ||
                    key.startsWith("XESS_") ||
                    key.startsWith("XY_") ||
                    key.startsWith("ENC_") ||
                    key.startsWith("DOTENV_") ||
                    key.startsWith("__")
                ) {
                    isInsideShieldCheck = true;
                    try {
                        const caller = getVerifiedCallerInfo();
                        if (
                            !caller.isUntrusted &&
                            isProxyCallerEngineCore()
                        ) {
                            try {
                                target[key] = String(value);
                            } catch {}
                            return true;
                        }
                    } finally {
                        isInsideShieldCheck = false;
                    }
                }

                // Allowed whitelisted non-critical keys
                if (self.whitelistedFields.has(key)) {
                    try {
                        target[key] = String(value);
                    } catch {}
                    return true;
                }

                // Prevent fatal crashes in strict runtimes (like Bun) while auditing unauthorized modifications
                if (!warnedKeys.has(key)) {
                    process.stderr.write(
                        `\x1b[33m[SECURITY]\x1b[0m ` +
                            `Direct modification to process.env["${key}"] is blocked. ` +
                            `Use \x1b[36m__sys__.__env__.set("${key}", value)\x1b[0m instead.\n`,
                    );
                    warnedKeys.add(key);
                }
                return true;
            },

            /**
             * Explicit `defineProperty` trap to prevent uncaught descriptor exceptions under Bun,
             * strictly forbidding definition of critical immutable environment keys.
             */
            defineProperty(target, prop, descriptor) {
                if (typeof prop === "string" && CRITICAL_IMMUTABLE_ENV.has(prop)) {
                    return false;
                }
                try {
                    return Reflect.defineProperty(target, prop, descriptor);
                } catch {
                    return false;
                }
            },

            /**
             * Explicit `deleteProperty` trap to allow removing allowed keys safely,
             * protecting critical environment variables and internal framework state.
             */
            deleteProperty(target, prop) {
                if (typeof prop === "string") {
                    if (CRITICAL_IMMUTABLE_ENV.has(prop)) {
                        return false;
                    }
                    if (
                        prop.startsWith("XYPRISS_") ||
                        prop.startsWith("LIBXESS_") ||
                        prop.startsWith("XEMS_") ||
                        prop.startsWith("XESS_")
                    ) {
                        isInsideShieldCheck = true;
                        try {
                            const caller = getVerifiedCallerInfo();
                            if (!caller.isUntrusted && isProxyCallerEngineCore()) {
                                try {
                                    delete target[prop];
                                } catch {}
                                return true;
                            }
                        } finally {
                            isInsideShieldCheck = false;
                        }
                        return true;
                    }
                    if (self.whitelistedFields.has(prop)) {
                        try {
                            delete target[prop];
                        } catch {}
                        return true;
                    }
                }
                return true;
            },

            // Harden enumeration: restrict what untrusted callers see when they iterate
            // or spread process.env, while preserving full environment for internal engine callers.
            ownKeys(target) {
                if (isInsideShieldCheck) {
                    return Reflect.ownKeys(target);
                }
                isInsideShieldCheck = true;
                try {
                    const caller = getVerifiedCallerInfo();
                    if (!caller.isUntrusted && isProxyCallerEngineCore()) {
                        return Reflect.ownKeys(target);
                    }
                } catch {
                } finally {
                    isInsideShieldCheck = false;
                }
                return [...self.whitelistedFields];
            },

            // Align `in` operator behaviour with the restricted key set.
            has(target, prop: string | symbol) {
                if (typeof prop !== "string") return false;
                if (self.whitelistedFields.has(prop)) return true;
                if (
                    prop.startsWith("XYPRISS_") ||
                    prop.startsWith("LIBXESS_") ||
                    prop.startsWith("XESS_") ||
                    prop.startsWith("LIBPORT_") ||
                    prop.startsWith("PORT_") ||
                    prop.startsWith("XPM_")
                ) {
                    if (isInsideShieldCheck) return true;
                    isInsideShieldCheck = true;
                    try {
                        const caller = getVerifiedCallerInfo();
                        return !caller.isUntrusted && isProxyCallerEngineCore();
                    } catch {
                        return false;
                    } finally {
                        isInsideShieldCheck = false;
                    }
                }
                return false;
            },
        });

        _shieldedInstances.add(envShield);
        _shieldedInstances.add(process.env);

        try {
            Object.defineProperty(process, "env", {
                value: envShield,
                writable: false,
                configurable: false,
                enumerable: true,
            });
        } catch (err: any) {
            // Issue #52 (https://github.com/Nehonix-Team/XyPriss/issues/52)
            // Emits an explicit diagnostic notice if the host runtime, sandbox, or
            // strict VM has locked the process.env descriptor beforehand.
            // Avoids silent degradation so operators immediately know when the JS
            // proxy layer cannot replace process.env on the global object.
            process.stderr.write(
                `\x1b[33m[SECURITY] WARNING:\x1b[0m Unable to lock process.env descriptor: ${err?.message || err}. Shield proxy degradation active.\n`,
            );
        }
    }

    private isCallerProjectCode(): boolean {
        const callerRoot = getCallerProjectRoot();
        const sysRoot = (globalThis as any).__sys__?.__root__;
        return !!callerRoot && callerRoot === sysRoot;
    }
}



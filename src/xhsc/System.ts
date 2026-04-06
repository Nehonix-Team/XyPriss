import { XyPrissRunner } from "./XyPrissRunner";
import { OSApi } from "./OSApi";
import { FSApi } from "./FSApi";
import { PathApi } from "./PathApi";
import { VarsApi } from "./VarsApi";
import { EnvApi } from "./EnvApi";

/**
 * **XyPriss System API (Aggregator)**
 *
 * This class serves as the **Logic Aggregator** for the entire XyPriss system interface.
 * It sits at the top of the inheritance chain:
 * `XyPrissFS` -> `SysApi` -> `FSApi` -> `PathApi` -> `BaseApi`
 *
 * **Architecture:**
 * Instead of delegating to properties (e.g., `.fs`, `.sys`), this class **inherits**
 * all methods directly. This creates a "Flat API" structure where all capabilities
 * are available on the single instance.
 *
 * **Usage:**
 * This class is typically not instantiated directly by the user but is the base
 * for the global `__sys__` singleton (`__sys__`).
 *
 * @class XyPrissFS
 * @extends SysApi
 */
export class XyPrissFS {
    public vars: VarsApi;
    public fs: FSApi;
    public path: PathApi;
    public os: OSApi;

    protected _internalRoot: string;

    /**
     * **Project Root Path**
     *
     * The absolute path to the project root directory. This is the primary
     * resolution anchor for all system operations.
     */
    public get __root__(): string {
        return this._internalRoot;
    }

    /**
     * **EnvApi — Environment & Security Manager**
     *
     * `EnvApi` is the sole authorised gateway for reading and writing environment
     * variables inside XyPriss applications. It enforces the XyPriss
     * **Environment Security Shield**, which prevents direct `process.env` access
     * via a hardened runtime Proxy.
     *
     * ---
     *
     * ### Security model
     *
     * Four independent mechanisms work together:
     *
     * **1. Symbol-keyed internal store**
     * The backing store lives at `globalThis[XY_ENV_STORE_KEY]` where
     * `XY_ENV_STORE_KEY` is a module-scoped, unexported `Symbol`. There is no
     * string key to guess or enumerate; external code cannot reach the store
     * without a direct reference to the Symbol.
     *
     * **2. Strict store initialisation guard**
     * Every read and write method calls `requireStore()`, which throws
     * {@link EnvStoreError} if the store has not yet been initialised by the
     * XyPriss bootstrap. This eliminates the silent `process.env` fallback that
     * would otherwise leak values during the startup race window.
     *
     * **3. Value sanitisation**
     * `set()` rejects values containing CR (`\r`), LF (`\n`), or NUL (`\0`).
     * These characters can corrupt downstream log sinks, `.env` parsers, and
     * HTTP header serialisers.
     *
     * **4. Shield — Proxy with enumeration hardening**
     * `process.env` is replaced with a Proxy. Non-whitelisted reads return
     * `undefined`. The `ownKeys` and `has` traps restrict the apparent key set to
     * the whitelist, preventing third-party code (loggers, serialisers) from
     * enumerating the real store through `process.env`.
     *
     * ---
     *
     * ### Usage
     *
     * Do not instantiate this class directly. Use the pre-configured instance
     * exposed by the framework at `__sys__.__env__`:
     *
     * ```typescript
     * // Reading with a fallback
     * const port = __sys__.__env__.get("PORT", "3000");
     *
     * // Reading a required variable — throws EnvAccessError if absent
     * const jwtSecret = __sys__.__env__.getStrict("JWT_SECRET");
     *
     * // Reading a required variable, also rejecting empty strings
     * const dbPassword = __sys__.__env__.getStrict("DB_PASSWORD", { rejectEmpty: true });
     *
     * // Writing a variable at runtime
     * __sys__.__env__.set("FEATURE_FLAG_BETA", "true");
     *
     * // Checking the execution mode
     * if (__sys__.__env__.isProduction()) {
     *   // Apply production hardening
     * }
     * ```
     *
     * ---
     *
     * @see {@link IEnvApi} for the public interface contract.
     * @see {@link EnvAccessError} for the error thrown by `getStrict`.
     * @see {@link EnvKeyError} for the error thrown on invalid keys or values.
     * @see {@link EnvStoreError} for the error thrown when the store is not ready.
     */
    public __env__: EnvApi;

    /**
     * **Initialize System API**
     *
     * Sets up the runner bridge with the specified project root.
     *
     * @param {Object} context - Initialization context.
     * @param {string} context.__root__ - Absolute path to the project root directory.
     * @param {string} [context.__mode__] - Optional execution mode (defaults to "development").
     */
    constructor(context: {
        __root__: string;
        __mode__?: string;
        isDynamicEnv?: boolean;
    }) {
        this._internalRoot = context.__root__;

        const runner = new XyPrissRunner(context.__root__);
        this.vars = new VarsApi(runner);
        this.fs = new FSApi(runner);
        this.path = new PathApi(runner);
        this.os = new OSApi(runner);
        this.__env__ = new EnvApi(
            runner,
            context.__mode__,
            context.isDynamicEnv || false,
        );
    }
}


import { XyPrissRunner } from "./XyPrissRunner";
import { OSApi } from "./OSApi";
import { FSApi } from "./FSApi";
import { PathApi } from "./PathApi";
import { VarsApi } from "./VarsApi";
import { EnvApi } from "./EnvApi";
import { UtilsApi } from "./UtilsApi";
import {
    getCallerProjectRoot,
    getVerifiedCallerInfo,
    isEngineCorePath,
    isImmediateInternalEngineCall,
    getPrimaryProjectRoot,
    extractPackageNameFromPath,
    _StringReplace,
} from "../utils/ProjectDiscovery";
import { _PathPosixNormalize } from "../utils/CorePathCheck";
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
    protected _internalRoot: string;
    protected _mode: string = "development";
    protected _isDynamicEnv: boolean = false;

    // Primary instances for host application and internal engine components
    protected _primaryRunner: XyPrissRunner;
    protected _primaryVars: VarsApi;
    protected _primaryFs: FSApi;
    protected _primaryPath: PathApi;
    protected _primaryOs: OSApi;
    protected _primaryUtils: UtilsApi;
    protected _primaryEnv: EnvApi;

    // Discrete isolated sandboxes cached by authorized root paths
    // Guarantees that every caller runs strictly inside the sandbox directory reserved for it
    protected _scopedSandboxes: Map<
        string,
        {
            vars: VarsApi;
            fs: FSApi;
            path: PathApi;
            os: OSApi;
            utils: UtilsApi;
            env: EnvApi;
        }
    > = new Map();

    /**
     * Identifies the caller's authorized sandbox boundary.
     * Internal engine components and host application files receive primary access.
     * Third-party dependencies and isolated plugins receive their own discrete sandbox partition.
     *
     * @internal
     */
    protected _resolveCallerContext(): {
        root: string;
        isPrimaryOrCore: boolean;
    } {
        const caller = getVerifiedCallerInfo();
        if (caller.callerFile && isEngineCorePath(caller.callerFile)) {
            return { root: this._internalRoot, isPrimaryOrCore: true };
        }

        // If the immediate caller is internal engine, check if there is an outer application caller
        if (isImmediateInternalEngineCall() && !caller.callerFile) {
            return { root: this._internalRoot, isPrimaryOrCore: true };
        }

        const callerRoot = caller.root || getCallerProjectRoot();
        if (!callerRoot) {
            return { root: this._internalRoot, isPrimaryOrCore: false };
        }

        let normCallerRoot = _PathPosixNormalize(
            _StringReplace(callerRoot, /\\/g, "/"),
        );
        while (normCallerRoot.length > 1 && normCallerRoot.endsWith("/")) {
            normCallerRoot = normCallerRoot.slice(0, -1);
        }

        let normInternalRoot = this._internalRoot
            ? _PathPosixNormalize(
                  _StringReplace(this._internalRoot, /\\/g, "/"),
              )
            : "";
        while (normInternalRoot.length > 1 && normInternalRoot.endsWith("/")) {
            normInternalRoot = normInternalRoot.slice(0, -1);
        }

        const primaryRoot = getPrimaryProjectRoot();
        let normPrimaryRoot = primaryRoot
            ? _PathPosixNormalize(_StringReplace(primaryRoot, /\\/g, "/"))
            : "";
        while (normPrimaryRoot.length > 1 && normPrimaryRoot.endsWith("/")) {
            normPrimaryRoot = normPrimaryRoot.slice(0, -1);
        }

        // Any caller originating from a third-party dependency in node_modules
        // is strictly confined to its package sandbox and is NEVER primary.
        const pkg = caller.callerFile
            ? extractPackageNameFromPath(caller.callerFile)
            : null;
        if (pkg !== null) {
            return {
                root: normCallerRoot,
                isPrimaryOrCore: false,
            };
        }

        const isPrimary =
            normCallerRoot === normInternalRoot ||
            (normPrimaryRoot !== "" && normCallerRoot === normPrimaryRoot);

        return {
            root: normCallerRoot,
            isPrimaryOrCore: isPrimary,
        };
    }

    /**
     * Retrieves or instantiates an isolated sandbox suite confined strictly to targetRoot.
     *
     * @internal
     */
    protected _getOrCreateScoped(targetRoot: string) {
        let scoped = this._scopedSandboxes.get(targetRoot);
        if (!scoped) {
            const scopedRunner = new XyPrissRunner(targetRoot);
            scoped = {
                vars: new VarsApi(scopedRunner),
                fs: new FSApi(scopedRunner),
                path: new PathApi(scopedRunner),
                os: new OSApi(scopedRunner),
                utils: new UtilsApi(),
                env: new EnvApi(scopedRunner, this._mode, true),
            };
            this._scopedSandboxes.set(targetRoot, scoped);
        }
        return scoped;
    }

    /**
     * **Dynamic Variables & Configuration API (Sandboxed)**
     *
     * Returns the variable store scoped strictly to the caller's assigned sandbox.
     */
    public get vars(): VarsApi {
        const ctx = this._resolveCallerContext();
        if (ctx.isPrimaryOrCore) return this._primaryVars;
        return this._getOrCreateScoped(ctx.root).vars;
    }

    /**
     * **Filesystem API (Sandboxed)**
     *
     * Returns the filesystem interface confined strictly to the caller's assigned sandbox directory.
     */
    public get fs(): FSApi {
        const ctx = this._resolveCallerContext();
        if (ctx.isPrimaryOrCore) return this._primaryFs;
        return this._getOrCreateScoped(ctx.root).fs;
    }

    /**
     * **Path API (Sandboxed)**
     *
     * Returns the path manipulation interface rooted in the caller's assigned sandbox directory.
     */
    public get path(): PathApi {
        const ctx = this._resolveCallerContext();
        if (ctx.isPrimaryOrCore) return this._primaryPath;
        return this._getOrCreateScoped(ctx.root).path;
    }

    /**
     * **OS & System Diagnostics API (Sandboxed)**
     */
    public get os(): OSApi {
        const ctx = this._resolveCallerContext();
        if (ctx.isPrimaryOrCore) return this._primaryOs;
        return this._getOrCreateScoped(ctx.root).os;
    }

    /**
     * **Utility API**
     */
    public get utils(): UtilsApi {
        const ctx = this._resolveCallerContext();
        if (ctx.isPrimaryOrCore) return this._primaryUtils;
        return this._getOrCreateScoped(ctx.root).utils;
    }

    /**
     * **EnvApi — Environment & Security Manager (Sandboxed)**
     */
    public get __env__(): EnvApi {
        const ctx = this._resolveCallerContext();
        if (ctx.isPrimaryOrCore) return this._primaryEnv;
        return this._getOrCreateScoped(ctx.root).env;
    }

    /**
     * **Project Root Path**
     *
     * The absolute path to the project root directory. This is the primary
     * resolution anchor for all system operations.
     *
     * @see XSA-FS-002 Fail-closed project root resolution for untrusted callers
     */
    public get __root__(): string {
        const callerRoot = getCallerProjectRoot();
        if (!callerRoot) {
            return undefined as unknown as string;
        }
        return callerRoot;
    }

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
        this._mode = context.__mode__ || "development";
        this._isDynamicEnv = Boolean(context.isDynamicEnv);

        this._primaryRunner = new XyPrissRunner(context.__root__);
        this._primaryVars = new VarsApi(this._primaryRunner);
        this._primaryFs = new FSApi(this._primaryRunner);
        this._primaryPath = new PathApi(this._primaryRunner);
        this._primaryOs = new OSApi(this._primaryRunner);
        this._primaryUtils = new UtilsApi();
        this._primaryEnv = new EnvApi(
            this._primaryRunner,
            context.__mode__,
            context.isDynamicEnv || false,
        );
    }
}


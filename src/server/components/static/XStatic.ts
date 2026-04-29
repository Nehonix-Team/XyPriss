/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * XStatic - High-Performance, Sandboxed Static File Serving.
 * Optimized with Meta-Cache (LRU) and XHSC (Go) Zero-Copy delegation.
 ***************************************************************************/

import { XRequest as Request, XResponse as Response } from "../../routing";
import { XyPrissXHSC } from "../../../xhsc";
import { XyApp } from "../../../types/XyApp.type";
import { Logger } from "../../../shared/logger/Logger";
import { UriNormalizer } from "../../../middleware/built-in/security/UriNormalizer";
import { Configs } from "../../..";
import { DotfileModeT, IXStatic, StaticOptions } from "./types";
import { IXStaticSchem } from "./IXStaticSchem";
import { QuickLogger } from "../../../shared/logger/quickLogger";
import { XStaticMetaCache } from "./MetaCache";

/**
 * **XStatic** — High-performance, sandboxed static file server for XyPriss.
 *
 * XStatic handles static asset delivery through a two-layer architecture:
 *
 * 1. **TypeScript layer** — responsible for URI normalization, dotfile/sandbox
 *    security enforcement, and LRU meta-cache (anti-DDoS I/O shield).
 * 2. **XHSC (Go) layer** — takes over once the request is validated, streaming
 *    the file directly from disk to the TCP socket using zero-copy (`sendfile`),
 *    native ETags, `304 Not Modified`, and `206 Partial Content` (Range requests).
 *
 * ### Architectural Flow
 * ```
 * Request
 *   → URI Normalization
 *   → Dotfile / Restricted File Check
 *   → Sandbox Enforcement (Project Root + Directory Jail)
 *   → LRU Meta-Cache (negative cache — blocks repeated 404 storms)
 *   → Filesystem Existence Check
 *   → XHSC Zero-Copy Delegation (Go)
 *   → Response
 * ```
 *
 * ### Basic Usage
 * ```typescript
 * import { XStatic } from "xypriss";
 *
 * const app  = createServer(options);
 * const xs   = new XStatic(app, __sys__);
 *
 * xs.define("/assets", "./public");
 * xs.define("/docs",   "./documentation");
 *
 * // Explicit opt-out of sandbox (e.g. user-upload directory)
 * xs.define("/avatars", "/var/www/uploads/avatars", {
 *   allowOutsideRoot: true,
 *   unsafe: true,
 * });
 * ```
 *
 * ### Global Configuration (via `createServer`)
 * ```typescript
 * const app = createServer({
 *   static: {
 *     zeroCopy:       true,   // Enable sendfile() syscall in XHSC
 *     ConcurrencyPool: 1024,  // Max goroutines for disk I/O
 *     lruCacheSize:   5000,   // Entries kept in negative meta-cache
 *     dotfiles:       "deny", // Block .env, .git, etc.
 *     defaultMaxAge:  86400,  // Default Cache-Control max-age (seconds)
 *   },
 * });
 * ```
 *
 * @remarks
 * XStatic is **instance-scoped** by design. Avoid singleton patterns when
 * running under XMS (XyPriss MultiServer) to prevent cross-instance route
 * leakage and memory pressure.
 *
 * @see {@link StaticOptions}  for per-route configuration.
 * @see {@link IXStatic}       for global configuration shape.
 * @see {@link XStaticMetaCache} for LRU cache implementation details.
 */
export class XStatic {
    private metaCache: XStaticMetaCache;
    private logger: Logger;
    private qLog: ReturnType<typeof QuickLogger.for>;

    private globalConfig: IXStatic;

    /**
     * Creates a new `XStatic` instance bound to the given server and system API.
     *
     * Reads the `"static"` key from the application config (`Configs.get`),
     * initialises the LRU meta-cache with the configured size (default: **5 000**
     * entries), and wires up internal loggers.
     *
     * @param app - The XyPriss application instance to register middleware on.
     * @param sys - The XHSC system handle (`__sys__`), which exposes the sandboxed
     *   `fs` and `path` APIs as well as the project root (`__root__`).
     *
     * @throws {Error} If the global `"static"` configuration block fails Zod schema
     *   validation (see {@link validateConfigs}).
     *
     * @example
     * ```typescript
     * const xs = new XStatic(app, __sys__);
     * ```
     */
    constructor(
        private app: XyApp,
        private sys: XyPrissXHSC,
    ) {
        this.globalConfig = Configs.get("static") || {};
        this.metaCache = new XStaticMetaCache(
            this.globalConfig.lruCacheSize || 5000,
        );
        this.logger = (app as any).logger || Logger.getInstance();
        this.qLog = QuickLogger.for("XStatic");

        this.logger.debug(
            "server",
            "XStatic initialized with Zero-Copy delegation support.",
        );
        this.validateConfigs();
    }

    /**
     * Validates the global static configuration block at startup.
     *
     * Performs two sequential checks:
     *
     * 1. **Dotfiles type guard** — ensures `dotfiles` is either `"allow"` or
     *    `"deny"` when provided as a plain string.
     * 2. **Zod schema validation** — runs `IXStaticSchem.safeParse` against the
     *    full config object to catch unknown or malformed fields.
     *
     * @throws {Error} `"Invalid configuration for 'dotfiles'"` — if `dotfiles` is
     *   present but not a string.
     * @throws {Error} `"Invalid dotfiles mode. Expected one of 'allow' or 'deny',
     *   but got: '<value>'"` — if the dotfiles string is not a recognised mode.
     * @throws {Error} Zod validation message — if the config object fails the
     *   `IXStaticSchem` schema.
     *
     * @internal
     */
    private validateConfigs() {
        const c = this.globalConfig;
        const sdc = ["allow", "deny"];

        if (
            c.dotfiles != null &&
            !["string", "string"].includes(typeof c.dotfiles)
        ) {
            throw new Error("Invalid configuration for 'dotfiles'");
        }

        if (
            c.dotfiles &&
            typeof c.dotfiles === "string" &&
            !(sdc as DotfileModeT[]).includes(c.dotfiles as DotfileModeT)
        ) {
            throw new Error(
                `Invalid dotfiles mode. Expected one of ${sdc.map((s) => `'${s}'`).join(" or ")}, but got: '${c.dotfiles}'`,
            );
        }

        const validatedConfigs = IXStaticSchem.safeParse(this.globalConfig);

        if (!validatedConfigs.success) {
            throw new Error(validatedConfigs.errors[0].message);
        }
    }

    /**
     * Registers a static file route on the application.
     *
     * Mounts an async middleware on `route` that handles the full request
     * lifecycle: URI normalization → dotfile/restricted-file protection →
     * sandbox enforcement → LRU cache lookup → filesystem check →
     * XHSC zero-copy delegation.
     *
     * ---
     *
     * ### Security Layers
     *
     * **1 — Dotfile & Restricted File Protection**
     *
     * Controlled by `globalConfig.dotfiles` (default: `"deny"`). When in deny
     * mode, any file whose name starts with `"."` (e.g. `.env`, `.git`) or
     * appears in a custom restricted list is rejected with `403 Forbidden` before
     * any disk access occurs.
     *
     * **2 — Sandbox Enforcement** *(skipped when `options.unsafe` or
     * `options.allowOutsideRoot` is `true`)*
     *
     * - **Project Root Check** — the resolved `dir` must be inside the project
     *   root (`sys.__root__`). Prevents accidentally serving system directories.
     * - **Directory Jail** — the resolved request path must be strictly inside
     *   `dir`. Blocks path-traversal attacks (`../../etc/passwd`).
     *
     * **3 — LRU Meta-Cache (Anti-DDoS I/O Shield)**
     *
     * Paths that have previously resolved to `"not found"` are cached in memory.
     * Subsequent requests for the same missing path are rejected at the cache
     * layer — zero disk I/O, pure RAM response — protecting against flood
     * attacks that enumerate non-existent files.
     *
     * ---
     *
     * ### Zero-Copy Delegation to XHSC (Go)
     *
     * Once a request passes all validation steps, TypeScript sends a single IPC
     * signal to the XHSC worker: `"request #<id> may read <absolutePath>"`.
     * XHSC then streams the file directly from disk to the client TCP socket
     * using `sendfile()`, bypassing the V8/Node.js heap entirely. HTTP-level
     * concerns (ETag generation, `304 Not Modified`, `206 Partial Content` for
     * Range requests) are all handled natively by Go's `http.ServeContent`.
     *
     * ---
     *
     * @param route - The URL prefix to mount (e.g. `"/assets"`). Automatically
     *   normalised via {@link UriNormalizer.normalizePath}.
     * @param dir   - The filesystem directory to serve from (e.g. `"./public"`).
     *   Relative paths are resolved against the process working directory.
     * @param options - Optional per-route overrides. See {@link StaticOptions}.
     *
     * @returns `void` — the middleware is registered as a side effect.
     *
     * @throws This method does not throw. Internal errors are caught, logged via
     *   the application logger, and forwarded to `next()` so the request chain
     *   can continue (or fall through to a global error handler).
     *
     * @example
     * ```typescript
     * // Serve ./public under /assets (fully sandboxed, dotfiles denied)
     * xs.define("/assets", "./public");
     *
     * // Custom Cache-Control for long-lived build artefacts (1 week)
     * xs.define("/dist", "./build", { maxAge: 604800 });
     *
     * // User-uploaded content outside the project root (explicit opt-out)
     * xs.define("/uploads", "/var/www/uploads", {
     *   allowOutsideRoot: true,
     *   unsafe: true,
     * });
     * ```
     *
     * @see {@link StaticOptions} for the full list of per-route options.
     * @see {@link serve} for the deprecated alias.
     */
    public define(
        route: string,
        dir: string,
        options: StaticOptions = {},
    ): void {
        const normalizedRoute = UriNormalizer.normalizePath(route);

        // Middleware registration
        this.app.use(
            normalizedRoute,
            async (req: Request, res: Response, next: () => void) => {
                try {
                    // 1. Path Calculation (Strip mount point)
                    let relativePath = req.path;
                    if (req.path === normalizedRoute) {
                        relativePath = "/";
                    } else {
                        const prefix = normalizedRoute.endsWith("/")
                            ? normalizedRoute
                            : `${normalizedRoute}/`;
                        if (req.path.startsWith(prefix)) {
                            relativePath = req.path.substring(
                                normalizedRoute.length,
                            );
                        }
                    }

                    // Remove leading slash for join/basename operations
                    const cleanRelative = relativePath.startsWith("/")
                        ? relativePath.substring(1)
                        : relativePath;
                    const fileName = cleanRelative.split("/").pop() || "";

                    // 2. Dotfile & Restricted File Protection (Global Policy)
                    const dotfileConfig = this.globalConfig.dotfiles || "deny";
                    const dotfileMode =
                        typeof dotfileConfig === "object"
                            ? dotfileConfig.mode
                            : dotfileConfig;
                    const customRestricted =
                        typeof dotfileConfig === "object"
                            ? dotfileConfig.custom || []
                            : [];

                    if (dotfileMode === "deny") {
                        const isRestricted =
                            fileName.startsWith(".") ||
                            customRestricted.includes(fileName);
                        if (isRestricted) {
                            this.qLog.warn(
                                // "security",
                                `Blocked attempt to access restricted file: ${fileName}`,
                            );
                            res.status(403).end("Forbidden: Access Denied");
                            return next();
                        }
                    }

                    const fullPath = this.sys.path.join(dir, relativePath);

                    // 3. Path Normalization & Security Check (Sandbox)
                    const resolvedPath = this.sys.path.resolve(fullPath);
                    const rootDir = this.sys.path.resolve(dir);
                    const projectRoot = (this.sys as any).__root__;

                    if (
                        !options.allowOutsideRoot &&
                        !options.unsafe &&
                        projectRoot
                    ) {
                        // Check 1: Is the defined directory inside the project root?
                        if (!rootDir.startsWith(projectRoot)) {
                            this.qLog.warn(
                                //    "security",
                                `Blocked attempt to serve directory outside project root: ${rootDir}`,
                            );
                            res.status(403).end(
                                "Forbidden: Project Root Violation",
                            );
                            return next();
                        }

                        // Check 2: Is the requested file inside the defined directory? (Standard Jail)
                        if (!resolvedPath.startsWith(rootDir)) {
                            this.qLog.warn(
                                // "security",
                                `Blocked attempt to access file outside static root: ${resolvedPath}`,
                            );
                            res.status(403).end("Forbidden: Sandbox Violation");
                            return next();
                        }
                    }

                    // 4. LRU Meta-Cache (Anti-DDoS)
                    const cacheHit = this.metaCache.get(resolvedPath);
                    if (cacheHit && !cacheHit.exists) {
                        return next();
                    }

                    // 5. Existence Check (with Meta-Cache Protection)
                    if (!this.sys.fs.exists(resolvedPath)) {
                        this.metaCache.set(resolvedPath, false);
                        return next();
                    }

                    // Skip if it's a directory
                    if (this.sys.fs.isDir(resolvedPath)) {
                        return next();
                    }

                    // 6. Delegation to XHSC (Go)
                    const worker = (this.app as any)._xhscWorker;
                    if (worker) {
                        res.status(0);

                        // Handle Cache-Control (Local option > Global config)
                        const maxAge =
                            options.maxAge ?? this.globalConfig.defaultMaxAge;
                        if (maxAge !== undefined) {
                            res.setHeader(
                                "Cache-Control",
                                `public, max-age=${maxAge}`,
                            );
                        }

                        worker.delegateStatic((req as any).id, resolvedPath);
                        res.end();
                        return next();
                    } else {
                        res.status(500).send(
                            "[XStatic] High-performance static serving requires XHSC Clustering mode.",
                        );
                    }
                } catch (err) {
                    this.logger.error("server", `XStatic failure: ${err}`);
                    next();
                }
            },
        );

        this.logger.debug(
            "server",
            `Static route defined: ${normalizedRoute} -> ${dir}`,
        );
    }

    /**
     * @deprecated Use {@link define} instead. Will be removed in a future release.
     *
     * Alias for {@link define} — kept for beta compatibility only.
     *
     * @param route   - The URL prefix to mount (e.g. `"/assets"`).
     * @param dir     - The filesystem directory to serve from.
     * @param options - Optional per-route overrides. See {@link StaticOptions}.
     *
     * @example
     * ```typescript
     * // ❌ Deprecated — avoid in new code
     * xs.serve("/assets", "./public");
     *
     * // ✅ Preferred
     * xs.define("/assets", "./public");
     * ```
     */
    public serve(
        _route: string,
        _dir: string,
        _options: StaticOptions = {},
    ): void {
        const msg =
            "XStatic.serve() is deprecated. Please use XStatic.define().";
        this.qLog.error(
            // "server",
            msg,
        );
        // this.define(route, dir, options);
        throw new Error(msg);
    }
}



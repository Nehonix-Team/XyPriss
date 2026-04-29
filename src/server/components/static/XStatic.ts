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
import { DotfileModeT, IXStatic } from "./types";
import { IXStaticSchem } from "./IXStaticSchem";

interface StaticOptions {
    /** Allow serving files outside of the project root (Security Risk) */
    allowOutsideRoot?: boolean;
    /** Disable path validation safety checks */
    unsafe?: boolean;
    /** Cache-Control max-age header */
    maxAge?: string | number;
    /** Fallback to standard TS streaming if delegation fails */
    fallback?: boolean;
}

/**
 * Lightweight LRU Cache for negative path lookups (anti-DDoS).
 */
class MetaCache {
    private cache: Map<string, { exists: boolean; expires: number }> =
        new Map();
    private keys: string[] = [];

    constructor(private maxSize: number) {}

    public get(path: string): { exists: boolean } | null {
        const item = this.cache.get(path);
        if (!item) return null;
        if (Date.now() > item.expires) {
            this.delete(path);
            return null;
        }
        return { exists: item.exists };
    }

    public set(path: string, exists: boolean, ttlMs: number = 30000): void {
        if (this.cache.has(path)) {
            this.delete(path);
        } else if (this.keys.length >= this.maxSize) {
            const oldest = this.keys.shift();
            if (oldest) this.cache.delete(oldest);
        }

        this.cache.set(path, { exists, expires: Date.now() + ttlMs });
        this.keys.push(path);
    }

    private delete(path: string): void {
        this.cache.delete(path);
        const idx = this.keys.indexOf(path);
        if (idx > -1) this.keys.splice(idx, 1);
    }
}

/**
 * XStatic - The instanced static file manager for XyPriss.
 */
export class XStatic {
    private metaCache: MetaCache;
    private logger: Logger;

    private globalConfig: IXStatic;

    constructor(
        private app: XyApp,
        private sys: XyPrissXHSC,
    ) {
        this.globalConfig = Configs.get("static") || {};
        this.metaCache = new MetaCache(this.globalConfig.lruCacheSize || 5000);
        this.logger = (app as any).logger || Logger.getInstance();

        this.logger.debug(
            "server",
            "XStatic initialized with Zero-Copy delegation support.",
        );
        this.validateConfigs();
    }

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
     * Define a static route.
     *
     * @param route - The URL prefix (e.g., "/assets")
     * @param dir - The directory on disk (e.g., "./public")
     * @param options - Security and caching options
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
                            this.logger.warn(
                                "security",
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
                            this.logger.warn(
                                "security",
                                `Blocked attempt to serve directory outside project root: ${rootDir}`,
                            );
                            res.status(403).end(
                                "Forbidden: Project Root Violation",
                            );
                            return next();
                        }

                        // Check 2: Is the requested file inside the defined directory? (Standard Jail)
                        if (!resolvedPath.startsWith(rootDir)) {
                            this.logger.warn(
                                "security",
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

        this.logger.info(
            "server",
            `Static route defined: ${normalizedRoute} -> ${dir}`,
        );
    }

    /**
     * Alias for define() - Deprecated
     */
    public serve(
        route: string,
        dir: string,
        options: StaticOptions = {},
    ): void {
        this.logger.warn(
            "server",
            "XStatic.serve() is deprecated. Please use XStatic.define().",
        );
        this.define(route, dir, options);
    }
}


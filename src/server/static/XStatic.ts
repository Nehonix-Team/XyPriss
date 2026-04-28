import { XyApp } from "../../types/XyApp.type";
import { XyPrissXHSC } from "../../xhsc";
import { CacheFactory } from "../../cache/CacheFactory";
import { SecureCacheAdapter } from "xypriss-security";
import { Logger } from "../../shared/logger/Logger";
import { normalize, join, isAbsolute, relative } from "path";
import { QuickLogger } from "../../shared/logger/quickLogger";

/**
 * Static file serving options for XStatic
 */
export interface StaticOptions {
    /** Active sendfile() system call for zero-copy transfers (default: true) */
    zeroCopy?: boolean;
    /** Limit of goroutines for I/O operations (default: 1024) */
    ConcurrencyPool?: number;
    /** Size of LRU cache for path metadata/validity (anti-DDoS) (default: 5000) */
    lruCacheSize?: number;
    /** Dotfile serving policy: "deny", "allow", "ignore" (default: "deny") */
    dotfiles?: "deny" | "allow" | "ignore";
    /** Default Cache-Control max-age (e.g., "1d", "1h") (default: "1d") */
    maxAge?: string;
    /** Allow serving files outside the project root (default: false) */
    allowOutsideRoot?: boolean;
    /** Mark as unsafe (bypass security checks) (default: false) */
    unsafe?: boolean;
}

/**
 * XStatic - High-performance Zero-Trust static file serving system.
 *
 * Leveraging XHSC (Go) for zero-copy streaming and LRU memory cache
 * as a DDoS shield. Enforces strict filesystem sandboxing via __sys__ API.
 */
export class XStatic {
    private lru: SecureCacheAdapter;
    private options: StaticOptions;
    private logger = QuickLogger.for("XStatic")

    /**
     * Creates a new XStatic instance.
     *
     * @param app The XyPriss application instance
     * @param sys The XHSC system interface (__sys__)
     */
    constructor(
        private app: XyApp,
        private sys: XyPrissXHSC,
    ) {
        // Get global static config from app if available
        const globalConfig = (app as any).configs?.static || {};

        this.options = {
            zeroCopy: true,
            ConcurrencyPool: 1024,
            lruCacheSize: 5000,
            dotfiles: "deny",
            maxAge: "1d",
            ...globalConfig,
        };

        // Initialize LRU cache for anti-DDoS (mru path metadata)
        this.lru = CacheFactory.createMemoryCache({
            maxEntries: this.options.lruCacheSize,
            ttl: 3600, // 1 hour for negative results
            memory: { algorithm: "lru" },
        });
    }

    /**
     * Define a static route for serving files from a directory.
     *
     * @param urlPath The URL prefix (e.g., "/assets")
     * @param diskPath The physical disk path (e.g., "./public")
     * @param options Specific options for this route
     *
     * @example
     * ```typescript
     * const xs = new XStatic(app, __sys__);
     * xs.define("/public", "./static");
     * ```
     */
    public define(
        urlPath: string,
        diskPath: string,
        options: StaticOptions = {},
    ): void {
        const mergedOptions = { ...this.options, ...options };

        // Ensure urlPath starts with / and doesn't end with /
        if (!urlPath.startsWith("/")) urlPath = "/" + urlPath;
        if (urlPath.endsWith("/") && urlPath.length > 1)
            urlPath = urlPath.slice(0, -1);

        const root = this.sys.__root__;
        console.log("received root: ", root);
        const absoluteDiskPath = isAbsolute(diskPath)
            ? diskPath
            : normalize(join(root, diskPath));

        this.logger.info(
            "server",
            `[XStatic] Serving ${urlPath} -> ${absoluteDiskPath}`,
        );

        this.app.get(`${urlPath}/*`, async (req, res) => {
            // Get requested file path from params
            const params = (req as any).params || {};
            const requestedFile = params["*"] || params[0] || "";
            const fullPath = normalize(join(absoluteDiskPath, requestedFile));

            // 1. Check LRU Cache (Anti-DDoS)
            console.time("[XStatic] Handler-Total");
            console.time("[XStatic] LRU-Get");
            const cacheKey = `static:meta:${fullPath}`;
            const cachedStatus = await this.lru.get(cacheKey);
            console.timeEnd("[XStatic] LRU-Get");

            if (cachedStatus === "404") {
                return res.status(404).send("Not Found");
            }

            // 2. Security Check (Sandbox)
            console.time("[XStatic] Security-Check");
            if (!mergedOptions.allowOutsideRoot && !mergedOptions.unsafe) {
                const rel = relative(root, fullPath);
                if (rel.startsWith("..") || isAbsolute(rel)) {
                    console.log(`[XStatic] Blocked traversal: ${fullPath}`);
                    return res.status(403).send("Forbidden");
                }
            }
            console.timeEnd("[XStatic] Security-Check");

            // 3. Dotfiles check
            if (mergedOptions.dotfiles === "deny" && requestedFile.split("/").some((p: string) => p.startsWith("."))) {
                return res.status(403).send("Forbidden");
            }

            // 4. Delegation
            console.time("[XStatic] Delegation-Call");
            try {
                if ((res as any).xStatic) {
                    await (res as any).xStatic(fullPath, {
                        zeroCopy: mergedOptions.zeroCopy,
                        maxAge: mergedOptions.maxAge,
                        dotfiles: mergedOptions.dotfiles,
                    });
                    console.timeEnd("[XStatic] Delegation-Call");
                } else {
                    console.error("[XStatic] Bridge missing!");
                    res.status(500).send("Bridge Missing");
                }
            } catch (err) {
                console.error("[XStatic] Delegation failed", err);
                await this.lru.set(cacheKey, "404");
                res.status(404).send("Not Found");
            }
            console.timeEnd("[XStatic] Handler-Total");
        });
    }

    /**
     * Alias for {@link define}
     */
    public serve(
        urlPath: string,
        diskPath: string,
        options: StaticOptions = {},
    ): void {
        this.define(urlPath, diskPath, options);
    }
}


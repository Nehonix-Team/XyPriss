import { getSysApi } from "../../plugins/const/getSysApi";
import { QuickLogger } from "../../shared/logger/quickLogger";

const logger = QuickLogger.for("XHSC:TempFile");

export interface TempFileOptions {
    /**
     * Optional filename prefix.
     * @default "tmp_"
     */
    prefix?: string;
    /**
     * Optional file extension or suffix (e.g. ".json", ".pdf", ".txt").
     * @default ".xtmp"
     */
    extension?: string;
    suffix?: string;
    /**
     * Custom filename (if provided, overrides prefix/extension generation).
     */
    filename?: string;
    /**
     * Time-to-live duration before automatic background deletion.
     * Can be a number (milliseconds, e.g. 60000) or human-readable string (e.g. "5m", "1h", "30s").
     */
    ttl?: number | string;
    /**
     * Whether to automatically delete the file when the process exits or restarts.
     * @default true
     */
    autoCleanupOnExit?: boolean;
}

export interface TempFileResult {
    /** Absolute path to the created temporary file */
    path: string;
    /** Filename of the temporary file */
    filename: string;
    /** Size of the temporary file in bytes */
    size: number;
    /** Timestamp when the file was created (in ms) */
    createdAt: number;
    /** TTL expiration timestamp in ms (or null if no TTL) */
    expiresAt: number | null;
    /**
     * Manually remove the temporary file immediately.
     * Returns true if deleted, false if file did not exist.
     */
    remove: () => boolean;
    /** Alias for remove() */
    cleanup: () => boolean;
}

interface TrackedTempFile {
    filePath: string;
    timer: ReturnType<typeof setTimeout> | null;
    autoCleanupOnExit: boolean;
}

export class TempFileManager {
    private static instance: TempFileManager;
    private trackedFiles: Map<string, TrackedTempFile> = new Map();
    private exitHooksRegistered: boolean = false;

    private constructor() {
        this.registerExitHooks();
    }

    public static getInstance(): TempFileManager {
        if (!TempFileManager.instance) {
            TempFileManager.instance = new TempFileManager();
        }
        return TempFileManager.instance;
    }

    /**
     * Helper to parse human-readable TTL values into milliseconds.
     */
    public static parseTTL(ttl?: number | string): number {
        if (!ttl) return 0;
        if (typeof ttl === "number") return ttl > 0 ? ttl : 0;
        if (typeof ttl === "string") {
            const match = ttl.trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i);
            if (match) {
                const val = parseFloat(match[1]);
                const unit = (match[2] || "ms").toLowerCase();
                switch (unit) {
                    case "s":
                        return val * 1000;
                    case "m":
                        return val * 60000;
                    case "h":
                        return val * 3600000;
                    case "d":
                        return val * 86400000;
                    default:
                        return val;
                }
            }
        }
        return 0;
    }

    /**
     * Track a temporary file for automatic TTL expiration and process exit cleanup.
     */
    public track(
        filePath: string,
        options: TempFileOptions = {},
    ): TempFileResult {
        const sys = getSysApi();
        const ttlMs = TempFileManager.parseTTL(options.ttl);
        const autoCleanup = options.autoCleanupOnExit !== false;
        const now = Date.now();
        const expiresAt = ttlMs > 0 ? now + ttlMs : null;

        let timer: ReturnType<typeof setTimeout> | null = null;

        if (ttlMs > 0) {
            timer = setTimeout(() => {
                this.removeFile(filePath);
            }, ttlMs);
            if (typeof timer.unref === "function") {
                timer.unref();
            }
        }

        const entry: TrackedTempFile = {
            filePath,
            timer,
            autoCleanupOnExit: autoCleanup,
        };

        this.trackedFiles.set(filePath, entry);

        const filename = sys.path.basename(filePath);
        let size = 0;
        try {
            const stat = sys.fs.stats(filePath);
            size = (stat as any)?.size || 0;
        } catch {}

        const cleanupFn = (): boolean => this.removeFile(filePath);

        return {
            path: filePath,
            filename,
            size,
            createdAt: now,
            expiresAt,
            remove: cleanupFn,
            cleanup: cleanupFn,
        };
    }

    /**
     * Remove a single tracked temporary file safely using native XyPriss FS API.
     */
    public removeFile(filePath: string): boolean {
        const sys = getSysApi();
        const entry = this.trackedFiles.get(filePath);
        if (entry?.timer) {
            clearTimeout(entry.timer);
        }
        this.trackedFiles.delete(filePath);

        try {
            if (sys.fs.exist(filePath)) {
                sys.fs.rm(filePath, { force: true });
                logger.debug("fs", `Cleaned up temp file: ${filePath}`);
                return true;
            }
        } catch (err: any) {
            logger.warn(
                "fs",
                `Failed to remove temp file ${filePath}: ${err?.message}`,
            );
        }
        return false;
    }

    /**
     * Clean up all active tracked temporary files.
     */
    public cleanupAll(): number {
        const sys = getSysApi();
        let count = 0;
        for (const [filePath, entry] of this.trackedFiles.entries()) {
            if (entry.timer) clearTimeout(entry.timer);
            try {
                if (sys.fs.exist(filePath)) {
                    sys.fs.rm(filePath, { force: true });
                    count++;
                }
            } catch {}
        }
        this.trackedFiles.clear();
        return count;
    }

    /**
     * Register process exit hooks to clean up temporary files automatically on exit/SIGINT/SIGTERM.
     */
    private registerExitHooks(): void {
        if (this.exitHooksRegistered) return;
        this.exitHooksRegistered = true;

        const performExitCleanup = () => {
            const sys = getSysApi();
            for (const [filePath, entry] of this.trackedFiles.entries()) {
                if (entry.autoCleanupOnExit) {
                    try {
                        if (sys.fs.exist(filePath)) {
                            sys.fs.rm(filePath, { force: true });
                        }
                    } catch {}
                }
            }
            this.trackedFiles.clear();

            // Auto-clean the entire session temp directory (tmpUserDir)
            try {
                const tmpUserDir = sys.path.tmpUserDir;
                if (tmpUserDir && sys.fs.exist(tmpUserDir)) {
                    sys.fs.rm(tmpUserDir, { force: true });
                    logger.debug("fs", `Cleaned up session temp dir: ${tmpUserDir}`);
                }
            } catch (err: any) {
                logger.warn("fs", `Failed to clean session temp dir: ${err?.message}`);
            }
        };

        process.once("exit", performExitCleanup);
        process.once("beforeExit", performExitCleanup);
        process.once("SIGINT", () => {
            performExitCleanup();
            process.exit(0);
        });
        process.once("SIGTERM", () => {
            performExitCleanup();
            process.exit(0);
        });
    }
}

import path from "node:path";
import { XyPrissRunner } from "./XyPrissRunner";
import { FSApi } from "./FSApi";
import { SysApi } from "./SysApi";

/**
 * XyPriss File System API (Unified Bridge)
 *
 * A modern, modular API bridging Node.js and Rust for extreme performance.
 * This class serves as the primary gateway to the Nehonix system ecosystem.
 *
 * @example
 * ```typescript
 * const xfs = new XyPrissFS({ __root__: process.cwd() });
 * const files = xfs.$ls(".");
 * const cpu = xfs.sys.cpu();
 * ```
 */
export class XyPrissFS {
    private runner: XyPrissRunner;

    /** Filesystem-specific operations. */
    public fs: FSApi;

    /** System monitoring and intelligence. */
    public sys: SysApi;

    constructor(private context: { __root__: string }) {
        this.runner = new XyPrissRunner(context.__root__);
        this.fs = new FSApi(this.runner);
        this.sys = new SysApi(this.runner);
    }

    // ========== PATH OPERATIONS (Local JS for performance) ==========

    /**
     * Resolves paths relative to the project root.
     */
    public $resolve(...paths: string[]): string {
        return path.resolve(this.context.__root__, ...paths);
    }

    /**
     * Joins path segments using platform-specific separators.
     */
    public $join(...paths: string[]): string {
        return path.join(...paths);
    }

    /**
     * Returns the directory name of a path.
     */
    public $dirname(p: string): string {
        return path.dirname(p);
    }

    /**
     * Returns the base name of a path.
     */
    public $basename(p: string, ext?: string): string {
        return path.basename(p, ext);
    }

    /**
     * Returns the file extension.
     */
    public $extname(p: string): string {
        return path.extname(p);
    }

    /**
     * Calculates the relative path between two points.
     */
    public $relative(from: string, to: string): string {
        return path.relative(this.$resolve(from), this.$resolve(to));
    }

    /**
     * Normalizes a path string.
     */
    public $normalize(p: string): string {
        return path.normalize(p);
    }

    // ========== IO PROXIES TO FSApi (Delegated to Rust) ==========

    /** Check if a path exists. */
    public $exists(p: string): boolean {
        try {
            return this.fs.check(p).exists;
        } catch {
            return false;
        }
    }

    /** Check if path is a directory. */
    public $isDir(p: string): boolean {
        try {
            return this.fs.stats(p).is_dir === true;
        } catch {
            return false;
        }
    }

    /** Check if path is a regular file. */
    public $isFile(p: string): boolean {
        try {
            return this.fs.stats(p).is_file === true;
        } catch {
            return false;
        }
    }

    /** High-performance directory listing. */
    public $ls(p: string): string[] {
        return this.fs.ls(p);
    }

    /** Recursive directory listing with optional filter. */
    public $lsRecursive(
        p: string,
        filter?: (path: string) => boolean
    ): string[] {
        const files = this.fs.ls(p, { recursive: true });
        return filter ? files.filter(filter) : files;
    }

    /** Reads file as UTF8 string. */
    public $readFile(p: string, encoding: BufferEncoding = "utf8"): string {
        return this.fs.read(p);
    }

    /** Reads and parses a JSON file. */
    public $readJson<T = any>(p: string): T {
        return JSON.parse(this.fs.read(p));
    }

    /** Safely reads JSON, returning default value on error. */
    public $readJsonSafe<T = any>(p: string, defaultValue: T): T {
        try {
            return this.$readJson(p);
        } catch {
            return defaultValue;
        }
    }

    /** Writes string data to file. */
    public $writeFile(p: string, data: string): void {
        this.fs.write(p, data);
    }

    /** Serializes and writes data to a JSON file. */
    public $writeJson(p: string, data: any): void {
        this.fs.write(p, JSON.stringify(data, null, 2));
    }

    /** Creates a directory recursively. */
    public $mkdir(p: string, recursive = true): void {
        this.fs.mkdir(p, { parents: recursive });
    }

    /** Touches a file. */
    public $touch(p: string): void {
        this.fs.touch(p);
    }

    /** Removes a file or directory forcibly. */
    public $rm(p: string, force = true): void {
        this.fs.rm(p, { force });
    }

    /** Copies a file or directory. */
    public $copy(src: string, dest: string, overwrite = true): void {
        this.fs.copy(src, dest);
    }

    /** Lists subdirectories only. */
    public $lsDirs(p: string): string[] {
        try {
            const items = this.fs.ls(p, { stats: true });
            return items
                .filter((item: any) => item[1].is_dir)
                .map((item: any) => item[0]);
        } catch {
            return [];
        }
    }

    /** Lists regular files only. */
    public $lsFiles(p: string): string[] {
        try {
            const items = this.fs.ls(p, { stats: true });
            return items
                .filter((item: any) => item[1].is_file)
                .map((item: any) => item[0]);
        } catch {
            return [];
        }
    }
}


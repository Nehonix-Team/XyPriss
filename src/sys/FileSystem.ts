import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

/**
 * Interface representing the result of a system command response from xsys.
 */
interface CommandResult<T = any> {
    status: "ok" | "error";
    data?: T;
    message?: string;
}

/**
 * Internal runner for the xsys Rust binary.
 * Handles execution and JSON parsing for all system and filesystem operations.
 */
class XyPrissRunner {
    private binaryPath: string;

    constructor(private root: string) {
        // The binary is expected to be in the project root's bin directory
        this.binaryPath = path.resolve(process.cwd(), "bin", "xsys");

        // Fallback for development if not found in root bin
        if (!fs.existsSync(this.binaryPath)) {
            const devPath = path.resolve(
                process.cwd(),
                "tools",
                "xypriss-sys",
                "target",
                "release",
                "xsys"
            );
            if (fs.existsSync(devPath)) {
                this.binaryPath = devPath;
            }
        }
    }

    /**
     * Executes a command synchronously and returns the parsed JSON result.
     * Standardizes all responses into a Promise-like data structure.
     */
    public runSync<T = any>(
        module: string,
        action: string,
        args: string[] = [],
        options: any = {}
    ): T {
        const cmdArgs: string[] = ["--root", this.root];

        if (options.verbose) cmdArgs.push("--verbose");
        if (options.quiet) cmdArgs.push("--quiet");
        cmdArgs.push("--json");

        cmdArgs.push(module, action, ...args);

        // Add specific flags from options
        for (const [key, value] of Object.entries(options)) {
            if (["verbose", "quiet", "json"].includes(key)) continue;
            if (value === true) cmdArgs.push(`--${key}`);
            else if (value !== false && value !== undefined) {
                cmdArgs.push(`--${key}`, String(value));
            }
        }

        try {
            const output = execSync(
                `"${this.binaryPath}" ${cmdArgs.join(" ")}`,
                {
                    encoding: "utf8",
                    maxBuffer: 1024 * 1024 * 50, // 50MB buffer
                }
            );
            const result: CommandResult<T> = JSON.parse(output);

            if (result.status === "error") {
                throw new Error(
                    result.message ||
                        `Unknown error in xsys ${module} ${action}`
                );
            }

            return result.data as T;
        } catch (error: any) {
            if (error.stdout) {
                try {
                    const result = JSON.parse(error.stdout);
                    throw new Error(result.message || error.message);
                } catch {
                    throw error;
                }
            }
            throw error;
        }
    }
}

/**
 * Professional Filesystem API bridging to the xsys Rust binary.
 * Provides high-performance, root-aware filesystem operations.
 */
export class FSApi {
    constructor(private runner: XyPrissRunner) {}

    /**
     * Lists directory contents.
     * @param p Path to list.
     * @param options Execution options (stats, recursive).
     * @returns Array of file/directory names or detailed stat objects.
     */
    public ls(
        p: string,
        options: { stats?: boolean; recursive?: boolean } = {}
    ): any[] {
        return this.runner.runSync("fs", "ls", [p], options);
    }

    /**
     * Reads file content as a string.
     * @param p File path.
     * @param options Read options (e.g., bytes for hex string).
     */
    public read(p: string, options: { bytes?: boolean } = {}): string {
        return this.runner.runSync("fs", "read", [p], options);
    }

    /**
     * Writes data to a file.
     * @param p File path.
     * @param data String content to write.
     * @param options Write options (e.g., append).
     */
    public write(
        p: string,
        data: string,
        options: { append?: boolean } = {}
    ): void {
        this.runner.runSync("fs", "write", [p, data], options);
    }

    /**
     * Copies a file or directory.
     * @param src Source path.
     * @param dest Destination path.
     * @param options Copy options (e.g., show progress).
     */
    public copy(
        src: string,
        dest: string,
        options: { progress?: boolean } = {}
    ): void {
        this.runner.runSync("fs", "copy", [src, dest], options);
    }

    /**
     * Moves or renames a file or directory.
     * @param src Source path.
     * @param dest Destination path.
     */
    public move(src: string, dest: string): void {
        this.runner.runSync("fs", "move", [src, dest]);
    }

    /**
     * Removes a file or directory.
     * @param p Path to remove.
     * @param options Remove options (e.g., force).
     */
    public rm(p: string, options: { force?: boolean } = {}): void {
        this.runner.runSync("fs", "rm", [p], options);
    }

    /**
     * Creates a directory.
     * @param p Directory path.
     * @param options Creation options (e.g., parents).
     */
    public mkdir(p: string, options: { parents?: boolean } = {}): void {
        this.runner.runSync("fs", "mkdir", [p], options);
    }

    /**
     * Creates an empty file or updates timestamps.
     */
    public touch(p: string): void {
        this.runner.runSync("fs", "touch", [p]);
    }

    /**
     * Retrieves detailed file statistics.
     */
    public stats(p: string): any {
        return this.runner.runSync("fs", "stats", [p]);
    }

    /**
     * Calculates the SHA-256 hash of a file.
     */
    public hash(p: string): string {
        return this.runner.runSync("fs", "hash", [p]);
    }

    /**
     * Verifies a file's hash against a provided value.
     */
    public verify(p: string, hash: string): boolean {
        return this.runner.runSync("fs", "verify", [p, hash]);
    }

    /**
     * Gets the size of a file or directory.
     */
    public size(p: string, options: { human?: boolean } = {}): number | string {
        return this.runner.runSync("fs", "size", [p], options);
    }

    /**
     * Changes file permissions (Unix only).
     */
    public chmod(p: string, mode: string): void {
        this.runner.runSync("fs", "chmod", [p, mode]);
    }

    /**
     * Gets disk usage information for the given path.
     */
    public diskUsage(p: string): any {
        return this.runner.runSync("fs", "disk-usage", [p]);
    }
}

/**
 * Professional System Monitoring and Analysis API bridging to xsys.
 * Provides deep insights into hardware, processes, and environment.
 */
export class SysApi {
    constructor(private runner: XyPrissRunner) {}

    /**
     * Gets general system information (OS, Hostname, Uptime).
     */
    public info(extended = false): any {
        return this.runner.runSync("sys", "info", [], { extended });
    }

    /**
     * Gets CPU usage and core information.
     */
    public cpu(cores = false): any {
        return this.runner.runSync("sys", "cpu", [], { cores });
    }

    /**
     * Gets memory (RAM/Swap) utilization statistics.
     */
    public memory(watch = false): any {
        return this.runner.runSync("sys", "memory", [], { watch });
    }

    /**
     * Lists available disks and their mount points.
     */
    public disks(mount?: string): any {
        return this.runner.runSync("sys", "disks", [], { mount });
    }

    /**
     * Gets network interface statistics.
     */
    public network(interfaceName?: string): any {
        return this.runner.runSync("sys", "network", [], {
            interface: interfaceName,
        });
    }

    /**
     * Lists and filters active processes.
     */
    public processes(
        options: { pid?: number; topCpu?: number; topMem?: number } = {}
    ): any {
        return this.runner.runSync("sys", "processes", [], options);
    }

    /**
     * Runs automated diagnostic checks and returns a health score.
     */
    public health(): any {
        return this.runner.runSync("sys", "health");
    }

    /**
     * Manages environment variables.
     */
    public env(variable?: string): any {
        return this.runner.runSync("sys", "env", variable ? [variable] : []);
    }

    /**
     * Recursively finds files matching a regex pattern.
     */
    public find(p: string, pattern: string): string[] {
        return this.runner.runSync("search", "find", [p], { pattern });
    }

    /**
     * Searches for text patterns within files (Grep).
     */
    public grep(p: string, pattern: string): any[] {
        return this.runner.runSync("search", "grep", [p, pattern]);
    }
}

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

    // ========== BACKWARD COMPATIBILITY PROXIES TO FSApi ==========

    /** Check if a path exists. */
    public $exists(p: string): boolean {
        try {
            return fs.existsSync(this.$resolve(p));
        } catch {
            return false;
        }
    }

    /** Check if path is a directory. */
    public $isDir(p: string): boolean {
        try {
            return fs.statSync(this.$resolve(p)).isDirectory();
        } catch {
            return false;
        }
    }

    /** Check if path is a regular file. */
    public $isFile(p: string): boolean {
        try {
            return fs.statSync(this.$resolve(p)).isFile();
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
        const files = this.runner.runSync<string[]>("fs", "ls", [p], {
            recursive: true,
        });
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
        const fullPath = this.$resolve(p);
        try {
            return fs.readdirSync(fullPath).filter((item) => {
                return fs.statSync(path.join(fullPath, item)).isDirectory();
            });
        } catch {
            return [];
        }
    }

    /** Lists regular files only. */
    public $lsFiles(p: string): string[] {
        const fullPath = this.$resolve(p);
        try {
            return fs.readdirSync(fullPath).filter((item) => {
                return fs.statSync(path.join(fullPath, item)).isFile();
            });
        } catch {
            return [];
        }
    }
}


import { PathApi } from "./PathApi";

/**
 * **Professional Filesystem API (High Performance)**
 *
 * Provides a unified, high-performance interface for all filesystem operations.
 * This API offers significant performance advantages for recursive operations,
 * bulk file handling, and large directory scanning.
 *
 * **Key Features:**
 * - **Atomic Operations**: Many operations are atomic at the system level.
 * - **Recursive Power**: Recursive copy, delete, and list operations are highly optimized.
 * - **Convenience Methods**: Includes helpers like `$readJson` and `$lsRecursive`.
 * - **Direct Access**: Inherits all methods from `PathApi`.
 *
 * @final This API is part of the core system inheritance chain.
 * @access Public API via `__sys__` (e.g., `__sys__.$ls(...)`).
 */
export class FSApi extends PathApi {
    // =========================================================================
    // BASE OPERATIONS (High Performance Core)
    // =========================================================================

    /**
     * **List Directory Contents**
     *
     * Lists files and directories within a specified path. Efficiently handles large directories.
     * Supports optional stats gathering and recursive listing handled directly by the system for speed.
     *
     * @param {string} p - The directory path to list.
     * @param {Object} [options] - Configuration options.
     * @param {boolean} [options.stats=false] - If true, returns detailed metadata tuple `[path, stats]` instead of just paths.
     * @param {boolean} [options.recursive=false] - If true, lists all subdirectories recursively.
     * @returns {string[] | Array<[string, any]>} An array of file paths or `[path, stats]` tuples.
     *
     * @example
     * ```typescript
     * // Simple listing
     * const files = __sys__.$ls("src");
     *
     * // Recursive listing with stats
     * const allFiles = __sys__.$ls("src", { recursive: true, stats: true });
     * ```
     */
    public $ls = (
        p: string,
        options: { stats?: boolean; recursive?: boolean } = {}
    ) => this.runner.runSync("fs", "ls", [p], options);

    /**
     * **Read File Content**
     *
     * Reads the entire contents of a file.
     * Can return a UTF-8 string (default) or raw bytes (hex string or array) if requested.
     *
     * @param {string} p - The file path to read.
     * @param {Object} [options] - Read options.
     * @param {boolean} [options.bytes=false] - If true, returns content as a byte-representation string/array.
     * @returns {string} The file contents.
     *
     * @example
     * ```typescript
     * const content = __sys__.$read("README.md");
     * console.log(content);
     * ```
     */
    public $read = (p: string, options: { bytes?: boolean } = {}) =>
        this.runner.runSync("fs", "read", [p], options);

    /**
     * **Write File Content**
     *
     * Writes data to a file, replacing the file if it already exists.
     * Supports appending data to the end of the file.
     *
     * @param {string} p - The file path involved.
     * @param {string} data - The string data to write.
     * @param {Object} [options] - Write options.
     * @param {boolean} [options.append=false] - If true, appends data to the file instead of overwriting.
     * @returns {void}
     *
     * @example
     * ```typescript
     * __sys__.$write("logs.txt", "Log entry\n", { append: true });
     * ```
     */
    public $write = (
        p: string,
        data: string,
        options: { append?: boolean } = {}
    ) => this.runner.runSync("fs", "write", [p, data], options);

    /**
     * **Copy File or Directory**
     *
     * Recursively copies a file or directory from source to destination.
     * This operation is handled entirely at the system level for maximum throughput.
     *
     * @param {string} src - Source path.
     * @param {string} dest - Destination path.
     * @param {Object} [options] - Copy options.
     * @param {boolean} [options.progress=false] - Whether to show progress (CLI only usually).
     * @returns {void}
     *
     * @example
     * ```typescript
     * // Copy entire folder structure
     * __sys__.$copy("src", "src_backup");
     * ```
     */
    public $copy = (
        src: string,
        dest: string,
        options: { progress?: boolean } = {}
    ) => this.runner.runSync("fs", "copy", [src, dest], options);

    /**
     * **Move/Rename File or Directory**
     *
     * Moves or renames a file or directory.
     *
     * @param {string} src - Current path.
     * @param {string} dest - New path.
     * @returns {void}
     *
     * @example
     * ```typescript
     * __sys__.$move("old_name.txt", "new_name.txt");
     * ```
     */
    public $move = (src: string, dest: string) =>
        this.runner.runSync("fs", "move", [src, dest]);

    /**
     * **Remove File or Directory**
     *
     * Deletes a file or directory.
     * Use `{ force: true }` to recursively delete directories (like `rm -rf`).
     *
     * @param {string} p - Path to remove.
     * @param {Object} [options] - Removal options.
     * @param {boolean} [options.force=true] - Force deletion (recursive for directories).
     * @returns {void}
     *
     * @example
     * ```typescript
     * // Danger: Recursively delete folder
     * __sys__.$rm("temp_files", { force: true });
     * ```
     */
    public $rm = (p: string, options: { force?: boolean } = {}) =>
        this.runner.runSync("fs", "rm", [p], options);

    /**
     * **Create Directory**
     *
     * Creates a directory.
     * Use `{ parents: true }` to create parent directories as needed (like `mkdir -p`).
     *
     * @param {string} p - Directory path to create.
     * @param {Object} [options] - Creation options.
     * @param {boolean} [options.parents=true] - Create parent directories if they don't exist.
     * @returns {void}
     *
     * @example
     * ```typescript
     * __sys__.$mkdir("dist/assets/images", { parents: true });
     * ```
     */
    public $mkdir = (p: string, options: { parents?: boolean } = {}) =>
        this.runner.runSync("fs", "mkdir", [p], options);

    /**
     * **Touch File**
     *
     * Creates an empty file or updates the access and modification times of an existing file.
     *
     * @param {string} p - File path.
     * @returns {void}
     *
     * @example
     * ```typescript
     * __sys__.$touch("lockfile");
     * ```
     */
    public $touch = (p: string) => this.runner.runSync("fs", "touch", [p]);

    /**
     * **Get File Statistics**
     *
     * Retrieves detailed metadata about a file or directory.
     * Includes size, permissions, modification times, and type information.
     *
     * @param {string} p - Path to query.
     * @returns {any} Stats object (size, is_file, is_dir, modified, etc.).
     *
     * @example
     * ```typescript
     * const stats = __sys__.$stats("package.json");
     * console.log(`Last modified: ${stats.modified}`);
     * ```
     */
    public $stats = (p: string) => this.runner.runSync("fs", "stats", [p]);

    /**
     * **Calculate File Hash**
     *
     * Calculates the cryptographic hash (SHA-256) of a file's content.
     * Extremely fast.
     *
     * @param {string} p - File path.
     * @returns {string} Hexadecimal hash string.
     *
     * @example
     * ```typescript
     * const hash = __sys__.$hash("firmware.bin");
     * ```
     */
    public $hash = (p: string) => this.runner.runSync("fs", "hash", [p]);

    /**
     * **Verify File Hash**
     *
     * Verifies that a file matches a given hash.
     * Useful for integrity checks.
     *
     * @param {string} p - File path.
     * @param {string} hash - expected hash.
     * @returns {boolean} True if the hash matches.
     */
    public $verify = (p: string, hash: string) =>
        this.runner.runSync("fs", "verify", [p, hash]);

    /**
     * **Get Size**
     *
     * Gets the size of a file or directory.
     *
     * @param {string} p - Path to query.
     * @param {Object} [options]
     * @param {boolean} [options.human=false] - Return human readable string (e.g. "5 MB") instead of bytes.
     * @returns {number|string} Size in bytes or human-readable format.
     */
    public $size = (
        p: string,
        options: { human?: boolean } = {}
    ): number | string => this.runner.runSync("fs", "size", [p], options);

    /**
     * **Change Permissions (chmod)**
     *
     * Changes file access permissions (Unix/Linux/macOS).
     *
     * @param {string} p - File path.
     * @param {string} mode - Permission mode (e.g., "755", "+x").
     * @returns {void}
     */
    public $chmod = (p: string, mode: string) =>
        this.runner.runSync("fs", "chmod", [p, mode]);

    /**
     * **Disk Usage Info**
     *
     * Gets information about available disk space on the filesystem containing the path.
     *
     * @param {string} p - Path to check.
     * @returns {Object} Disk usage stats (total, free, available).
     */
    public $diskUsage = (p: string) =>
        this.runner.runSync("fs", "disk-usage", [p]);

    /**
     * **Check Path Status**
     *
     * Fast check for existence and permissions.
     *
     * @param {string} p - Path to check.
     * @returns {Object} `{ exists: boolean, readable: boolean, writable: boolean }`
     */
    public $check = (
        p: string
    ): { exists: boolean; readable: boolean; writable: boolean } =>
        this.runner.runSync("fs", "check", [p]);

    /**
     * **Directory Usage (DU)**
     *
     * Calculates the total size and file count of a directory recursively.
     * Uses parallel processing for extreme speed on large trees.
     *
     * @param {string} p - Directory path.
     * @returns {Object} `{ path: string, size: number, file_count: number, dir_count: number }`
     *
     * @example
     * ```typescript
     * const usage = __sys__.$du("node_modules");
     * console.log(`node_modules size: ${usage.size} bytes`);
     * ```
     */
    public $du = (
        p: string
    ): { path: string; size: number; file_count: number; dir_count: number } =>
        this.runner.runSync("fs", "du", [p]);

    /**
     * **Synchronize Directories (Mirror)**
     *
     * Mirrors the source directory to the destination.
     * Efficiently copies new/changed files and handles deletions if strict validation is added later.
     *
     * @param {string} src - Source directory.
     * @param {string} dest - Destination directory.
     * @returns {void}
     */
    public $sync = (src: string, dest: string) =>
        this.runner.runSync("fs", "sync", [src, dest]);

    /**
     * **Find Duplicates (Dedupe)**
     *
     * Scans a directory for duplicate files based on content hashing.
     * Very useful for cleaning up storage.
     *
     * @param {string} p - Directory to scan.
     * @returns {Array} List of duplicate groups, each containing hash and paths.
     */
    public $dedupe = (
        p: string
    ): { hash: string; paths: string[]; size: number }[] =>
        this.runner.runSync("fs", "dedupe", [p]);

    // =========================================================================
    // CONVENIENCE HELPERS (Developer Experience)
    // =========================================================================

    /**
     * **Recursive List (Array)**
     *
     * Helper to get a flat array of file paths recursively.
     *
     * @param {string} p - Directory path.
     * @param {Function} [filter] - Optional filter function.
     * @returns {string[]} Array of file paths.
     */
    public $lsRecursive = (
        p: string,
        filter?: (path: string) => boolean
    ): string[] => {
        const files = this.$ls(p, { recursive: true });
        return filter ? files.filter(filter) : files;
    };

    /**
     * **List Directories Only**
     *
     * Returns minimal list of subdirectory names.
     *
     * @param {string} p - Directory path.
     * @returns {string[]} Array of directory paths.
     */
    public $lsDirs = (p: string): string[] => {
        try {
            const items = this.$ls(p, { stats: true });
            return items
                .filter((item: any) => item[1].is_dir)
                .map((item: any) => item[0]);
        } catch {
            return [];
        }
    };

    /**
     * **List Files Only**
     *
     * Returns minimal list of regular file paths.
     *
     * @param {string} p - Directory path.
     * @returns {string[]} Array of file paths.
     */
    public $lsFiles = (p: string): string[] => {
        try {
            const items = this.$ls(p, { stats: true });
            return items
                .filter((item: any) => item[1].is_file)
                .map((item: any) => item[0]);
        } catch {
            return [];
        }
    };

    /**
     * **Read File (String Alias)**
     *
     * Reads a file as a UTF-8 string.
     *
     * @param {string} p - File path.
     * @returns {string} File content.
     */
    public $readFile = (p: string, encoding: BufferEncoding = "utf8"): string =>
        this.$read(p);

    /**
     * **Read JSON File**
     *
     * Reads a file and parses it as JSON.
     * Throws an error if the file doesn't exist or is invalid JSON.
     *
     * @template T
     * @param {string} p - File path.
     * @returns {T} Parsed JSON object.
     *
     * @example
     * ```typescript
     * const pkg = __sys__.$readJson<PackageJson>("package.json");
     * console.log(pkg.version);
     * ```
     */
    public $readJson = <T = any>(p: string): T => JSON.parse(this.$read(p));

    /**
     * **Safe Read JSON**
     *
     * Attempts to read and parse a JSON file. Returns `defaultValue` on any error (missing file, invalid JSON).
     *
     * @template T
     * @param {string} p - File path.
     * @param {T} defaultValue - Value to return on failure.
     * @returns {T} Parsed object or default value.
     */
    public $readJsonSafe = <T = any>(p: string, defaultValue: T): T => {
        try {
            return this.$readJson(p);
        } catch {
            return defaultValue;
        }
    };

    /**
     * **Write File (Alias)**
     *
     * Writes string data to a file.
     */
    public $writeFile = (p: string, data: string): void => this.$write(p, data);

    /**
     * **Write JSON File**
     *
     * Serializes an object to JSON (pretty-printed) and writes it to a file.
     *
     * @param {string} p - File path.
     * @param {any} data - Object to write.
     * @returns {void}
     */
    public $writeJson = (p: string, data: any): void =>
        this.$write(p, JSON.stringify(data, null, 2));

    /**
     * **Check Existence**
     *
     * Returns true if the path exists.
     *
     * @param {string} p - Path to check.
     * @returns {boolean} True if exists.
     */
    public $exists = (p: string): boolean => {
        try {
            return this.$check(p).exists;
        } catch {
            return false;
        }
    };

    /**
     * **Is Directory**
     *
     * Returns true if the path exists and is a directory.
     *
     * @param {string} p - Path to check.
     * @returns {boolean} True if directory.
     */
    public $isDir = (p: string): boolean => {
        try {
            return this.$stats(p).is_dir === true;
        } catch {
            return false;
        }
    };

    /**
     * **Is File**
     *
     * Returns true if the path exists and is a regular file.
     *
     * @param {string} p - Path to check.
     * @returns {boolean} True if file.
     */
    public $isFile = (p: string): boolean => {
        try {
            return this.$stats(p).is_file === true;
        } catch {
            return false;
        }
    };
}


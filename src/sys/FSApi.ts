/* *****************************************************************************
 * Nehonix XyPriss System
 *
 * ACCESS RESTRICTIONS:
 * - This software is exclusively for use by Authorized Personnel of NEHONIX
 * - Intended for Internal Use only within NEHONIX operations
 * - No rights granted to unauthorized individuals or entities
 * - All modifications are works made for hire assigned to NEHONIX
 *
 * PROHIBITED ACTIVITIES:
 * - Copying, distributing, or sublicensing without written permission
 * - Reverse engineering, decompiling, or disassembling
 * - Creating derivative works without explicit authorization
 * - External use or commercial distribution outside NEHONIX
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * For questions or permissions, contact:
 * NEHONIX Legal Department
 * Email: legal@nehonix.com
 * Website: www.nehonix.com
 ***************************************************************************** */

import { Logger } from "../../shared/logger";
import { PathApi } from "./PathApi";
import {
    FileStats,
    DirUsage,
    DedupeGroup,
    PathCheck,
    SearchMatch,
    BatchRenameChange,
} from "./types";
import { XyPrissRunner } from "./XyPrissRunner";

/**
 * **Professional Filesystem API (High Performance)**
 *
 * The `FSApi` class provides a unified, high-performance interface for all filesystem operations.
 * By offloading complex tasks to the optimized system binary, it offers significant performance
 * advantages over standard Node.js `fs` calls, particularly for recursive operations,
 * bulk file handling, and large directory scanning.
 *
 * **Key Features:**
 * - **Atomic Operations:** Ensures data integrity during writes and moves.
 * - **Recursive Power:** Recursive copy, delete, and list operations are highly optimized.
 * - **Smart Helpers:** Includes robust convenience methods like `$readJson` and `$lsRecursive`.
 * - **Unified Access:** Inherits all path manipulation capabilities from `PathApi`.
 *
 * @class FSApi
 * @extends PathApi
 */
export class FSApi extends PathApi {
    private logger: Logger;

    constructor(runner: XyPrissRunner) {
        super(runner);
        this.logger = new Logger();
    }

    // =========================================================================
    // BASE OPERATIONS (High Performance Core)
    // =========================================================================

    /**
     * **List Directory Contents ($ls)**
     *
     * Lists files and directories within a specified path. This method is designed to
     * efficiently handle large directories containing thousands of files. It supports
     * powerful options for recursion and detailed statistics gathering.
     *
     * @param {string} p - The directory path to list.
     * @param {Object} [options] - Configuration options for the listing.
     * @param {boolean} [options.stats=false] - If true, returns detailed metadata tuple `[path, stats]` instead of just path strings.
     * @param {boolean} [options.recursive=false] - If true, lists all subdirectories recursively.
     * @returns {string[] | Array<[string, any]>} An array of file paths or `[path, stats]` tuples depending on options.
     *
     * @example
     * // Simple listing of the current directory
     * const files = __sys__.$ls(".");
     * console.log(files); // -> ["src", "package.json", "README.md"]
     *
     * @example
     * // Recursive listing with stats to find large files
     * const allItems = __sys__.$ls("src", { recursive: true, stats: true });
     * allItems.forEach(([path, currentStats]) => {
     *     if (currentStats.size > 1024 * 1024) {
     *         console.log(`Large file found: ${path}`);
     *     }
     * });
     */
    public $ls = (
        p: string,
        options: { stats?: boolean; recursive?: boolean } = {}
    ): string[] | [string, FileStats][] =>
        this.runner.runSync("fs", "ls", [p], options);

    /**
     * **Read File Content ($read)**
     *
     * Reads the entire contents of a file. By default, it returns a UTF-8 string.
     * It can also return raw byte data if the `bytes` option is set, useful for
     * handling binary formats like images or compiled assets.
     *
     * @param {string} p - The file path to read.
     * @param {Object} [options] - Read options.
     * @param {boolean} [options.bytes=false] - If true, returns content as a byte-representation string/array.
     * @returns {string} The contents of the file.
     *
     * @example
     * // Reading a configuration text file
     * const config = __sys__.$read("config/app.conf");
     * console.log(config);
     *
     * @example
     * // Reading a binary file signature
     * const header = __sys__.$read("assets/logo.png", { bytes: true });
     */
    public $read = (p: string, options: { bytes?: boolean } = {}): string =>
        this.runner.runSync("fs", "read", [p], options);

    /**
     * **Write File Content ($write)**
     *
     * Writes data to a file. This method replaces the file if it already exists, unless
     * the `append` option is true. It ensures atomic writes where possible to prevent
     * partial file corruption.
     *
     * @param {string} p - The destination file path.
     * @param {string} data - The string data to write.
     * @param {Object} [options] - Write options.
     * @param {boolean} [options.append=false] - If true, adds data to the end of the file instead of overwriting.
     * @returns {void}
     *
     * @example
     * // writing a new file
     * __sys__.$write("notes.txt", "Important meeting at 10 AM");
     *
     * @example
     * // Appending to a log file
     * __sys__.$write("server.log", "[INFO] Startup ok\n", { append: true });
     */
    public $write = (
        p: string,
        data: string,
        options: { append?: boolean } = {}
    ): void => this.runner.runSync("fs", "write", [p, data], options);

    /**
     * **Copy File or Directory ($copy)**
     *
     * Recursively copies a file or directory from `src` to `dest`.
     * This operation is highly optimized and handles complex folder structures seamlessly.
     *
     * @param {string} src - The source path to copy from.
     * @param {string} dest - The destination path to copy to.
     * @param {Object} [options] - Copy options.
     * @param {boolean} [options.progress=false] - Whether to show progress output (mostly for CLI usage).
     * @returns {void}
     *
     * @example
     * // Backing up the source directory
     * __sys__.$copy("src", "src_backup_2025");
     *
     * @example
     * // Copying a single config file
     * __sys__.$copy(".env", ".env.example");
     */
    public $copy = (
        src: string,
        dest: string,
        options: { progress?: boolean } = {}
    ): void => this.runner.runSync("fs", "copy", [src, dest], options);

    /**
     * **Move/Rename File or Directory ($move)**
     *
     * Moves or renames a file or directory effectively. This works across different
     * paths and can be used for simple renaming or moving items to new directories.
     *
     * @param {string} src - The current path of the item.
     * @param {string} dest - The new path or name.
     * @returns {void}
     *
     * @example
     * // Renaming a file
     * __sys__.$move("temp.txt", "final.txt");
     *
     * @example
     * // Moving a file to a subfolder
     * __sys__.$move("image.png", "assets/images/image.png");
     */
    public $move = (src: string, dest: string): void =>
        this.runner.runSync("fs", "move", [src, dest]);

    /**
     * **Remove File or Directory ($rm)**
     *
     * Deletes a file or directory. To delete directories (especially those with content!),
     * usage of the `{ force: true }` option is typically required to permit recursive deletion.
     *
     * @param {string} p - The path to remove.
     * @param {Object} [options] - Removal options.
     * @param {boolean} [options.force=true] - Force deletion (enables recursion for directories).
     * @returns {void}
     *
     * @example
     * // Removing a single file
     * __sys__.$rm("junk.tmp");
     *
     * @example
     * // Removing an entire directory tree (Careful!)
     * __sys__.$rm("dist", { force: true });
     */
    public $rm = (p: string, options: { force?: boolean } = {}): void =>
        this.runner.runSync("fs", "rm", [p], options);

    /**
     * **Create Directory ($mkdir)**
     *
     * Creates a new directory. Defaults to behavior similar to `mkdir -p` (Unix),
     * meaning it will create all necessary parent directories if `parents: true` is set.
     *
     * @param {string} p - The directory path to create.
     * @param {Object} [options] - Creation options.
     * @param {boolean} [options.parents=true] - Automatically create parent directories.
     * @returns {void}
     *
     * @example
     * // Creating a nested directory structure
     * __sys__.$mkdir("api/v1/controllers", { parents: true });
     */
    public $mkdir = (p: string, options: { parents?: boolean } = {}): void =>
        this.runner.runSync("fs", "mkdir", [p], options);

    /**
     * **Touch File ($touch)**
     *
     * Creates an empty file if it doesn't exist, or updates the access and modification
     * timestamps of an existing file to the current time.
     *
     * @param {string} p - The file path to touch.
     * @returns {void}
     *
     * @example
     * // Creating a lock file
     * __sys__.$touch("deploy.lock");
     */
    public $touch = (p: string): void =>
        this.runner.runSync("fs", "touch", [p]);

    /**
     * **Create Symbolic Link ($link)**
     *
     * Creates a symbolic link pointing from `dest` to `src`.
     *
     * @param {string} src - The target path the link will point to.
     * @param {string} dest - The path where the link will be created.
     * @returns {void}
     */
    public $link = (src: string, dest: string): void =>
        this.runner.runSync("fs", "link", [src, dest]);

    /**
     * **Get File Statistics ($stats)**
     *
     * Retrieves detailed system metadata about a file or directory, including size,
     * permissions, creation/modification times, and type (file vs directory).
     *
     * @param {string} p - The path to investigate.
     * @returns {FileStats} A stats object containing `size`, `is_file`, `is_dir`, `modified`, etc.
     *
     * @example
     * // Checking file modification time
     * const info = __sys__.$stats("package.json");
     * console.log(`Config size: ${info.size} bytes`);
     * console.log(`Last Modified: ${info.modified}`);
     */
    public $stats = (p: string): FileStats =>
        this.runner.runSync("fs", "stats", [p]);

    /**
     * **Calculate File Hash ($hash)**
     *
     * Calculates the cryptographic hash (SHA-256) of a file's content.
     * This is highly optimized and useful for verifying file integrity or checking for changes.
     *
     * @param {string} p - The file path to hash.
     * @returns {string} The hexadecimal hash string.
     *
     * @example
     * // Getting a hash for caching purposes
     * const fingerprint = __sys__.$hash("bundle.js");
     */
    public $hash = (p: string): string =>
        this.runner.runSync("fs", "hash", [p]);

    /**
     * **Verify File Hash ($verify)**
     *
     * Verifies that a file's calculated hash matches the provided expected hash.
     * This is useful for integrity checks after downloads or transfers.
     *
     * @param {string} p - The file path to check.
     * @param {string} hash - The expected hash string.
     * @returns {boolean} `true` if the hashes match, `false` otherwise.
     */
    public $verify = (p: string, hash: string): boolean => {
        const res = this.runner.runSync("fs", "verify", [p, hash]) as any;
        return res?.valid === true;
    };

    /**
     * **Get Size ($size)**
     *
     * Gets the size of a file or directory. For directories, it calculates the size
     * of the directory entry itself, not the recursive size (use `$du` for that).
     *
     * @param {string} p - Path to query.
     * @param {Object} [options]
     * @param {boolean} [options.human=false] - Return human readable string (e.g. "5 MB") instead of bytes.
     * @returns {number|string} Size in bytes or human-readable format.
     */
    public $size = (
        p: string,
        options: { human?: boolean } = {}
    ): number | string => {
        const res = this.runner.runSync("fs", "size", [p], options) as any;
        if (options.human) return res.formatted;
        return res.bytes;
    };

    /**
     * **Change Permissions ($chmod)**
     *
     * Changes file access permissions.
     * **Important:** Currently supports only **Octal** strings (e.g., "755", "644").
     * Symbolic notation (e.g., "+x") is not yet supported by the system binary.
     *
     * @param {string} p - File path.
     * @param {string} mode - Permission mode string (Octal only, e.g. "755").
     * @returns {void}
     *
     * @example
     * // Making a script executable (rwxr-xr-x)
     * __sys__.$chmod("bin/run.sh", "755");
     */
    public $chmod = (p: string, mode: string): void =>
        this.runner.runSync("fs", "chmod", [p, mode]);

    /**
     * **Check Path Status ($check)**
     *
     * Performs a fast composed check for existence, readability, and writability.
     * This avoids multiple system calls when you need to know the state of a path.
     *
     * @param {string} p - Path to check.
     * @returns {PathCheck} `{ exists: boolean, readable: boolean, writable: boolean }`
     * @example
     * // Checking file status
     * const status = __sys__.$check("package.json");
     * console.log(`File exists: ${status.exists}`);
     * console.log(`File readable: ${status.readable}`);
     * console.log(`File writable: ${status.writable}`);
     */
    public $check = (p: string): PathCheck =>
        this.runner.runSync("fs", "check", [p]);

    /**
     * **Directory Usage ($du)**
     *
     * Calculates the total size and file count of a directory recursively.
     * This uses parallel processing to scan directory trees significantly faster
     * than standard iteration methods.
     *
     * @param {string} p - Directory path to analyze.
     * @returns {DirUsage} `{ path: string, size: number, file_count: number, dir_count: number }`
     *
     * @example
     * // Analyzing project size
     * const usage = __sys__.$du("node_modules");
     * console.log(`Dependencies size: ${(usage.size / 1024 / 1024).toFixed(2)} MB`);
     */
    public $du = (p: string): DirUsage => this.runner.runSync("fs", "du", [p]);

    /**
     * **Synchronize Directories ($sync)**
     *
     * Mirrors the source directory to the destination. It efficiently copies new
     * or changed files relative to the source.
     *
     * @param {string} src - Source directory.
     * @param {string} dest - Destination directory.
     * @returns {void}
     *
     * @example
     * // Backing up critical data
     * __sys__.$sync("data/live", "data/backup");
     */
    public $sync = (src: string, dest: string): void =>
        this.runner.runSync("fs", "sync", [src, dest]);

    /**
     * **Find Duplicates ($dedupe)**
     *
     * Scans a directory for duplicate files based on content hashing.
     * This provides a report of files that have identical content but different paths.
     *
     * @param {string} p - Directory to scan.
     * @returns {DedupeGroup[]} List of duplicate groups, each containing hash, total size and paths.
     *
     * @example
     * // Finding wasted space
     * const dupes = __sys__.$dedupe("assets");
     * console.log(`Found ${dupes.length} groups of duplicates.`);
     */
    public $dedupe = (p: string): DedupeGroup[] =>
        this.runner.runSync("fs", "dedupe", [p]);

    // =========================================================================
    // CONVENIENCE HELPERS (Developer Experience)
    // =========================================================================

    /**
     * **Recursive List as Array ($lsRecursive)**
     *
     * A helper method to get a flat array of all file paths recursively within a directory.
     * It includes an optional filter function to include only specific files.
     *
     * @param {string} p - Directory path.
     * @param {Function} [filter] - Optional filter function `(path) => boolean`.
     * @returns {string[]} Array of matching file paths.
     *
     * @example
     * // Finding all TypeScript files in src
     * const tsFiles = __sys__.$lsRecursive("src", (p) => p.endsWith(".ts"));
     */
    public $lsRecursive = (
        p: string,
        filter?: (path: string) => boolean
    ): string[] => {
        const files = this.$ls(p, { recursive: true });
        // Handling the return type union from $ls
        if (
            Array.isArray(files) &&
            files.length > 0 &&
            typeof files[0] !== "string"
        ) {
            // Should not happen with current helper usage unless stats=true passed implicitly
            return [];
        }
        return filter
            ? (files as string[]).filter(filter)
            : (files as string[]);
    };

    /**
     * **List Directories Only ($lsDirs)**
     *
     * A helper to list only the immediate subdirectories of a given path.
     *
     * @param {string} p - Directory path.
     * @returns {string[]} Array of directory names.
     *
     * @example
     * // Listing modules
     * const modules = __sys__.$lsDirs("node_modules");
     * console.log(modules); // -> ["@types", "express", ...]
     */
    public $lsDirs = (p: string): string[] => {
        try {
            const items = this.$ls(p, { stats: true });
            return (items as [string, FileStats][])
                .filter((item) => item[1].is_dir)
                .map((item) => item[0]);
        } catch {
            return [];
        }
    };

    /**
     * **List Files Only ($lsFiles)**
     *
     * A helper to list only the immediate files of a given path (ignoring directories).
     *
     * @param {string} p - Directory path.
     * @returns {string[]} Array of file names.
     *
     * @example
     * // Getting files in root
     * const files = __sys__.$lsFiles(".");
     * console.log(files); // -> ["package.json", "tsconfig.json", ...]
     */
    public $lsFiles = (p: string): string[] => {
        try {
            const items = this.$ls(p, { stats: true });
            return (items as [string, FileStats][])
                .filter((item) => item[1].is_file)
                .map((item) => item[0]);
        } catch {
            return [];
        }
    };

    /**
     * **Read File to String ($readFile)**
     *
     * An alias for `$read` that defaults to UTF-8 encoding.
     *
     * @param {string} p - File path.
     * @param {string} [encoding="utf8"] - File encoding.
     * @returns {string} File content.
     *
     * @example
     * // Reading a text file
     * const content = __sys__.$readFile("README.md");
     */
    public $readFile = (p: string, encoding: BufferEncoding = "utf8"): string =>
        this.$read(p);

    /**
     * **Read & Parse JSON ($readJson)**
     *
     * Reads a file and automatically attempts to parse it as JSON.
     * Throws an error if the file is missing or contains invalid JSON.
     *
     * @template T
     * @param {string} p - File path.
     * @returns {T} The parsed JSON object.
     *
     * @example
     * // Loading package configuration
     * const pkg = __sys__.$readJson<PackageJson>("package.json");
     * console.log(pkg.version);
     */
    public $readJson = <T = any>(p: string): T => JSON.parse(this.$read(p));

    /**
     * **Safe Read JSON ($readJsonSafe)**
     *
     * Attempts to read and parse a JSON file safely. If ANY error occurs (file not found,
     * permission denied, bad JSON), it returns the provided `defaultValue` instead of throwing.
     *
     * @template T
     * @param {string} p - File path.
     * @param {T} defaultValue - The value to return if reading fails.
     * @returns {T} The parsed object or the default value.
     *
     * @example
     * // Safely loading user config with fallback
     * const userConfig = __sys__.$readJsonSafe("user-config.json", { theme: "dark" });
     */
    public $readJsonSafe = <T = any>(p: string, defaultValue: T): T => {
        try {
            return this.$readJson(p);
        } catch {
            return defaultValue;
        }
    };

    /**
     * **Write String to File ($writeFile)**
     *
     * A clearly named alias for writing string content to a file.
     *
     * @param {string} p - File path.
     * @param {string} data - Content to write.
     *
     * @example
     * // Writing a simple text file
     * __sys__.$writeFile("hello.txt", "Hello World");
     */
    public $writeFile = (p: string, data: string): void => this.$write(p, data);

    /**
     * **Write Object to JSON File ($writeJson)**
     *
     * Serializes a JavaScript object to a JSON string (pretty-printed with 2 spaces)
     * and writes it to a file.
     *
     * @param {string} p - File path.
     * @param {any} data - Object to serialize and write.
     * @returns {void}
     *
     * @example
     * // Saving application state
     * __sys__.$writeJson("state.json", { status: "active", uptime: 1234 });
     */
    public $writeJson = (p: string, data: any): void =>
        this.$write(p, JSON.stringify(data, null, 2));

    /**
     * **Check Existence ($exists)**
     *
     * A boolean check to see if a path exists. Returns `false` on any error (like permission denied),
     * ensuring it is safe to use in conditions.
     *
     * @param {string} p - Path to check.
     * @returns {boolean} `true` if exists, `false` otherwise.
     *
     * @example
     * // Conditional logic based on file presence
     * if (__sys__.$exists("config.local.json")) {
     *     console.log("Loading local config...");
     * }
     */
    public $exists = (p: string): boolean => {
        try {
            return this.$check(p).exists;
        } catch {
            return false;
        }
    };

    /**
     * **Check if Directory ($isDir)**
     *
     * Returns `true` if the path exists AND is a directory.
     *
     * @param {string} p - Path to check.
     * @returns {boolean} `true` if directory.
     *
     * @example
     * // Verifying path type
     * if (__sys__.$isDir("uploads")) {
     *     console.log("Uploads directory exists.");
     * }
     */
    public $isDir = (p: string): boolean => {
        try {
            return this.$stats(p).is_dir === true;
        } catch {
            return false;
        }
    };

    /**
     * **Check if File ($isFile)**
     *
     * Returns `true` if the path exists AND is a regular file.
     *
     * @param {string} p - Path to check.
     * @returns {boolean} `true` if file.
     *
     * @example
     * // Verifying path type
     * if (__sys__.$isFile("server.js")) {
     *     console.log("Server script found.");
     * }
     */
    public $isFile = (p: string): boolean => {
        try {
            return this.$stats(p).is_file === true;
        } catch {
            return false;
        }
    };

    /**
     * **Check if Symlink ($isSymlink)**
     *
     * Returns `true` if the path exists AND is a symbolic link.
     *
     * @param {string} p - Path to check.
     * @returns {boolean} `true` if symlink.
     */
    public $isSymlink = (p: string): boolean => {
        try {
            return this.$stats(p).is_symlink === true;
        } catch {
            return false;
        }
    };

    /**
     * **Check if Empty ($isEmpty)**
     *
     * Checks if a file has 0 bytes or if a directory has no children.
     *
     * @param {string} p - Path to check.
     * @returns {boolean} `true` if empty.
     */
    public $isEmpty = (p: string): boolean => {
        try {
            if (this.$isFile(p)) return this.$size(p) === 0;
            if (this.$isDir(p)) return this.$ls(p).length === 0;
            return false;
        } catch {
            return false;
        }
    };

    // ===================================
    // EXTENDED I/O HELPERS
    // ===================================

    /**
     * **Read Lines ($readLines)**
     *
     * Reads a file and splits it into an array of lines.
     * Handles both CRLF and LF line endings.
     *
     * @param {string} p - File path.
     * @returns {string[]} Array of lines.
     */
    public $readLines = (p: string): string[] => {
        return this.$read(p).split(/\r?\n/);
    };

    /**
     * **Read Non-Empty Lines ($readNonEmptyLines)**
     *
     * Reads a file and returns only lines that are not empty (after trimming).
     *
     * @param {string} p - File path.
     * @returns {string[]} Filtered lines.
     */
    public $readNonEmptyLines = (p: string): string[] => {
        return this.$readLines(p).filter((l) => l.trim().length > 0);
    };

    /**
     * **Append to File ($append)**
     *
     * Appends data to the end of a file.
     *
     * @param {string} p - File path.
     * @param {string} data - Content to append.
     */
    public $append = (p: string, data: string): void => {
        this.$write(p, data, { append: true });
    };

    /**
     * **Append Line ($appendLine)**
     *
     * Appends a string followed by a platform-specific newline to a file.
     *
     * @param {string} p - File path.
     * @param {string} line - Line content.
     */
    public $appendLine = (p: string, line: string): void => {
        this.$write(p, line + "\n", { append: true });
    };

    /**
     * **Write If Not Exists ($writeIfNotExists)**
     *
     * Writes to a file only if it does not already exist.
     *
     * @param {string} p - File path.
     * @param {string} data - Content to write.
     * @returns {boolean} `true` if written, `false` if file already existed.
     */
    public $writeIfNotExists = (p: string, data: string): boolean => {
        if (this.$exists(p)) return false;
        this.$write(p, data);
        return true;
    };

    // ===================================
    // EXTENDED DIRECTORY HELPERS
    // ===================================

    /**
     * **Ensure Directory ($ensureDir)**
     *
     * Ensures that a directory exists, creating it (and parents) if needed.
     * Alias for `$mkdir(p, { parents: true })`.
     *
     * @param {string} p - Directory path.
     */
    public $ensureDir = (p: string): void => {
        this.$mkdir(p, { parents: true });
    };

    /**
     * **List Full Paths ($lsFullPath)**
     *
     * Lists items in a directory returning their full absolute paths.
     *
     * @param {string} p - Directory path.
     * @returns {string[]} Array of absolute paths.
     */
    public $lsFullPath = (p: string): string[] => {
        const root = this.$resolve(p);
        return this.$ls(p).map((f) => this.$join(root, f as string));
    };

    // ===================================
    // EXTENDED MANIPULATION HELPERS
    // ===================================

    /**
     * **Rename ($rename)**
     *
     * Renames a file or directory. Semantic alias for `$move`.
     *
     * @param {string} oldPath - Current path.
     * @param {string} newPath - New path/name.
     */
    public $rename = (oldPath: string, newPath: string): void => {
        this.$move(oldPath, newPath);
    };

    /**
     * **Duplicate ($duplicate)**
     *
     * Creates a copy of an item in the same directory with a new name.
     *
     * @param {string} p - Path to original item.
     * @param {string} newName - Name for the copy.
     */
    public $duplicate = (p: string, newName: string): void => {
        const dest = this.$join(this.$dirname(p), newName);
        this.$copy(p, dest);
    };

    /**
     * **Remove If Exists ($rmIfExists)**
     *
     * specific method to remove a path only if it exists, swallowing errors if missing.
     *
     * @param {string} p - Path to remove.
     */
    public $rmIfExists = (p: string): void => {
        if (this.$exists(p)) this.$rm(p, { force: true });
    };

    /**
     * **Empty Directory ($emptyDir)**
     *
     * Empties a directory by removing all content but keeping the directory itself.
     *
     * @param {string} p - Directory path.
     */
    public $emptyDir = (p: string): void => {
        if (this.$exists(p)) {
            this.$rm(p, { force: true });
            this.$mkdir(p);
        }
    };

    // ===================================
    // EXTENDED METADATA & SEARCH
    // ===================================

    /**
     * **Human Readable Size ($sizeHuman)**
     *
     * Returns the size of a file or directory in a human-readable string (e.g. "5 MB").
     *
     * @param {string} p - Path.
     * @returns {string} Formatted size.
     */
    public $sizeHuman = (p: string): string => {
        return this.$size(p, { human: true }) as string;
    };

    /**
     * **Get Creation Time ($createdAt)**
     *
     * @param {string} p
     * @returns {Date} Creation date.
     */
    public $createdAt = (p: string): Date => {
        return new Date(this.$stats(p).created * 1000);
    };

    /**
     * **Get Modification Time ($modifiedAt)**
     *
     * @param {string} p
     * @returns {Date} Last modification date.
     */
    public $modifiedAt = (p: string): Date => {
        return new Date(this.$stats(p).modified * 1000);
    };

    /**
     * **Get Access Time ($accessedAt)**
     *
     * @param {string} p
     * @returns {Date} Last access date.
     */
    public $accessedAt = (p: string): Date => {
        return new Date(this.$stats(p).accessed * 1000);
    };

    /**
     * **Compare Content ($isSameContent)**
     *
     * Checks if two files have identical content by comparing their hashes.
     *
     * @param {string} p1 - First file.
     * @param {string} p2 - Second file.
     * @returns {boolean} `true` if identical.
     */
    public $isSameContent = (p1: string, p2: string): boolean => {
        return this.$hash(p1) === this.$hash(p2);
    };

    /**
     * **Check if Newer ($isNewer)**
     *
     * Returns true if p1 was modified more recently than p2.
     *
     * @param {string} p1
     * @param {string} p2
     * @returns {boolean}
     */
    public $isNewer = (p1: string, p2: string): boolean => {
        return this.$modifiedAt(p1) > this.$modifiedAt(p2);
    };

    /**
     * **Search In Files ($searchInFiles)**
     *
     * Recursively searches for text patterns inside files (grep).
     *
     * @param {string} dir - Directory to search.
     * @param {string} pattern - Text or Regex pattern.
     * @returns {SearchMatch[]} Matches.
     */
    public $searchInFiles = (dir: string, pattern: string): SearchMatch[] => {
        return this.runner.runSync("search", "grep", [dir, pattern]);
    };

    /**
     * **Find by Pattern ($findByPattern)**
     *
     * Recursively finds files matching a regex pattern on their filename.
     *
     * @param {string} dir - Directory to search.
     * @param {string} pattern - Regex pattern.
     * @returns {string[]} Matching paths.
     */
    public $findByPattern = (dir: string, pattern: string): string[] => {
        return this.runner.runSync("search", "find", [dir], { pattern });
    };

    /**
     * **Find by Extension ($findByExt)**
     *
     * Recursively finds files with a specific extension.
     *
     * @param {string} dir - Directory to search.
     * @param {string} ext - Extension (e.g. ".ts" or "ts").
     * @returns {string[]} Matching paths.
     */
    public $findByExt = (dir: string, ext: string): string[] => {
        const cleanExt = ext.startsWith(".") ? ext : "." + ext;
        // Escape the dot for regex and match end of line
        const pattern = ".*\\" + cleanExt + "$";
        return this.$findByPattern(dir, pattern);
    };

    /**
     * **Batch Rename ($batchRename)**
     *
     * Performs a mass rename of files within a directory using regex patterns.
     *
     * @param {string} path - Directory root.
     * @param {string} pattern - Regex to find.
     * @param {string} replacement - String to replace with (supports $1, $2 etc).
     * @param {boolean} [dryRun=false] - If true, only returns a preview of changes.
     * @returns {number | BatchRenameChange[]} Count of renamed files or preview list.
     *
     * @example
     * // Renaming all .txt to .md
     * __sys__.$batchRename("docs", "(.*)\\.txt$", "$1.md");
     */
    public $batchRename = (
        path: string,
        pattern: string,
        replacement: string,
        dryRun = false
    ): number | BatchRenameChange[] => {
        return this.runner.runSync("search", "rename", [path], {
            pattern,
            replacement,
            dryRun,
        });
    };

    /**
     * **Find Modified Files ($findModifiedSince)**
     *
     * Recursively finds files that have been modified within the last N hours.
     *
     * @param {string} dir - Directory to search.
     * @param {number} hours - Number of hours to look back.
     * @returns {string[]} Matching paths.
     */
    public $findModifiedSince = (dir: string, hours: number): string[] => {
        return this.runner.runSync("search", "modified", [dir], { hours });
    };

    // =========================================================================
    // ARCHIVE & COMPRESSION (High Speed)
    // =========================================================================

    /**
     * **Compress File ($compress)**
     *
     * Compresses a file using Gzip.
     *
     * @param {string} src - Source file.
     * @param {string} dest - Destination file (.gz).
     * @returns {void}
     */
    public $compress = (src: string, dest: string): void => {
        this.runner.runSync("archive", "compress", [], { src, dest });
    };

    /**
     * **Decompress File ($decompress)**
     *
     * Decompresses a Gzip file (.gz).
     *
     * @param {string} src - Source file (.gz).
     * @param {string} dest - Destination file.
     * @returns {void}
     */
    public $decompress = (src: string, dest: string): void => {
        this.runner.runSync("archive", "decompress", [], { src, dest });
    };

    /**
     * **Create Tar Archive ($tar)**
     *
     * Creates a Tar archive of a directory.
     *
     * @param {string} dir - Directory to archive.
     * @param {string} output - Output tar file.
     * @returns {void}
     */
    public $tar = (dir: string, output: string): void => {
        this.runner.runSync("archive", "tar", [], { dir, output });
    };

    /**
     * **Extract Tar Archive ($untar)**
     *
     * Extracts a Tar archive to a destination directory.
     *
     * @param {string} archive - Tar file to extract.
     * @param {string} dest - Destination directory.
     * @returns {void}
     */
    public $untar = (archive: string, dest: string): void => {
        this.runner.runSync("archive", "untar", [], { archive, dest });
    };

    // =========================================================================
    // WATCHING & STREAMING APIs
    // =========================================================================

    /**
     * **Watch Path for Changes ($watch)**
     *
     * Monitors one or more files or directories for system-level events.
     * This uses the high-performance Rust `notify` engine and provides real-time terminal output.
     *
     * @param {string | string[]} p - Path(s) to monitor.
     * @param {Object} [options] - Watch configuration.
     * @param {number} [options.duration=60] - How long to watch in seconds (default: 60s).
     * @returns {void}
     *
     * @example
     * // Watch multiple directories in parallel
     * __sys__.$watch([".", "./src", "./docs"], { duration: 30 });
     */
    public $watch = (
        p: string | string[],
        options: { duration?: number } = {}
    ): void => {
        const duration = options.duration || 60;
        const paths = Array.isArray(p) ? p : [p];
        this.runner.runSync("fs", "watch", paths, {
            duration,
            interactive: true,
        });
    };

    /**
     * **Stream File Content ($stream)**
     *
     * Streams a file's content in chunks using the optimized Rust engine.
     * This is highly memory-efficient for processing large files as it avoids
     * loading the entire file into Node.js memory.
     *
     * @param {string} p - Path to file to stream.
     * @param {Object} [options] - Streaming options.
     * @param {number} [options.chunkSize=8192] - Size of each chunk in bytes.
     * @param {boolean} [options.hex=false] - If true, outputs chunks in hexadecimal format (useful for binary files).
     * @returns {string} The streamed output from the binary.
     *
     * @example
     * // Stream log file efficiently
     * const content = __sys__.$stream("app.log", { chunkSize: 4096 });
     *
     * @example
     * // Read binary data as hex chunks
     * const hex = __sys__.$stream("image.png", { hex: true, chunkSize: 64 });
     */
    public $stream = (
        p: string,
        options: { chunkSize?: number; hex?: boolean } = {}
    ): string => {
        const flags: any = {};
        if (options.chunkSize) flags.chunkSize = options.chunkSize;
        if (options.hex) flags.hex = true;

        // Using the actual 'stream' command in Rust
        return this.runner.runSync("fs", "stream", [p], flags);
    };

    /**
     * **Watch and Process ($watchAndProcess)**
     *
     * Advanced utility that monitors a path and executes a logic callback
     * after the monitoring period finishes.
     *
     * @param {string} p - Path to watch.
     * @param {Function} callback - Logic to execute after the cycle.
     * @param {Object} [options] - Watch options.
     * @param {number} [options.duration=60] - Watch duration in seconds.
     * @returns {void}
     *
     * @example
     * // Watch for 10s then list files
     * __sys__.$watchAndProcess(".", () => {
     *    const files = __sys__.$ls(".");
     *    console.log("Files after watch:", files);
     * }, { duration: 10 });
     */
    public $watchAndProcess = (
        p: string,
        callback: () => void,
        options: { duration?: number } = {}
    ): void => {
        const duration = options.duration || 60;

        // Use vibrant colors for the system message
        const green = "\x1b[32m";
        const cyan = "\x1b[36m";
        const yellow = "\x1b[33m";
        const reset = "\x1b[0m";

        console.log(
            `${green}[SYSTEM]${reset} ${cyan}Starting high-performance watcher on:${reset} ${yellow}${p}${reset} ${cyan}(${duration}s)${reset}`
        );

        // This blocks Node.js as it's a synchronous system call
        this.$watch(p, { duration });

        // Execute callback after detection cycle
        callback();
    };

    /**
     * **Watch File Content ($watchContent)**
     *
     * Deep-monitoring sub-system that watches the actual *content* of one or more files.
     * It can detect additions, deletions, and specific differences in parallel.
     *
     * @param {string | string[]} p - File path(s) to watch content of.
     * @param {Object} [options] - Content watch options.
     * @param {number} [options.duration=60] - Watch duration.
     * @param {boolean} [options.diff=false] - Whether to compute and show detailed changes.
     * @returns {void}
     *
     * @example
     * // Watch content changes for multiple files
     * __sys__.$watchContent(["config.json", "package.json"], { duration: 10, diff: true });
     */
    public $watchContent = (
        p: string | string[],
        options: { duration?: number; diff?: boolean } = {
            diff: true,
        }
    ): void => {
        const duration = options.duration || 60;
        const paths = Array.isArray(p) ? p : [p];
        this.runner.runSync("fs", "watch-content", paths, {
            duration,
            diff: options.diff,
            interactive: true,
        });
    };

    /**
     * **Watch Parallel ($watchParallel)**
     * Alias for `$watch` with multiple paths.
     */
    public $watchParallel = this.$watch;

    /**
     * **Watch Content Parallel ($watchContentParallel)**
     * Alias for `$watchContent` with multiple paths.
     */
    public $watchContentParallel = this.$watchContent;

    /**
     * Alias for $watchAndProcess
     *
     * @description Advanced utility that monitors a path and executes a logic callback
     * after the monitoring period finishes.
     *
     * @param {string} p - Path to watch.
     * @param {Function} callback - Logic to execute after the cycle.
     * @param {Object} [options] - Watch options.
     * @param {number} [options.duration=60] - Watch duration in seconds.
     * @returns {void}
     *
     */
    public $wap(...args: Parameters<typeof this.$watchAndProcess>) {
        return this.$watchAndProcess(...args);
    }

    /**
     * Alias for $watchContent
     * @description Deep-monitoring sub-system that watches the actual *content* of a file.
     * It can detect additions, deletions, and specific differences.
     *
     * @param {string} p - File path to watch content of.
     * @param {Object} [options] - Content watch options.
     * @param {number} [options.duration=60] - Watch duration.
     * @param {boolean} [options.diff=false] - Whether to compute and show detailed changes.
     * @returns {void}
     */
    public $wc(...args: Parameters<typeof this.$watchContent>) {
        return this.$watchContent(...args);
    }

    /**
     * Alias for $watchParallel
     * @description Alias for `$watch` with multiple paths.
     *
     * @param {string | string[]} p - File path(s) to watch content of.
     * @param {Object} [options] - Content watch options.
     * @param {number} [options.duration=60] - Watch duration.
     * @param {boolean} [options.diff=false] - Whether to compute and show detailed changes.
     * @returns {void}
     */
    public $wp(...args: Parameters<typeof this.$watchParallel>) {
        return this.$watchParallel(...args);
    }

    /**
     * Alias for $watchContentParallel
     * @description Alias for `$watchContent` with multiple paths.
     *
     * @param {string | string[]} p - File path(s) to watch content of.
     * @param {Object} [options] - Content watch options.
     * @param {number} [options.duration=60] - Watch duration.
     * @param {boolean} [options.diff=false] - Whether to compute and show detailed changes.
     * @returns {void}
     */
    public $wcp(...args: Parameters<typeof this.$watchContentParallel>) {
        return this.$watchContentParallel(...args);
    }
}


import { Readable, Writable } from "node:stream";
import { XStringify } from "xypriss-security";
import {
    FileStats,
    DirUsage,
    DedupeGroup,
    PathCheck,
    FileOpenFlags,
    OpenFlag,
} from "../types";
import { FSBase } from "./FSBase";
import { XHSCDirectIPC } from "../ipc/XHSCDirectIPC";
import { FileHandle } from "./FileHandle";
import { QuickLogger } from "../../shared/logger/quickLogger";

const logger = QuickLogger.for("XHSC:FS")

/**
 * **Core Filesystem Operations**
 */
export class FSCore extends FSBase {
    /**
     * **List Directory Contents**
     *
     * Retrieves a list of files and directories within a specified path.
     * Can optionally include detailed statistics for each item and recurse
     * into subdirectories.
     *
     * @param {string} p - Absolute or relative path to the directory.
     * @param {Object} [options] - Listing options.
     * @param {boolean} [options.stats=false] - If true, returns an array of `[name, stats]` tuples.
     * @param {boolean} [options.recursive=false] - If true, explores all subdirectories.
     * @returns {string[] | [string, FileStats][]} List of entry names or entry/stats pairs.
     *
     * @example
     * // List names
     * const files = __sys__.fs.ls("/var/log");
     *
     * // List with stats and recursion
     * const details = __sys__.fs.ls("./src", { stats: true, recursive: true });
     * details.forEach(([name, stats]) => console.log(`${name}: ${stats.size} bytes`));
     */
    public ls(
        p: string,
        options: { stats: true; recursive?: boolean },
    ): [string, FileStats][];
    public ls(
        p: string,
        options?: { stats?: false; recursive?: boolean },
    ): string[];
    public ls(
        p: string,
        options: { stats?: boolean; recursive?: boolean } = {},
    ): string[] | [string, FileStats][] {
        return this.runner.runSync("fs", "ls", [p], options);
    }

    /**
     * **Read File Content (Asynchronous)**
     *
     * Asynchronously reads the full content of a file. Supports reading as
     * a string (default) or as a hex-encoded string if bytes are requested.
     *
     * @param {string} p - Path to the file.
     * @param {Object} [options] - Read options.
     * @param {boolean} [options.bytes=false] - If true, returns the raw data as a hex string.
     * @returns {Promise<string>} The file content.
     *
     * @example
     * const content = await __sys__.fs.read("config.yaml");
     * console.log(content);
     */
    public read = async (
        p: string,
        options: { bytes?: boolean } = {},
    ): Promise<string> => {
        const res = (await this.runner.runAsync(
            "fs",
            "read",
            [p],
            options,
        )) as any;
        return res?.data !== undefined ? res.data : res;
    };

    /**
     * **Read File Content (Synchronous)**
     *
     * Synchronously reads the full content of a file. Blocks execution until
     * the read operation is complete.
     *
     * @param {string} p - Path to the file.
     * @param {Object} [options] - Read options.
     * @param {boolean} [options.bytes=false] - If true, returns the raw data as a hex string.
     * @returns {string} The file content.
     *
     * @example
     * const content = __sys__.fs.readSync("/etc/hosts");
     */
    public readSync = (
        p: string,
        options: { bytes?: boolean } = {},
    ): string => {
        const res = this.runner.runSync("fs", "read", [p], options) as any;
        return res?.data !== undefined ? res.data : res;
    };

    /**
     * **High-Performance Read Stream**
     *
     * Creates a readable stream directly from the native XHSC engine. This is
     * the most memory-efficient way to process large files.
     *
     * @param {string} p - Path to the file.
     * @param {Object} [options] - Stream options.
     * @param {number} [options.start] - Start byte offset.
     * @param {number} [options.end] - End byte offset (inclusive).
     * @returns {Readable} A standard Node.js Readable stream.
     *
     * @example
     * const stream = __sys__.fs.createReadStream("big-data.log", { start: 1024, end: 2048 });
     * stream.pipe(process.stdout);
     */
    public createReadStream = (
        p: string,
        options: { start?: number; end?: number } = {},
    ): Readable => {
        const { start, end } = options;
        const streamOptions: any = {};
        if (start !== undefined) streamOptions.offset = start;
        if (start !== undefined && end !== undefined) {
            streamOptions.limit = end - start + 1;
        } else if (end !== undefined) {
            streamOptions.limit = end + 1;
        }

        return this.runner.runStream("fs", "cat", [p], streamOptions);
    };

    /**
     * **High-Performance Write Stream**
     *
     * Creates a writable stream directly to the native XHSC engine. Ideal for
     * generating large files or piping network data to disk.
     *
     * @param {string} p - Destination file path.
     * @returns {Writable & { close(): void }} A standard Node.js Writable stream with a close method.
     *
     * @example
     * const writer = __sys__.fs.createWriteStream("output.tar.gz");
     * source.pipe(writer);
     */
    public createWriteStream = (p: string): Writable & { close(): void } =>
        this.runner.runWritableStream("fs", "cat-write", [p]) as any;

    /**
     * **Write File Content (Asynchronous)**
     *
     * Asynchronously writes data to a file. Automatically handles Buffers,
     * Objects (JSON serialization), and primitives.
     *
     * @param {string} p - Destination path.
     * @param {any} data - Data to write.
     * @param {Object} [options] - Write options.
     * @param {boolean} [options.append=false] - If true, appends to the file instead of overwriting.
     * @param {boolean} [options.ensureFile=true] - If true, creates parent directories if they don't exist.
     * @returns {Promise<void>}
     *
     * @example
     * await __sys__.fs.writeFile("data.json", { user: "iDevo" });
     * await __sys__.fs.writeFile("log.txt", "Event happened\n", { append: true });
     */
    public writeFile = async (
        p: string,
        data: any,
        options: { append?: boolean; ensureFile?: boolean } = {},
    ): Promise<void> => {
        const { ensureFile = true } = options;

        if (ensureFile) {
            const fs = require("fs");
            const path = require("path");
            const dir = path.dirname(p);
            if (dir && dir !== "." && !fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        let writeData: any = "";
        if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
            writeData = data;
        } else if (typeof data === "object" && data !== null) {
            writeData = XStringify(data);
        } else {
            writeData = String(data);
        }

        await this.runner.runAsync("fs", "write", [p], {
            ...options,
            input: writeData,
        });
    };

    /**
     * **Write File Content (Synchronous)**
     *
     * Synchronously writes data to a file. Blocks execution until the write
     * is finalized on disk.
     *
     * @param {string} p - Destination path.
     * @param {any} data - Data to write.
     * @param {Object} [options] - Write options.
     * @param {boolean} [options.append=false] - If true, appends to the file instead of overwriting.
     * @param {boolean} [options.ensureFile=true] - If true, creates parent directories if they don't exist.
     */
    public writeFileSync = (
        p: string,
        data: any,
        options: { append?: boolean; ensureFile?: boolean } = {},
    ): void => {
        const { ensureFile = true } = options;

        if (ensureFile) {
            const fs = require("fs");
            const path = require("path");
            const dir = path.dirname(p);
            if (dir && dir !== "." && !fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        }

        let writeData: any = "";
        if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
            writeData = data;
        } else if (typeof data === "object" && data !== null) {
            writeData = XStringify(data);
        } else {
            writeData = String(data);
        }

        this.runner.runSync("fs", "write", [p], {
            ...options,
            input: writeData,
        });
    };

    /**
     * **Copy File or Directory**
     *
     * Recursively copies a file or a complete directory tree from source to destination.
     *
     * @param {string} src - Source path.
     * @param {string} dest - Destination path.
     * @param {Object} [options] - Copy options.
     * @param {boolean} [options.progress=false] - If true, emits progress events for large operations.
     */
    public copy = (
        src: string,
        dest: string,
        options: { progress?: boolean } = {},
    ): void => this.runner.runSync("fs", "copy", [src, dest], options);

    /**
     * **Move/Rename File or Directory**
     *
     * Atomically moves or renames a path. If source and destination are on different
     * filesystems, a copy-and-delete strategy is used.
     *
     * @param {string} src - Original path.
     * @param {string} dest - New path.
     */
    public move = (src: string, dest: string): void =>
        this.runner.runSync("fs", "move", [src, dest]);

    /**
     * **Remove File or Directory**
     *
     * Deletes a file or recursively deletes a directory tree.
     *
     * @param {string} p - Path to remove.
     * @param {Object} [options] - Removal options.
     * @param {boolean} [options.force=false] - If true, ignores errors if the path doesn't exist.
     *
     * @example
     * __sys__.fs.rm("./tmp/cache", { force: true });
     */
    public rm = (p: string, options: { force?: boolean } = {}): void =>
        this.runner.runSync("fs", "rm", [p], options);

    /**
     * **Remove Multiple Files or Directories**
     *
     * Bulk deletion of an array of paths. The operation is applied to each
     * path sequentially via the native engine.
     *
     * @param paths - Array of file or directory paths to delete.
     * @param options - Options forwarded to each `rm` call.
     *
     * @example
     * ```typescript
     * __sys__.fs.rmMany([
     *     ".data/chunk.001",
     *     ".data/chunk.002",
     *     ".data/chunk.003",
     * ], { force: true });
     * ```
     */
    public rmMany = (
        paths: string[],
        options: { force?: boolean } = {},
    ): void => {
        for (const p of paths) {
            this.runner.runSync("fs", "rm", [p], options);
        }
    };

    /**
     * **Create Directory**
     *
     * Creates a new directory.
     *
     * @param {string} p - Path to create.
     * @param {Object} [options] - Options.
     * @param {boolean} [options.parents=false] - If true, creates missing parent directories (mkdir -p).
     *
     * @example
     * __sys__.fs.mkdir("/path/to/new-dir", { parents: true });
     */
    public mkdir = (p: string, options: { parents?: boolean } = {}): void =>
        this.runner.runSync("fs", "mkdir", [p], options);

    /**
     * **Touch File**
     *
     * Updates the access and modification times of a file to the current time.
     * Creates the file if it does not exist.
     *
     * @param {string} p - Path to touch.
     */
    public touch = (p: string): void => this.runner.runSync("fs", "touch", [p]);

    /**
     * **Create Symbolic Link**
     *
     * Creates a symbolic link pointing to a source path.
     *
     * @param {string} src - The target of the link.
     * @param {string} dest - The path where the link will be created.
     */
    public link = (src: string, dest: string): void =>
        this.runner.runSync("fs", "link", [src, dest]);

    /**
     * **Get File Statistics**
     *
     * Retrieves low-level metadata for a path, including size, permissions,
     * and timestamps (creation, modification, access).
     *
     * @param {string} p - Path to query.
     * @returns {FileStats} Metadata object.
     */
    public stats = (p: string): FileStats =>
        this.runner.runSync("fs", "stats", [p]);

    /**
     * **Calculate Cryptographic Hash**
     *
     * Computes the SHA-256 checksum of a file. Optimized for large files
     * using native buffering.
     *
     * @param {string} p - Path to the file.
     * @returns {string} Hex-encoded hash.
     *
     * @example
     * const sha = __sys__.fs.hash("dist.tar.gz");
     */
    public hash = (p: string): string => {
        const res = this.runner.runSync("fs", "hash", [p]) as any;
        return typeof res === "object" ? res.hash : res;
    };

    /**
     * **Verify Integrity**
     *
     * Compares a file's current hash with a provided value to detect
     * corruption or modifications.
     *
     * @param {string} p - Path to the file.
     * @param {string} hash - Expected SHA-256 hash.
     * @returns {boolean} True if hashes match.
     */
    public verify = (p: string, hash: string): boolean => {
        const res = this.runner.runSync("fs", "verify", [p, hash]) as any;
        return res?.valid === true;
    };

    /**
     * **Get Size in Bytes or Human Readable**
     *
     * Retrieves the size of a file or directory.
     *
     * @param {string} p - Path.
     * @param {Object} [options] - Options.
     * @param {boolean} [options.human=false] - If true, returns a string (e.g., '1.5 GB').
     * @returns {number | string} Numeric bytes or formatted string.
     */
    public size = (
        p: string,
        options: { human?: boolean } = {},
    ): number | string => {
        const res = this.runner.runSync("fs", "size", [p], options) as any;
        if (options.human) return res.formatted;
        return res.bytes;
    };

    /**
     * **Change File Permissions**
     *
     * Modifies the access permissions (mode) of a file or directory.
     *
     * @param {string} p - Path.
     * @param {string | number} mode - Octal permissions (e.g., 0o755 or '755').
     */
    public chmod = (p: string, mode: string | number): void => {
        let finalMode: string;
        if (typeof mode === "number") {
            finalMode = "0" + mode.toString(8);
        } else {
            finalMode = mode;
        }
        this.runner.runSync("fs", "chmod", [p, finalMode]);
    };

    /**
     * **Comprehensive Path Existence & State Check**
     *
     * Returns an object indicating if the path exists, and whether it is a
     * file, directory, or symbolic link.
     *
     * @param {string} p - Path to check.
     * @returns {PathCheck} Status object.
     */
    public check = (p: string): PathCheck =>
        this.runner.runSync("fs", "check", [p]);

    /**
     * **Directory Usage Summary**
     *
     * Recursively calculates the total size and file count of a directory.
     *
     * @param {string} p - Directory path.
     * @returns {DirUsage} Usage summary.
     */
    public du = (p: string): DirUsage => this.runner.runSync("fs", "du", [p]);

    /**
     * **Bidirectional Directory Synchronization**
     *
     * Efficiently synchronizes two directories, mirroring changes from source
     * to destination.
     *
     * @param {string} src - Source directory.
     * @param {string} dest - Destination directory.
     */
    public sync = (src: string, dest: string): void =>
        this.runner.runSync("fs", "sync", [src, dest]);

    /**
     * **Content-Based Duplicate Detection**
     *
     * Analyzes a directory for identical files (using hash comparisons) and
     * groups them together.
     *
     * @param {string} p - Search path.
     * @returns {DedupeGroup[]} Groups of duplicate files.
     */
    public dedupe = (p: string): DedupeGroup[] =>
        this.runner.runSync("fs", "dedupe", [p]);

    /**
     * **Open File**
     *
     * Opens a file and returns a numeric file descriptor (or runs a scoped callback).
     *
     * ---
     *
     * ### Modes via `flags`
     *
     * | Flag    | Behavior                                                        |
     * |---------|-----------------------------------------------------------------|
     * | `"r"`   | Read-only. Fails if the file does not exist.                    |
     * | `"r+"`  | Read-write. Fails if the file does not exist.                   |
     * | `"rs+"` | Read-write, bypasses OS cache (useful for NFS / shared drives). |
     * | `"w"`   | Write-only. Creates the file or truncates it if it exists.      |
     * | `"wx"`  | Write-only. Fails if the file already exists (atomic create).   |
     * | `"w+"`  | Read-write. Creates the file or truncates it if it exists.      |
     * | `"wx+"` | Read-write. Fails if the file already exists (atomic create).   |
     * | `"a"`   | Append-only. Creates the file if missing. Writes go to EOF.     |
     * | `"ax"`  | Append-only. Fails if the file already exists (atomic create).  |
     * | `"a+"`  | Read-append. Creates the file if missing. Writes always at EOF. |
     * | `"ax+"` | Read-append. Fails if the file already exists (atomic create).  |
     *
     * > **`x` suffix** — Maps to `O_EXCL` at the OS level: the call succeeds only if
     * > *this* invocation creates the file, preventing race conditions.
     *
     * ---
     *
     * ### Transport strategy
     *
     * The method resolves the file descriptor through two transports, in order:
     *
     * 1. **IPC** (`XYPRISS_IPC_PATH` set) — communicates with the XHSC daemon via a
     *    Unix socket. File descriptors are **stateful and persistent** across calls.
     * 2. **Runner fallback** — used when IPC is unavailable or the environment variable
     *    is not set. Descriptors are **not persistent** across multiple independent calls;
     *    a warning is emitted to the console.
     *
     * ---
     *
     * ### Callback (scoped) mode
     *
     * When a `callback` is provided, the file is opened, passed as a {@link FileHandle}
     * toolbox to the callback, then **automatically closed** in a `finally` block —
     * even if the callback throws. In this mode the method returns `void`.
     *
     * When no callback is provided, the raw numeric file descriptor is returned and
     * **the caller is responsible for closing it**.
     *
     * ---
     *
     * @param p        - Absolute or relative path to the target file.
     * @param flags    - Open mode, as a string flag (default: `"r"`) or a numeric
     *                   `os` constant. See the flag table above.
     * @param callback - Optional scoped handler receiving a {@link FileHandle}.
     *                   When supplied, the handle is closed automatically on completion.
     *
     * @returns The numeric file descriptor when no callback is given; `void` otherwise.
     *
     * @example <caption>Scoped read (handle closed automatically)</caption>
     * ```typescript
     * await __sys__.fs.open("data.bin", "r", async (file) => {
     *     const chunk = await file.read(1024);
     *     console.log(chunk.toString());
     * });
     * ```
     *
     * @example <caption>Manual descriptor (caller must close)</caption>
     * ```typescript
     * const fd = await __sys__.fs.open("output.log", "a");
     * // ... write operations ...
     * await __sys__.fs.close(fd);
     * ```
     */
    public async open(
        p: string,
        flags: FileOpenFlags = "r",
        callback?: (handle: FileHandle) => Promise<void> | void,
    ): Promise<number | void> {
        let id: number;
        const mappedFlags =
            typeof flags === "string" ? this.mapFlags(flags) : flags;

        if (process.env.XYPRISS_IPC_PATH) {
            const ipc = new XHSCDirectIPC(process.env.XYPRISS_IPC_PATH);
            try {
                const res = await ipc.sendCommand("fs", "open", {
                    path: p,
                    flags: mappedFlags,
                    mode: "0644",
                });
                id = res.handle;
            } catch (err) {
                // Fallback to runner if IPC fail but keep it as a backup
                logger.warn(
                    "WARNING: IPC not available, falling back to process-mode. Stateful handles will NOT be persistent across multiple calls.",
                );
                id = (await this.runner.runAsync("fs", "open", [p], {
                    flags: mappedFlags,
                    mode: "0644",
                })) as number;
            } finally {
                ipc.close();
            }
        } else {
            logger.warn(
                "WARNING: XYPRISS_IPC_PATH not set. Stateful handles will NOT be persistent across multiple calls.",
            );
            id = (await this.runner.runAsync("fs", "open", [p], {
                flags: mappedFlags,
                mode: "0644",
            })) as number;
        }

        if (callback) {
            const toolbox = new FileHandle(id, this.runner);
            try {
                await callback(toolbox);
            } finally {
                await toolbox.close();
            }
            return;
        }

        return id;
    }

    /**
     * **Close File Handle**
     *
     * @param handle - The file handle to close.
     */
    public close = async (handle: number): Promise<void> => {
        await this.runner.runAsync("fs", "close", [], { handle });
    };

    private mapFlags(flags: string): number {
        // Native XHSC constants mapping:
        // O_RDONLY = 0, O_WRONLY = 1, O_RDWR = 2, O_APPEND = 1024, O_CREATE = 64, O_EXCL = 128, O_SYNC = 4096, O_TRUNC = 512
        const mapping: Record<string, number> = {
            r: 0, // O_RDONLY
            "r+": 2, // O_RDWR
            "rs+": 2 | 4096, // O_RDWR | O_SYNC
            w: 1 | 64 | 512, // O_WRONLY | O_CREATE | O_TRUNC
            wx: 1 | 64 | 128, // O_WRONLY | O_CREATE | O_EXCL
            "w+": 2 | 64 | 512, // O_RDWR | O_CREATE | O_TRUNC
            "wx+": 2 | 64 | 128, // O_RDWR | O_CREATE | O_EXCL
            a: 1 | 1024 | 64, // O_WRONLY | O_APPEND | O_CREATE
            ax: 1 | 1024 | 64 | 128, // O_WRONLY | O_APPEND | O_CREATE | O_EXCL
            "a+": 2 | 1024 | 64, // O_RDWR | O_APPEND | O_CREATE
            "ax+": 2 | 1024 | 64 | 128, // O_RDWR | O_APPEND | O_CREATE | O_EXCL
        };

        return mapping[flags] ?? 0;
    }
}





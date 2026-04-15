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

/**
 * **Core Filesystem Operations**
 */
export class FSCore extends FSBase {
    /**
     * **List Directory Contents**
     *
     * @example
     * ```typescript
     * const files = __sys__.fs.ls("/path/to/dir");
     * const details = __sys__.fs.ls("/path/to/dir", { stats: true });
     * details.forEach(([name, stats]) => console.log(name, stats.size));
     * ```
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
     * **Read File Content**
     *
     * @example
     * ```typescript
     * const content = await __sys__.fs.read("/path/to/file.txt");
     * ```
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
     * **Read File Content Synchronously**
     *
     * @example
     * ```typescript
     * const content = __sys__.fs.readSync("/path/to/file.txt");
     * ```
     */
    public readSync = (
        p: string,
        options: { bytes?: boolean } = {},
    ): string => {
        const res = this.runner.runSync("fs", "read", [p], options) as any;
        return res?.data !== undefined ? res.data : res;
    };

    /**
     * **Create Read Stream**
     * High-performance streaming direct from the native engine
     *
     * @example
     * ```typescript
     * const stream = __sys__.fs.createReadStream("/path/to/large-file.bin");
     * stream.on('data', (chunk) => console.log(chunk));
     * ```
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
     * **Create Write Stream**
     * High-performance write streaming direct to the native engine
     *
     * @example
     * ```typescript
     * const stream = __sys__.fs.createWriteStream("/path/to/output.bin");
     * stream.write(Buffer.from("some data"));
     * stream.end();
     * ```
     */
    public createWriteStream = (p: string): Writable =>
        this.runner.runWritableStream("fs", "cat-write", [p]);

    /**
     * **Write File**
     *
     * @example
     * ```typescript
     * await __sys__.fs.writeFile("/path/to/file.txt", "Hello World");
     * await __sys__.fs.writeFile("/path/to/data.json", { key: "value" });
     * ```
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
     * **Write File Synchronously**
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
     * @example
     * ```typescript
     * __sys__.fs.copy("source.txt", "dest.txt");
     * ```
     */
    public copy = (
        src: string,
        dest: string,
        options: { progress?: boolean } = {},
    ): void => this.runner.runSync("fs", "copy", [src, dest], options);

    /**
     * **Move/Rename File or Directory**
     */
    public move = (src: string, dest: string): void =>
        this.runner.runSync("fs", "move", [src, dest]);

    /**
     * **Remove File or Directory**
     *
     * @example
     * ```typescript
     * __sys__.fs.rm("/path/to/remove", { force: true });
     * ```
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
     * @example
     * ```typescript
     * __sys__.fs.mkdir("/path/to/new-dir", { parents: true });
     * ```
     */
    public mkdir = (p: string, options: { parents?: boolean } = {}): void =>
        this.runner.runSync("fs", "mkdir", [p], options);

    /**
     * **Touch File**
     */
    public touch = (p: string): void => this.runner.runSync("fs", "touch", [p]);

    /**
     * **Create Symbolic Link**
     */
    public link = (src: string, dest: string): void =>
        this.runner.runSync("fs", "link", [src, dest]);

    /**
     * **Get File Statistics**
     */
    public stats = (p: string): FileStats =>
        this.runner.runSync("fs", "stats", [p]);

    /**
     * **Calculate File Hash**
     *
     * @example
     * ```typescript
     * const checksum = __sys__.fs.hash("package.json");
     * ```
     */
    public hash = (p: string): string => {
        const res = this.runner.runSync("fs", "hash", [p]) as any;
        return typeof res === "object" ? res.hash : res;
    };

    /**
     * **Verify File Hash**
     */
    public verify = (p: string, hash: string): boolean => {
        const res = this.runner.runSync("fs", "verify", [p, hash]) as any;
        return res?.valid === true;
    };

    /**
     * **Get Size**
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
     * **Change Permissions**
     */
    public chmod = (p: string, mode: string): void =>
        this.runner.runSync("fs", "chmod", [p, mode]);

    /**
     * **Check Path Status**
     */
    public check = (p: string): PathCheck =>
        this.runner.runSync("fs", "check", [p]);

    /**
     * **Directory Usage**
     */
    public du = (p: string): DirUsage => this.runner.runSync("fs", "du", [p]);

    /**
     * **Synchronize Directories**
     */
    public sync = (src: string, dest: string): void =>
        this.runner.runSync("fs", "sync", [src, dest]);

    /**
     * **Find Duplicates**
     */
    public dedupe = (p: string): DedupeGroup[] =>
        this.runner.runSync("fs", "dedupe", [p]);

    /**
     * **Open File (Hyper Powerful)**
     *
     * Opens a file for reading, writing, or appending.
     * If a callback is provided, the handle is automatically closed after execution.
     *
     * @param p - Path to the file.
     * @param flags - Open flags (numeric or string constants).
     * @param callback - Optional callback with a FileHandle toolbox.
     *
     * @example
     * ```typescript
     * await __sys__.fs.open("data.bin", "r", async (file) => {
     *    const chunk = await file.read(1024);
     *    console.log(chunk.toString());
     * });
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
                id = (await this.runner.runAsync("fs", "open", [p], {
                    flags: mappedFlags,
                    mode: "0644",
                })) as number;
            } finally {
                ipc.close();
            }
        } else {
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


import { Readable, Writable } from "node:stream";
import { XStringify } from "xypriss-security";
import { FileStats, DirUsage, DedupeGroup, PathCheck } from "../types";
import { FSBase } from "./FSBase";

/**
 * **Core Filesystem Operations**
 */
export class FSCore extends FSBase {
    /**
     * **List Directory Contents**
     */
    public ls = (
        p: string,
        options: { stats?: boolean; recursive?: boolean } = {},
    ): string[] | [string, FileStats][] =>
        this.runner.runSync("fs", "ls", [p], options);

    /**
     * **Read File Content**
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
     */
    public createWriteStream = (p: string): Writable =>
        this.runner.runWritableStream("fs", "cat-write", [p]);

    /**
     * **Write File**
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
     */
    public rm = (p: string, options: { force?: boolean } = {}): void =>
        this.runner.runSync("fs", "rm", [p], options);

    /**
     * **Create Directory**
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
}


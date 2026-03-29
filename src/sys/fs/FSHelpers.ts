import { FileStats } from "../types";
import { FSCore } from "./FSCore";

/**
 * **Filesystem Convenience Helpers**
 */
export class FSHelpers extends FSCore {
    /**
     * **Get System Temp Directory ($tempDir)**
     */
    public $tempDir = (): string => {
        return require("os").tmpdir();
    };

    /**
     * **Recursive List as Array ($lsRecursive)**
     */
    public $lsRecursive = (
        p: string,
        filter?: (path: string) => boolean,
    ): string[] => {
        const files = this.$ls(p, { recursive: true });
        if (
            Array.isArray(files) &&
            files.length > 0 &&
            typeof files[0] !== "string"
        ) {
            return [];
        }
        return filter
            ? (files as string[]).filter(filter)
            : (files as string[]);
    };

    /**
     * **List Directories Only ($lsDirs)**
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
     */
    public $readFile = async (
        p: string,
        encoding: BufferEncoding = "utf8",
    ): Promise<string> => await this.$read(p);

    /**
     * **Read & Parse JSON ($readJson)**
     */
    public $readJson = async <T = any>(p: string): Promise<T> =>
        JSON.parse(await this.$read(p));

    /**
     * **Read File as Bytes ($readBytes)**
     */
    public $readBytes = async (p: string): Promise<Buffer> => {
        const res = (await this.runner.runAsync("fs", "read", [p], {
            bytes: true,
        })) as any;
        const hexData = res?.data !== undefined ? res.data : res;
        return Buffer.from(hexData, "hex");
    };

    /**
     * **Safe Read JSON ($readJsonSafe)**
     */
    public $readJsonSafe = async <T = any>(
        p: string,
        defaultValue: T,
    ): Promise<T> => {
        try {
            return await this.$readJson(p);
        } catch {
            return defaultValue;
        }
    };

    /**
     * **Write Object to JSON File ($writeJson)**
     */
    public $writeJson = async (p: string, data: any): Promise<void> =>
        await this.$writeFile(p, data);

    /**
     * **Check Existence ($exists)**
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

    /**
     * **Read Lines ($readLines)**
     */
    public $readLines = async (p: string): Promise<string[]> => {
        return (await this.$read(p)).split(/\r?\n/);
    };

    /**
     * **Read Non-Empty Lines ($readNonEmptyLines)**
     */
    public $readNonEmptyLines = async (p: string): Promise<string[]> => {
        return (await this.$readLines(p)).filter((l) => l.trim().length > 0);
    };

    /**
     * **Append to File ($append)**
     */
    public $append = async (p: string, data: any): Promise<void> => {
        await this.$writeFile(p, data, { append: true });
    };

    /**
     * **Append Line ($appendLine)**
     */
    public $appendLine = async (p: string, line: any): Promise<void> => {
        await this.$writeFile(p, String(line) + "\n", { append: true });
    };

    /**
     * **Write If Not Exists ($writeIfNotExists)**
     */
    public $writeIfNotExists = async (
        p: string,
        data: any,
    ): Promise<boolean> => {
        if (this.$exists(p)) return false;
        await this.$writeFile(p, data);
        return true;
    };

    /**
     * **Ensure Directory ($ensureDir)**
     */
    public $ensureDir = (p: string): void => {
        this.$mkdir(p, { parents: true });
    };

    /**
     * **List Full Paths ($lsFullPath)**
     */
    public $lsFullPath = (p: string): string[] => {
        const root = this.$resolve(p);
        return this.$ls(p).map((f) => this.$join(root, f as string));
    };

    /**
     * **Rename ($rename)**
     */
    public $rename = (oldPath: string, newPath: string): void => {
        this.$move(oldPath, newPath);
    };

    /**
     * **Duplicate ($duplicate)**
     */
    public $duplicate = (p: string, newName: string): void => {
        const dest = this.$join(this.$dirname(p), newName);
        this.$copy(p, dest);
    };

    /**
     * **Remove If Exists ($rmIfExists)**
     */
    public $rmIfExists = (p: string): void => {
        if (this.$exists(p)) this.$rm(p, { force: true });
    };

    /**
     * **Empty Directory ($emptyDir)**
     */
    public $emptyDir = (p: string): void => {
        if (this.$exists(p)) {
            this.$rm(p, { force: true });
            this.$mkdir(p);
        }
    };

    /**
     * **Human Readable Size ($sizeHuman)**
     */
    public $sizeHuman = (p: string): string => {
        return this.$size(p, { human: true }) as string;
    };

    /**
     * **Get Creation Time ($createdAt)**
     */
    public $createdAt = (p: string): Date => {
        return new Date(this.$stats(p).created * 1000);
    };

    /**
     * **Get Modification Time ($modifiedAt)**
     */
    public $modifiedAt = (p: string): Date => {
        return new Date(this.$stats(p).modified * 1000);
    };

    /**
     * **Get Access Time ($accessedAt)**
     */
    public $accessedAt = (p: string): Date => {
        return new Date(this.$stats(p).accessed * 1000);
    };

    /**
     * **Compare Content ($isSameContent)**
     */
    public $isSameContent = (p1: string, p2: string): boolean => {
        return this.$hash(p1) === this.$hash(p2);
    };

    /**
     * **Check if Newer ($isNewer)**
     */
    public $isNewer = (p1: string, p2: string): boolean => {
        return this.$modifiedAt(p1) > this.$modifiedAt(p2);
    };
}


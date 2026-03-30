import { FileStats } from "../types";
import { FSCore } from "./FSCore";

/**
 * **Filesystem Convenience Helpers**
 */
export class FSHelpers extends FSCore {
    /**
     * **Get System Temp Directory**
     */
    public tempDir = (): string => {
        return require("os").tmpdir();
    };

    /**
     * **Recursive List as Array**
     */
    public lsRecursive = (
        p: string,
        filter?: (path: string) => boolean,
    ): string[] => {
        const files = this.ls(p, { recursive: true });
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
     * **List Directories Only**
     */
    public lsDirs = (p: string): string[] => {
        try {
            const items = this.ls(p, { stats: true });
            return (items as [string, FileStats][])
                .filter((item) => item[1].is_dir)
                .map((item) => item[0]);
        } catch {
            return [];
        }
    };

    /**
     * **List Files Only**
     */
    public lsFiles = (p: string): string[] => {
        try {
            const items = this.ls(p, { stats: true });
            return (items as [string, FileStats][])
                .filter((item) => item[1].is_file)
                .map((item) => item[0]);
        } catch {
            return [];
        }
    };

    /**
     * **Read File to String**
     */
    public readFile = async (
        p: string,
        encoding: BufferEncoding = "utf8",
    ): Promise<string> => await this.read(p);

    /**
     * **Read File to String Synchronously**
     */
    public readFileSync = (
        p: string,
        encoding: BufferEncoding = "utf8",
    ): string => this.readSync(p);

    /**
     * **Read & Parse JSON**
     */
    public readJson = async <T = any>(p: string): Promise<T> =>
        JSON.parse(await this.read(p));

    /**
     * **Read & Parse JSON Synchronously**
     */
    public readJsonSync = <T = any>(p: string): T =>
        JSON.parse(this.readSync(p));

    /**
     * **Read File as Bytes**
     */
    public readBytes = async (p: string): Promise<Buffer> => {
        const res = (await this.runner.runAsync("fs", "read", [p], {
            bytes: true,
        })) as any;
        const hexData = res?.data !== undefined ? res.data : res;
        return Buffer.from(hexData, "hex");
    };

    /**
     * **Read File as Bytes Synchronously**
     */
    public readBytesSync = (p: string): Buffer => {
        const res = this.runner.runSync("fs", "read", [p], {
            bytes: true,
        }) as any;
        const hexData = res?.data !== undefined ? res.data : res;
        return Buffer.from(hexData, "hex");
    };

    /**
     * **Safe Read JSON**
     */
    public readJsonSafe = async <T = any>(
        p: string,
        defaultValue: T,
    ): Promise<T> => {
        try {
            return await this.readJson(p);
        } catch {
            return defaultValue;
        }
    };

    /**
     * **Safe Read JSON Synchronously**
     */
    public readJsonSafeSync = <T = any>(p: string, defaultValue: T): T => {
        try {
            return this.readJsonSync(p);
        } catch {
            return defaultValue;
        }
    };

    /**
     * **Write Object to JSON File**
     */
    public writeJson = async (p: string, data: any): Promise<void> =>
        await this.writeFile(p, data);

    /**
     * **Write Object to JSON File Synchronously**
     */
    public writeJsonSync = (p: string, data: any): void =>
        this.writeFileSync(p, data);

    /**
     * **Check Existence**
     */
    public exists = (p: string): boolean => {
        try {
            return this.check(p).exists;
        } catch {
            return false;
        }
    };

    /**
     * **Check if Directory**
     */
    public isDir = (p: string): boolean => {
        try {
            return this.stats(p).is_dir === true;
        } catch {
            return false;
        }
    };

    /**
     * **Check if File**
     */
    public isFile = (p: string): boolean => {
        try {
            return this.stats(p).is_file === true;
        } catch {
            return false;
        }
    };

    /**
     * **Check if Symlink**
     */
    public isSymlink = (p: string): boolean => {
        try {
            return this.stats(p).is_symlink === true;
        } catch {
            return false;
        }
    };

    /**
     * **Check if Empty**
     */
    public isEmpty = (p: string): boolean => {
        try {
            if (this.isFile(p)) return this.size(p) === 0;
            if (this.isDir(p)) return this.ls(p).length === 0;
            return false;
        } catch {
            return false;
        }
    };

    /**
     * **Read Lines**
     */
    public readLines = async (p: string): Promise<string[]> => {
        return (await this.read(p)).split(/\r?\n/);
    };

    /**
     * **Read Lines Synchronously**
     */
    public readLinesSync = (p: string): string[] => {
        return this.readSync(p).split(/\r?\n/);
    };

    /**
     * **Read Non-Empty Lines**
     */
    public readNonEmptyLines = async (p: string): Promise<string[]> => {
        return (await this.readLines(p)).filter((l) => l.trim().length > 0);
    };

    /**
     * **Read Non-Empty Lines Synchronously**
     */
    public readNonEmptyLinesSync = (p: string): string[] => {
        return this.readLinesSync(p).filter((l: string) => l.trim().length > 0);
    };

    /**
     * **Append to File**
     */
    public append = async (p: string, data: any): Promise<void> => {
        await this.writeFile(p, data, { append: true });
    };

    /**
     * **Append to File Synchronously**
     */
    public appendSync = (p: string, data: any): void => {
        this.writeFileSync(p, data, { append: true });
    };

    /**
     * **Append Line**
     */
    public appendLine = async (p: string, line: any): Promise<void> => {
        await this.writeFile(p, String(line) + "\n", { append: true });
    };

    /**
     * **Append Line Synchronously**
     */
    public appendLineSync = (p: string, line: any): void => {
        this.writeFileSync(p, String(line) + "\n", { append: true });
    };

    /**
     * **Write If Not Exists**
     */
    public writeIfNotExists = async (
        p: string,
        data: any,
    ): Promise<boolean> => {
        if (this.exists(p)) return false;
        await this.writeFile(p, data);
        return true;
    };

    /**
     * **Write If Not Exists Synchronously**
     */
    public writeIfNotExistsSync = (p: string, data: any): boolean => {
        if (this.exists(p)) return false;
        this.writeFileSync(p, data);
        return true;
    };

    /**
     * **Ensure Directory**
     */
    public ensureDir = (p: string): void => {
        this.mkdir(p, { parents: true });
    };

    /**
     * **List Full Paths**
     */
    public lsFullPath = (p: string): string[] => {
        const root = this.resolve(p);
        return this.ls(p).map((f) => this.join(root, f as string));
    };

    /**
     * **Rename**
     */
    public rename = (oldPath: string, newPath: string): void => {
        this.move(oldPath, newPath);
    };

    /**
     * **Duplicate**
     */
    public duplicate = (p: string, newName: string): void => {
        const dest = this.join(this.dirname(p), newName);
        this.copy(p, dest);
    };

    /**
     * **Remove If Exists**
     */
    public rmIfExists = (p: string): void => {
        if (this.exists(p)) this.rm(p, { force: true });
    };

    /**
     * **Empty Directory**
     */
    public emptyDir = (p: string): void => {
        if (this.exists(p)) {
            this.rm(p, { force: true });
            this.mkdir(p);
        }
    };

    /**
     * **Human Readable Size**
     */
    public sizeHuman = (p: string): string => {
        return this.size(p, { human: true }) as string;
    };

    /**
     * **Get Creation Time**
     */
    public createdAt = (p: string): Date => {
        return new Date(this.stats(p).created * 1000);
    };

    /**
     * **Get Modification Time**
     */
    public modifiedAt = (p: string): Date => {
        return new Date(this.stats(p).modified * 1000);
    };

    /**
     * **Get Access Time**
     */
    public accessedAt = (p: string): Date => {
        return new Date(this.stats(p).accessed * 1000);
    };

    /**
     * **Compare Content**
     */
    public isSameContent = (p1: string, p2: string): boolean => {
        return this.hash(p1) === this.hash(p2);
    };

    /**
     * **Check if Newer**
     */
    public isNewer = (p1: string, p2: string): boolean => {
        return this.modifiedAt(p1) > this.modifiedAt(p2);
    };
}


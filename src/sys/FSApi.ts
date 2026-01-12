import { PathApi } from "./PathApi";

/**
 * Professional Filesystem API bridging to the xsys Rust binary.
 * All public methods are prefixed with '$'.
 */
export class FSApi extends PathApi {
    // ========== BASE RUST OPERATIONS ==========

    public $ls = (
        p: string,
        options: { stats?: boolean; recursive?: boolean } = {}
    ) => this.runner.runSync("fs", "ls", [p], options);

    public $read = (p: string, options: { bytes?: boolean } = {}) =>
        this.runner.runSync("fs", "read", [p], options);

    public $write = (
        p: string,
        data: string,
        options: { append?: boolean } = {}
    ) => this.runner.runSync("fs", "write", [p, data], options);

    public $copy = (
        src: string,
        dest: string,
        options: { progress?: boolean } = {}
    ) => this.runner.runSync("fs", "copy", [src, dest], options);

    public $move = (src: string, dest: string) =>
        this.runner.runSync("fs", "move", [src, dest]);

    public $rm = (p: string, options: { force?: boolean } = {}) =>
        this.runner.runSync("fs", "rm", [p], options);

    public $mkdir = (p: string, options: { parents?: boolean } = {}) =>
        this.runner.runSync("fs", "mkdir", [p], options);

    public $touch = (p: string) => this.runner.runSync("fs", "touch", [p]);

    public $stats = (p: string) => this.runner.runSync("fs", "stats", [p]);

    public $hash = (p: string) => this.runner.runSync("fs", "hash", [p]);

    public $verify = (p: string, hash: string) =>
        this.runner.runSync("fs", "verify", [p, hash]);

    public $size = (
        p: string,
        options: { human?: boolean } = {}
    ): number | string => this.runner.runSync("fs", "size", [p], options);

    public $chmod = (p: string, mode: string) =>
        this.runner.runSync("fs", "chmod", [p, mode]);

    public $diskUsage = (p: string) =>
        this.runner.runSync("fs", "disk-usage", [p]);

    public $check = (
        p: string
    ): { exists: boolean; readable: boolean; writable: boolean } =>
        this.runner.runSync("fs", "check", [p]);

    public $du = (
        p: string
    ): { path: string; size: number; file_count: number; dir_count: number } =>
        this.runner.runSync("fs", "du", [p]);

    public $sync = (src: string, dest: string) =>
        this.runner.runSync("fs", "sync", [src, dest]);

    public $dedupe = (
        p: string
    ): { hash: string; paths: string[]; size: number }[] =>
        this.runner.runSync("fs", "dedupe", [p]);

    // ========== CONVENIENCE HELPERS ==========

    public $lsRecursive = (
        p: string,
        filter?: (path: string) => boolean
    ): string[] => {
        const files = this.$ls(p, { recursive: true });
        return filter ? files.filter(filter) : files;
    };

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

    public $readFile = (p: string, encoding: BufferEncoding = "utf8"): string =>
        this.$read(p);

    public $readJson = <T = any>(p: string): T => JSON.parse(this.$read(p));

    public $readJsonSafe = <T = any>(p: string, defaultValue: T): T => {
        try {
            return this.$readJson(p);
        } catch {
            return defaultValue;
        }
    };

    public $writeFile = (p: string, data: string): void => this.$write(p, data);

    public $writeJson = (p: string, data: any): void =>
        this.$write(p, JSON.stringify(data, null, 2));

    public $exists = (p: string): boolean => {
        try {
            return this.$check(p).exists;
        } catch {
            return false;
        }
    };

    public $isDir = (p: string): boolean => {
        try {
            return this.$stats(p).is_dir === true;
        } catch {
            return false;
        }
    };

    public $isFile = (p: string): boolean => {
        try {
            return this.$stats(p).is_file === true;
        } catch {
            return false;
        }
    };
}


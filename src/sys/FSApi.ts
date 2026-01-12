import { XyPrissRunner } from "./XyPrissRunner";

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

    /**
     * Checks if a path exists and its access rights.
     */
    public check(p: string): {
        exists: boolean;
        readable: boolean;
        writable: boolean;
    } {
        return this.runner.runSync("fs", "check", [p]);
    }
}


import { FileStats } from "../types";
import { FSCore } from "./FSCore";

/**
 * **Filesystem Convenience Helpers**
 */
export class FSHelpers extends FSCore {
    /**
     * **Deep Recursive Directory Listing**
     *
     * Explores a directory tree and returns a flat array of all file and
     * subdirectory paths found. Supports optional filtering.
     *
     * @param {string} p - Root path to start recursion.
     * @param {Function} [filter] - Optional callback to include/exclude paths.
     * @returns {string[]} Flat list of matching paths.
     *
     * @example
     * const tsFiles = __sys__.fs.lsRecursive("./src", (path) => path.endsWith(".ts"));
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
     * **Filter Directories Only**
     *
     * Returns a list of directory names within the specified path.
     *
     * @param {string} p - Path to scan.
     * @returns {string[]} List of directory names.
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
     * **Filter Files Only**
     *
     * Returns a list of file names within the specified path.
     *
     * @param {string} p - Path to scan.
     * @returns {string[]} List of file names.
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
     * **Read File (Asynchronous String)**
     *
     * Wrapper for `read()` that explicitly returns the content as a string.
     *
     * @param {string} p - Path to the file.
     * @param {BufferEncoding} [encoding='utf8'] - Ignored (system uses native UTF-8).
     * @returns {Promise<string>} File content string.
     */
    public readFile = async (
        p: string,
        encoding: BufferEncoding = "utf8",
    ): Promise<string> => await this.read(p);

    /**
     * **Read File (Synchronous String)**
     *
     * Wrapper for `readSync()` that explicitly returns the content as a string.
     *
     * @param {string} p - Path to the file.
     * @param {BufferEncoding} [encoding='utf8'] - Ignored (system uses native UTF-8).
     * @returns {string} File content string.
     */
    public readFileSync = (
        p: string,
        encoding: BufferEncoding = "utf8",
    ): string => this.readSync(p);

    /**
     * **Read & Parse JSON (Asynchronous)**
     *
     * Reads a file and parses its content into a JavaScript object.
     *
     * @template T - Expected object structure.
     * @param {string} p - Path to the JSON file.
     * @returns {Promise<T>} Parsed object.
     */
    public readJson = async <T = any>(p: string): Promise<T> =>
        JSON.parse(await this.read(p));

    /**
     * **Read & Parse JSON (Synchronous)**
     *
     * Synchronously reads a file and parses its content into a JavaScript object.
     *
     * @template T - Expected object structure.
     * @param {string} p - Path to the JSON file.
     * @returns {T} Parsed object.
     *
     * @example
     * const config = __sys__.fs.readJsonSync("package.json");
     */
    public readJsonSync = <T = any>(p: string): T =>
        JSON.parse(this.readSync(p));

    /**
     * **Read File as Binary (Asynchronous)**
     *
     * Reads a file and returns its raw binary content as a Node.js Buffer.
     *
     * @param {string} p - Path to the file.
     * @returns {Promise<Buffer>} Binary data.
     */
    public readBytes = async (p: string): Promise<Buffer> => {
        const res = (await this.runner.runAsync("fs", "read", [p], {
            bytes: true,
        })) as any;
        const hexData = res?.data !== undefined ? res.data : res;
        return Buffer.from(hexData, "hex");
    };

    /**
     * **Read File as Binary (Synchronous)**
     *
     * Synchronously reads a file and returns its raw binary content as a Node.js Buffer.
     *
     * @param {string} p - Path to the file.
     * @returns {Buffer} Binary data.
     */
    public readBytesSync = (p: string): Buffer => {
        const res = this.runner.runSync("fs", "read", [p], {
            bytes: true,
        }) as any;
        const hexData = res?.data !== undefined ? res.data : res;
        return Buffer.from(hexData, "hex");
    };

    /**
     * **Write Binary Data (Asynchronous)**
     *
     * Writes a Node.js Buffer directly to a file.
     *
     * @param {string} p - Destination path.
     * @param {Buffer} data - Binary data to write.
     * @returns {Promise<void>}
     */
    public writeBytes = async (p: string, data: Buffer): Promise<void> =>
        await this.writeFile(p, data);

    /**
     * **Write Binary Data (Synchronous)**
     *
     * Synchronously writes a Node.js Buffer directly to a file.
     *
     * @param {string} p - Destination path.
     * @param {Buffer} data - Binary data to write.
     */
    public writeBytesSync = (p: string, data: Buffer): void =>
        this.writeFileSync(p, data);

    /**
     * **Fault-Tolerant JSON Read (Asynchronous)**
     *
     * Attempts to read and parse a JSON file. If the file is missing or invalid,
     * it returns a provided default value instead of throwing.
     *
     * @template T - Expected object structure.
     * @param {string} p - Path to the JSON file.
     * @param {T} defaultValue - Value to return on failure.
     * @returns {Promise<T>} Parsed object or default value.
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
     * **Fault-Tolerant JSON Read (Synchronous)**
     *
     * Synchronously attempts to read and parse a JSON file, returning a default
     * value on any error.
     *
     * @template T - Expected object structure.
     * @param {string} p - Path to the JSON file.
     * @param {T} defaultValue - Value to return on failure.
     * @returns {T} Parsed object or default value.
     */
    public readJsonSafeSync = <T = any>(p: string, defaultValue: T): T => {
        try {
            return this.readJsonSync(p);
        } catch {
            return defaultValue;
        }
    };

    /**
     * **Write Object as JSON (Asynchronous)**
     *
     * Serializes an object to JSON and writes it to a file.
     *
     * @param {string} p - Destination path.
     * @param {any} data - Object to serialize.
     * @returns {Promise<void>}
     */
    public writeJson = async (p: string, data: any): Promise<void> =>
        await this.writeFile(p, data);

    /**
     * **Write Object as JSON (Synchronous)**
     *
     * Synchronously serializes an object to JSON and writes it to a file.
     *
     * @param {string} p - Destination path.
     * @param {any} data - Object to serialize.
     */
    public writeJsonSync = (p: string, data: any): void =>
        this.writeFileSync(p, data);

    /**
     * **Split File into Lines (Asynchronous)**
     *
     * Reads a file and splits its content into an array of lines based on
     * platform-agnostic newline characters.
     *
     * @param {string} p - Path to the file.
     * @returns {Promise<string[]>} Array of lines.
     */
    public readLines = async (p: string): Promise<string[]> => {
        return (await this.read(p)).split(/\r?\n/);
    };

    /**
     * **Split File into Lines (Synchronous)**
     *
     * Synchronously reads a file and splits its content into an array of lines.
     *
     * @param {string} p - Path to the file.
     * @returns {string[]} Array of lines.
     */
    public readLinesSync = (p: string): string[] => {
        return this.readSync(p).split(/\r?\n/);
    };

    /**
     * **Read Filtered Content (Asynchronous)**
     *
     * Reads a file and returns an array containing only non-empty, trimmed lines.
     *
     * @param {string} p - Path to the file.
     * @returns {Promise<string[]>} Array of non-empty lines.
     */
    public readNonEmptyLines = async (p: string): Promise<string[]> => {
        return (await this.readLines(p)).filter((l) => l.trim().length > 0);
    };

    /**
     * **Read Filtered Content (Synchronous)**
     *
     * Synchronously reads a file and returns an array of non-empty, trimmed lines.
     *
     * @param {string} p - Path to the file.
     * @returns {string[]} Array of non-empty lines.
     */
    public readNonEmptyLinesSync = (p: string): string[] => {
        return this.readLinesSync(p).filter((l: string) => l.trim().length > 0);
    };

    /**
     * **Append Text to File (Asynchronous)**
     *
     * Adds content to the end of a file.
     *
     * @param {string} p - Path to the file.
     * @param {any} data - Content to append.
     * @returns {Promise<void>}
     */
    public append = async (p: string, data: any): Promise<void> => {
        await this.writeFile(p, data, { append: true });
    };

    /**
     * **Append Text to File (Synchronous)**
     *
     * Synchronously adds content to the end of a file.
     *
     * @param {string} p - Path to the file.
     * @param {any} data - Content to append.
     */
    public appendSync = (p: string, data: any): void => {
        this.writeFileSync(p, data, { append: true });
    };

    /**
     * **Append Single Line (Asynchronous)**
     *
     * Adds content followed by a newline character to the end of a file.
     *
     * @param {string} p - Path to the file.
     * @param {any} line - Line content to append.
     * @returns {Promise<void>}
     */
    public appendLine = async (p: string, line: any): Promise<void> => {
        await this.writeFile(p, String(line) + "\n", { append: true });
    };

    /**
     * **Append Single Line (Synchronous)**
     *
     * Synchronously adds a line of content to the end of a file.
     *
     * @param {string} p - Path to the file.
     * @param {any} line - Line content to append.
     */
    public appendLineSync = (p: string, line: any): void => {
        this.writeFileSync(p, String(line) + "\n", { append: true });
    };

    /**
     * **Write If New (Asynchronous)**
     *
     * Writes data to a file ONLY if the file does not already exist.
     *
     * @param {string} p - Destination path.
     * @param {any} data - Data to write.
     * @returns {Promise<boolean>} True if the file was written, false if it already existed.
     */
    public writeIfNotExists = async (
        p: string,
        data: any,
    ): Promise<boolean> => {
        if (this.check(p).exists) return false;
        await this.writeFile(p, data);
        return true;
    };

    /**
     * **Write If New (Synchronous)**
     *
     * Synchronously writes data to a file only if it does not already exist.
     *
     * @param {string} p - Destination path.
     * @param {any} data - Data to write.
     * @returns {boolean} True if written, false otherwise.
     */
    public writeIfNotExistsSync = (p: string, data: any): boolean => {
        if (this.check(p).exists) return false;
        this.writeFileSync(p, data);
        return true;
    };

    /**
     * **Ensure Directory Existence**
     *
     * Guarantees that a directory (and all its parents) exists. Does nothing
     * if the directory is already present.
     *
     * @param {string} p - Directory path to ensure.
     *
     * @example
     * __sys__.fs.ensureDir("./data/logs/archive");
     */
    public ensureDir = (p: string): void => {
        this.mkdir(p, { parents: true });
    };

    /**
     * **Non-Blocking Directory Creation**
     *
     * Attempts to create a directory tree. Returns false if the path already exists.
     *
     * @param {string} p - Path to create.
     * @returns {boolean} True if the directory was created.
     */
    public mkdirSafe = (p: string): boolean => {
        if (this.check(p).exists) return false;
        this.mkdir(p, { parents: true });
        return true;
    };

    /**
     * **List with Absolute Paths**
     *
     * Lists directory contents and returns them as a flat array of absolute paths.
     *
     * @param {string} p - Directory to scan.
     * @returns {string[]} List of absolute paths.
     */
    public lsFullPath = (p: string): string[] => {
        const root = this.resolve(p);
        return this.ls(p).map((f) => this.join(root, f as string));
    };

    /**
     * **Rename Entry**
     *
     * Alias for `move()`. Changes the name or location of a file/directory.
     *
     * @param {string} oldPath - Current path.
     * @param {string} newPath - Target path.
     */
    public rename = (oldPath: string, newPath: string): void => {
        this.move(oldPath, newPath);
    };

    /**
     * **Clone Entry**
     *
     * Creates a copy of a file or directory in the same parent folder with a new name.
     *
     * @param {string} p - Original path.
     * @param {string} newName - New filename or directory name.
     */
    public duplicate = (p: string, newName: string): void => {
        const dest = this.join(this.dirname(p), newName);
        this.copy(p, dest);
    };

    /**
     * **Safe Removal**
     *
     * Deletes a file or directory only if it currently exists on the filesystem.
     *
     * @param {string} p - Path to remove.
     */
    public rmIfExists = (p: string): void => {
        if (this.check(p).exists) this.rm(p, { force: true });
    };

    /**
     * **Clear Directory Contents**
     *
     * Deletes all files and subdirectories within a directory, but keeps
     * the empty directory itself.
     *
     * @param {string} p - Directory to empty.
     */
    public emptyDir = (p: string): void => {
        if (this.check(p).exists) {
            this.rm(p, { force: true });
            this.mkdir(p);
        }
    };

    /**
     * **Get Formatted Size String**
     *
     * Returns the size of a path in a human-readable format (e.g., '12 MB', '1.2 GB').
     *
     * @param {string} p - Path to query.
     * @returns {string} Human-readable size.
     */
    public sizeHuman = (p: string): string => {
        return this.size(p, { human: true }) as string;
    };

    /**
     * **Get Creation Timestamp**
     *
     * Retrieves the exact date and time when the file or directory was created.
     *
     * @param {string} p - Path to query.
     * @returns {Date} Creation date object.
     */
    public createdAt = (p: string): Date => {
        return new Date(this.stats(p)!.created! * 1000);
    };

    /**
     * **Get Last Modification Timestamp**
     *
     * Retrieves the exact date and time when the file content or directory
     * was last changed.
     *
     * @param {string} p - Path to query.
     * @returns {Date} Modification date object.
     */
    public modifiedAt = (p: string): Date => {
        return new Date(this.stats(p).modified * 1000);
    };

    /**
     * **Get Last Access Timestamp**
     *
     * Retrieves the exact date and time when the file was last accessed
     * (read or written).
     *
     * @param {string} p - Path to query.
     * @returns {Date} Access date object.
     */
    public accessedAt = (p: string): Date => {
        return new Date(this.stats(p)!.accessed! * 1000);
    };

    /**
     * **Verify Content Identity**
     *
     * Compares two files to see if they have identical content by comparing
     * their cryptographic hashes.
     *
     * @param {string} p1 - First file path.
     * @param {string} p2 - Second file path.
     * @returns {boolean} True if content is identical.
     */
    public isSameContent = (p1: string, p2: string): boolean => {
        return this.hash(p1) === this.hash(p2);
    };

    /**
     * **Compare Timestamps**
     *
     * Checks if the first path was modified more recently than the second path.
     *
     * @param {string} p1 - Primary path.
     * @param {string} p2 - Path to compare against.
     * @returns {boolean} True if p1 is newer than p2.
     */
    public isNewer = (p1: string, p2: string): boolean => {
        return this.modifiedAt(p1) > this.modifiedAt(p2);
    };
}


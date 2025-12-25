import fs from "node:fs";
import path from "node:path";

/**
 * XyPriss File System API
 *
 * A powerful combination of node:fs and node:path providing a simplified,
 * root-aware API for common file system operations.
 */
export class XyPrissFS {
    constructor(private sys: { __root__: string }) {}

    // ========== PATH OPERATIONS ==========

    /**
     * Resolve a sequence of paths or path segments into an absolute path,
     * relative to the project root.
     */
    public $resolve(...paths: string[]): string {
        return path.resolve(this.sys.__root__, ...paths);
    }

    /**
     * Join all arguments together and normalize the resulting path.
     */
    public $join(...paths: string[]): string {
        return path.join(...paths);
    }

    /**
     * Get the directory name of a path.
     */
    public $dirname(p: string): string {
        return path.dirname(p);
    }

    /**
     * Get the last portion of a path.
     */
    public $basename(p: string, ext?: string): string {
        return path.basename(p, ext);
    }

    /**
     * Get the extension of a path.
     */
    public $extname(p: string): string {
        return path.extname(p);
    }

    /**
     * Get the relative path from one path to another.
     */
    public $relative(from: string, to: string): string {
        return path.relative(this.$resolve(from), this.$resolve(to));
    }

    /**
     * Normalize a path, resolving '..' and '.' segments.
     */
    public $normalize(p: string): string {
        return path.normalize(p);
    }

    /**
     * Parse a path into its components (root, dir, base, ext, name).
     */
    public $parse(p: string): path.ParsedPath {
        return path.parse(p);
    }

    /**
     * Format a path object into a path string.
     */
    public $format(pathObject: path.FormatInputPathObject): string {
        return path.format(pathObject);
    }

    // ========== EXISTENCE & TYPE CHECKS ==========

    /**
     * Synchronously check if a path exists.
     */
    public $exists(p: string): boolean {
        return fs.existsSync(this.$resolve(p));
    }

    /**
     * Check if a path is a directory.
     */
    public $isDir(p: string): boolean {
        try {
            return fs.statSync(this.$resolve(p)).isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Check if a path is a file.
     */
    public $isFile(p: string): boolean {
        try {
            return fs.statSync(this.$resolve(p)).isFile();
        } catch {
            return false;
        }
    }

    /**
     * Check if a path is a symbolic link.
     */
    public $isSymlink(p: string): boolean {
        try {
            return fs.lstatSync(this.$resolve(p)).isSymbolicLink();
        } catch {
            return false;
        }
    }

    /**
     * Check if a path is empty (empty directory or zero-byte file).
     */
    public $isEmpty(p: string): boolean {
        const fullPath = this.$resolve(p);
        if (!fs.existsSync(fullPath)) return true;

        if (this.$isDir(p)) {
            return fs.readdirSync(fullPath).length === 0;
        }
        return fs.statSync(fullPath).size === 0;
    }

    // ========== FILE READING ==========

    /**
     * Synchronously read the entire contents of a file.
     */
    public $readFile(
        p: string,
        options:
            | { encoding?: BufferEncoding; flag?: string }
            | BufferEncoding = "utf8"
    ): string | Buffer {
        return fs.readFileSync(this.$resolve(p), options);
    }

    /**
     * Synchronously read and parse a JSON file.
     */
    public $readJson<T = any>(p: string): T {
        const content = this.$readFile(p, "utf8") as string;
        return JSON.parse(content);
    }

    /**
     * Safely read a JSON file, returning default value on error.
     */
    public $readJsonSafe<T = any>(p: string, defaultValue: T): T {
        try {
            return this.$readJson<T>(p);
        } catch {
            return defaultValue;
        }
    }

    /**
     * Read file as lines array.
     */
    public $readLines(p: string): string[] {
        const content = this.$readFile(p, "utf8") as string;
        return content.split(/\r?\n/);
    }

    /**
     * Read file and return non-empty lines.
     */
    public $readNonEmptyLines(p: string): string[] {
        return this.$readLines(p).filter((line) => line.trim().length > 0);
    }

    // ========== FILE WRITING ==========

    /**
     * Synchronously write data to a file, automatically creating parent directories.
     */
    public $writeFile(
        p: string,
        data: string | NodeJS.ArrayBufferView,
        options?: fs.WriteFileOptions
    ): void {
        const fullPath = this.$resolve(p);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fullPath, data, options);
    }

    /**
     * Synchronously write an object to a JSON file with 2-space indentation.
     */
    public $writeJson(
        p: string,
        data: any,
        options?: fs.WriteFileOptions
    ): void {
        this.$writeFile(p, JSON.stringify(data, null, 2), options);
    }

    /**
     * Synchronously append data to a file.
     */
    public $append(
        p: string,
        data: string | Uint8Array,
        options?: fs.WriteFileOptions
    ): void {
        fs.appendFileSync(this.$resolve(p), data, options);
    }

    /**
     * Append a line to a file (adds newline automatically).
     */
    public $appendLine(p: string, line: string): void {
        this.$append(p, line + "\n");
    }

    /**
     * Synchronously create an empty file or update its access/modification times.
     */
    public $touch(p: string): void {
        const fullPath = this.$resolve(p);
        if (fs.existsSync(fullPath)) {
            const now = new Date();
            fs.utimesSync(fullPath, now, now);
        } else {
            this.$writeFile(fullPath, "");
        }
    }

    /**
     * Write data to a file only if it doesn't exist.
     */
    public $writeIfNotExists(
        p: string,
        data: string | NodeJS.ArrayBufferView
    ): boolean {
        if (this.$exists(p)) return false;
        this.$writeFile(p, data);
        return true;
    }

    // ========== DIRECTORY OPERATIONS ==========

    /**
     * Synchronously create a directory and its parents if they don't exist.
     */
    public $mkdir(p: string, recursive: boolean = true): void {
        fs.mkdirSync(this.$resolve(p), { recursive });
    }

    /**
     * Ensure a directory exists (create if it doesn't).
     */
    public $ensureDir(p: string): void {
        const fullPath = this.$resolve(p);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    }

    /**
     * Synchronously read the contents of a directory.
     */
    public $ls(p: string): string[] {
        return fs.readdirSync(this.$resolve(p));
    }

    /**
     * List directory contents with full paths.
     */
    public $lsFullPath(p: string): string[] {
        const fullPath = this.$resolve(p);
        return fs
            .readdirSync(fullPath)
            .map((item) => path.join(fullPath, item));
    }

    /**
     * List only files in a directory (non-recursive).
     */
    public $lsFiles(p: string): string[] {
        const fullPath = this.$resolve(p);
        return fs.readdirSync(fullPath).filter((item) => {
            return fs.statSync(path.join(fullPath, item)).isFile();
        });
    }

    /**
     * List only directories in a directory (non-recursive).
     */
    public $lsDirs(p: string): string[] {
        const fullPath = this.$resolve(p);
        return fs.readdirSync(fullPath).filter((item) => {
            return fs.statSync(path.join(fullPath, item)).isDirectory();
        });
    }

    /**
     * Recursively list all files in a directory.
     */
    public $lsRecursive(
        p: string,
        filter?: (path: string) => boolean
    ): string[] {
        const results: string[] = [];
        const fullPath = this.$resolve(p);

        const walk = (dir: string) => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                if (fs.statSync(itemPath).isDirectory()) {
                    walk(itemPath);
                } else {
                    const relativePath = path.relative(
                        this.sys.__root__,
                        itemPath
                    );
                    if (!filter || filter(relativePath)) {
                        results.push(relativePath);
                    }
                }
            }
        };

        walk(fullPath);
        return results;
    }

    /**
     * Find files by extension in a directory (recursive).
     */
    public $findByExt(p: string, ext: string): string[] {
        const extension = ext.startsWith(".") ? ext : `.${ext}`;
        return this.$lsRecursive(p, (file) => file.endsWith(extension));
    }

    /**
     * Find files by pattern (glob-like) in a directory (recursive).
     */
    public $findByPattern(p: string, pattern: RegExp): string[] {
        return this.$lsRecursive(p, (file) => pattern.test(file));
    }

    // ========== COPY & MOVE OPERATIONS ==========

    /**
     * Synchronously copy a file or directory.
     */
    public $copy(src: string, dest: string, overwrite: boolean = true): void {
        const fullSrc = this.$resolve(src);
        const fullDest = this.$resolve(dest);

        if (!overwrite && fs.existsSync(fullDest)) {
            throw new Error(`Destination already exists: ${dest}`);
        }

        const destDir = path.dirname(fullDest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        fs.cpSync(fullSrc, fullDest, { recursive: true });
    }

    /**
     * Copy a file or directory with a new name in the same directory.
     */
    public $duplicate(p: string, newName: string): string {
        const fullPath = this.$resolve(p);
        const dir = path.dirname(fullPath);
        const newPath = path.join(dir, newName);
        fs.cpSync(fullPath, newPath, { recursive: true });
        return path.relative(this.sys.__root__, newPath);
    }

    /**
     * Synchronously move/rename a file or directory.
     */
    public $move(src: string, dest: string): void {
        const fullSrc = this.$resolve(src);
        const fullDest = this.$resolve(dest);
        const destDir = path.dirname(fullDest);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        fs.renameSync(fullSrc, fullDest);
    }

    /**
     * Rename a file or directory.
     */
    public $rename(oldPath: string, newName: string): string {
        const fullOldPath = this.$resolve(oldPath);
        const dir = path.dirname(fullOldPath);
        const newPath = path.join(dir, newName);
        fs.renameSync(fullOldPath, newPath);
        return path.relative(this.sys.__root__, newPath);
    }

    // ========== DELETE OPERATIONS ==========

    /**
     * Synchronously remove a file or directory recursively.
     */
    public $rm(
        p: string,
        options: fs.RmOptions = { recursive: true, force: true }
    ): void {
        fs.rmSync(this.$resolve(p), options);
    }

    /**
     * Remove a file or directory if it exists.
     */
    public $rmIfExists(p: string): boolean {
        if (this.$exists(p)) {
            this.$rm(p);
            return true;
        }
        return false;
    }

    /**
     * Empty a directory without removing it.
     */
    public $emptyDir(p: string): void {
        const fullPath = this.$resolve(p);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
            const items = fs.readdirSync(fullPath);
            for (const item of items) {
                fs.rmSync(path.join(fullPath, item), {
                    recursive: true,
                    force: true,
                });
            }
        }
    }

    // ========== FILE STATISTICS ==========

    /**
     * Get file or directory statistics.
     */
    public $stats(p: string): fs.Stats {
        return fs.statSync(this.$resolve(p));
    }

    /**
     * Get the size of a file in bytes.
     */
    public $size(p: string): number {
        return this.$stats(p).size;
    }

    /**
     * Get human-readable file size.
     */
    public $sizeHuman(p: string): string {
        const bytes = this.$size(p);
        const units = ["B", "KB", "MB", "GB", "TB"];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Get total size of a directory (recursive).
     */
    public $sizeDir(p: string): number {
        const fullPath = this.$resolve(p);
        let totalSize = 0;

        const walk = (dir: string) => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const itemPath = path.join(dir, item);
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory()) {
                    walk(itemPath);
                } else {
                    totalSize += stat.size;
                }
            }
        };

        walk(fullPath);
        return totalSize;
    }

    /**
     * Get file creation time.
     */
    public $createdAt(p: string): Date {
        return this.$stats(p).birthtime;
    }

    /**
     * Get file modification time.
     */
    public $modifiedAt(p: string): Date {
        return this.$stats(p).mtime;
    }

    /**
     * Get file access time.
     */
    public $accessedAt(p: string): Date {
        return this.$stats(p).atime;
    }

    // ========== COMPARISON & SEARCH ==========

    /**
     * Check if two files have the same content.
     */
    public $isSameContent(path1: string, path2: string): boolean {
        if (!this.$isFile(path1) || !this.$isFile(path2)) return false;
        const content1 = this.$readFile(path1);
        const content2 = this.$readFile(path2);
        return content1.toString() === content2.toString();
    }

    /**
     * Check if a file is newer than another.
     */
    public $isNewer(path1: string, path2: string): boolean {
        return this.$modifiedAt(path1) > this.$modifiedAt(path2);
    }

    /**
     * Check if a file is older than another.
     */
    public $isOlder(path1: string, path2: string): boolean {
        return this.$modifiedAt(path1) < this.$modifiedAt(path2);
    }

    /**
     * Search for files containing specific text.
     */
    public $searchInFiles(dir: string, searchText: string): string[] {
        const matches: string[] = [];
        const files = this.$lsRecursive(dir, (file) => this.$isFile(file));

        for (const file of files) {
            try {
                const content = this.$readFile(file, "utf8") as string;
                if (content.includes(searchText)) {
                    matches.push(file);
                }
            } catch {
                // Skip files that can't be read as text
            }
        }

        return matches;
    }

    // ========== ADVANCED UTILITIES ==========

    /**
     * Generate a unique filename by appending a counter if file exists.
     */
    public $uniqueFilename(p: string): string {
        if (!this.$exists(p)) return p;

        const parsed = path.parse(this.$resolve(p));
        let counter = 1;
        let newPath: string;

        do {
            const newName = `${parsed.name} (${counter})${parsed.ext}`;
            newPath = path.join(parsed.dir, newName);
            counter++;
        } while (fs.existsSync(newPath));

        return path.relative(this.sys.__root__, newPath);
    }

    /**
     * Create a temporary directory with optional prefix.
     */
    public $mkdtemp(prefix: string = "tmp-"): string {
        const tmpDir = fs.mkdtempSync(path.join(this.sys.__root__, prefix));
        return path.relative(this.sys.__root__, tmpDir);
    }

    /**
     * Copy file content to clipboard-friendly format.
     */
    public $readForClipboard(p: string): string {
        const content = this.$readFile(p, "utf8") as string;
        return content.replace(/\r\n/g, "\n");
    }

    /**
     * Watch a file or directory for changes.
     */
    public $watch(
        p: string,
        callback: (eventType: string, filename: string | null) => void
    ): fs.FSWatcher {
        return fs.watch(this.$resolve(p), callback);
    }

    /**
     * Batch operation: apply function to all files in directory.
     */
    public $batchProcess(
        dir: string,
        processor: (filePath: string, content: string) => string
    ): void {
        const files = this.$lsRecursive(dir);
        for (const file of files) {
            if (this.$isFile(file)) {
                try {
                    const content = this.$readFile(file, "utf8") as string;
                    const processed = processor(file, content);
                    this.$writeFile(file, processed);
                } catch (error) {
                    console.error(`Error processing ${file}:`, error);
                }
            }
        }
    }

    /**
     * Create a backup of a file or directory.
     */
    public $backup(p: string, suffix: string = ".backup"): string {
        const fullPath = this.$resolve(p);
        const backupPath = fullPath + suffix;
        fs.cpSync(fullPath, backupPath, { recursive: true });
        return path.relative(this.sys.__root__, backupPath);
    }

    /**
     * Restore a file from its backup.
     */
    public $restore(p: string, suffix: string = ".backup"): boolean {
        const backupPath = this.$resolve(p + suffix);
        if (!fs.existsSync(backupPath)) return false;

        const originalPath = this.$resolve(p);
        if (fs.existsSync(originalPath)) {
            fs.rmSync(originalPath, { recursive: true, force: true });
        }
        fs.cpSync(backupPath, originalPath, { recursive: true });
        return true;
    }
}


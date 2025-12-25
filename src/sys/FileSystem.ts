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
     * Resolves a sequence of paths or path segments into an absolute path, ensuring all paths are interpreted relative to the project root directory.
     * This method provides a root-aware path resolution, preventing access outside the designated project scope and maintaining consistent path handling.
     *
     * @param {...string} paths - A sequence of path segments to be joined and resolved. Each segment can be a string representing a directory or file path.
     * @returns {string} The fully resolved absolute path, anchored to the project root.
     * @throws {TypeError} If any of the provided paths are not strings.
     * @example
     * // Assuming project root is '/home/user/project'
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * console.log(fs.$resolve('src', 'index.ts')); // Outputs: '/home/user/project/src/index.ts'
     */
    public $resolve(...paths: string[]): string {
        return path.resolve(this.sys.__root__, ...paths);
    }

    /**
     * Joins all provided path segments together using the platform-specific separator and normalizes the resulting path.
     * This method is essential for constructing paths in a cross-platform manner, handling different operating system path conventions seamlessly.
     *
     * @param {...string} paths - The path segments to be joined. Each argument represents a portion of the path.
     * @returns {string} The joined and normalized path string.
     * @throws {TypeError} If any of the provided paths are not strings.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * console.log(fs.$join('src', 'components', 'Button.ts')); // Outputs: 'src/components/Button.ts' (on Unix-like systems)
     */
    public $join(...paths: string[]): string {
        return path.join(...paths);
    }

    /**
     * Extracts the directory portion of a given path, returning the parent directory's path.
     * This method is particularly useful for navigating up the directory tree or isolating the directory context of a file.
     *
     * @param {string} p - The path from which to extract the directory name.
     * @returns {string} The directory name of the provided path.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * console.log(fs.$dirname('src/components/Button.ts')); // Outputs: 'src/components'
     */
    public $dirname(p: string): string {
        return path.dirname(p);
    }

    /**
     * Retrieves the last portion of a path, which is typically the filename or the last directory in the path.
     * Optionally, an extension can be specified to exclude it from the result, allowing for filename manipulation without extensions.
     *
     * @param {string} p - The path from which to extract the basename.
     * @param {string} [ext] - An optional file extension to remove from the basename.
     * @returns {string} The basename of the path, with the extension removed if specified.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * console.log(fs.$basename('src/components/Button.ts')); // Outputs: 'Button.ts'
     * console.log(fs.$basename('src/components/Button.ts', '.ts')); // Outputs: 'Button'
     */
    public $basename(p: string, ext?: string): string {
        return path.basename(p, ext);
    }

    /**
     * Extracts the file extension from a given path, including the leading dot.
     * This method is crucial for file type identification and handling files based on their extensions.
     *
     * @param {string} p - The path from which to extract the extension.
     * @returns {string} The file extension, including the dot, or an empty string if no extension is present.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * console.log(fs.$extname('src/components/Button.ts')); // Outputs: '.ts'
     * console.log(fs.$extname('README')); // Outputs: ''
     */
    public $extname(p: string): string {
        return path.extname(p);
    }

    /**
     * Computes the relative path from one path to another, providing the most efficient route between them.
     * This method is invaluable for generating relative links or paths in documentation, imports, or user interfaces.
     *
     * @param {string} from - The starting path for the relative calculation.
     * @param {string} to - The destination path for the relative calculation.
     * @returns {string} The relative path from the 'from' path to the 'to' path.
     * @throws {TypeError} If either path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * console.log(fs.$relative('src/components', 'src/utils/helpers.ts')); // Outputs: '../utils/helpers.ts'
     */
    public $relative(from: string, to: string): string {
        return path.relative(this.$resolve(from), this.$resolve(to));
    }

    /**
     * Normalizes a path by resolving '.' and '..' segments, eliminating redundant separators, and ensuring a clean, canonical path representation.
     * This method is essential for path sanitization and comparison, preventing issues caused by inconsistent path formats.
     *
     * @param {string} p - The path to be normalized.
     * @returns {string} The normalized path with resolved segments and cleaned separators.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * console.log(fs.$normalize('src/../src/components/./Button.ts')); // Outputs: 'src/components/Button.ts'
     */
    public $normalize(p: string): string {
        return path.normalize(p);
    }

    /**
     * Parses a path into its constituent components, providing detailed breakdown including root, directory, base name, extension, and name without extension.
     * This method facilitates advanced path manipulation and analysis by exposing all structural elements of the path.
     *
     * @param {string} p - The path to be parsed.
     * @returns {path.ParsedPath} An object containing the parsed path components: root, dir, base, ext, and name.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const parsed = fs.$parse('src/components/Button.ts');
     * console.log(parsed);
     * // Outputs: { root: '', dir: 'src/components', base: 'Button.ts', ext: '.ts', name: 'Button' }
     */
    public $parse(p: string): path.ParsedPath {
        return path.parse(p);
    }

    /**
     * Formats a path object back into a path string, reconstructing the full path from its parsed components.
     * This method is the inverse of path parsing, allowing for programmatic path construction from structured data.
     *
     * @param {path.FormatInputPathObject} pathObject - The path object containing components to format into a string.
     * @returns {string} The formatted path string.
     * @throws {TypeError} If the provided pathObject is not a valid path object.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const pathObj = { dir: 'src/components', base: 'Button.ts' };
     * console.log(fs.$format(pathObj)); // Outputs: 'src/components/Button.ts'
     */
    public $format(pathObject: path.FormatInputPathObject): string {
        return path.format(pathObject);
    }

    // ========== EXISTENCE & TYPE CHECKS ==========

    /**
     * Synchronously checks if a path exists in the file system, providing a reliable way to verify file or directory presence before operations.
     * This method is essential for conditional logic and error prevention in file system interactions.
     *
     * @param {string} p - The path to check for existence.
     * @returns {boolean} True if the path exists, false otherwise.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * if (fs.$exists('config.json')) {
     *     console.log('Configuration file found.');
     * } else {
     *     console.log('Configuration file missing.');
     * }
     */
    public $exists(p: string): boolean {
        return fs.existsSync(this.$resolve(p));
    }

    /**
     * Determines whether the specified path refers to a directory, enabling type-specific handling in file system operations.
     * This method is crucial for distinguishing between files and directories to apply appropriate processing logic.
     *
     * @param {string} p - The path to check if it is a directory.
     * @returns {boolean} True if the path is a directory, false otherwise (including if the path does not exist).
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * if (fs.$isDir('src')) {
     *     console.log('Source directory exists.');
     * } else {
     *     console.log('Source is not a directory or does not exist.');
     * }
     */
    public $isDir(p: string): boolean {
        try {
            return fs.statSync(this.$resolve(p)).isDirectory();
        } catch {
            return false;
        }
    }

    /**
     * Verifies if the given path points to a regular file, allowing for file-specific operations and validations.
     * This check is fundamental for ensuring that file reading or writing operations are applied to appropriate file system entities.
     *
     * @param {string} p - The path to verify as a file.
     * @returns {boolean} True if the path is a regular file, false otherwise (including if the path does not exist or is a directory).
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * if (fs.$isFile('package.json')) {
     *     console.log('Package configuration file is present.');
     * } else {
     *     console.log('Package configuration is missing or not a file.');
     * }
     */
    public $isFile(p: string): boolean {
        try {
            return fs.statSync(this.$resolve(p)).isFile();
        } catch {
            return false;
        }
    }

    /**
     * Identifies if the specified path is a symbolic link, which is essential for handling symlinks appropriately in file system operations.
     * This method helps in detecting symbolic links to prevent unintended modifications or to apply symlink-specific logic.
     *
     * @param {string} p - The path to check for being a symbolic link.
     * @returns {boolean} True if the path is a symbolic link, false otherwise (including if the path does not exist).
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * if (fs.$isSymlink('node_modules')) {
     *     console.log('Node modules is a symlink.');
     * } else {
     *     console.log('Node modules is not a symlink.');
     * }
     */
    public $isSymlink(p: string): boolean {
        try {
            return fs.lstatSync(this.$resolve(p)).isSymbolicLink();
        } catch {
            return false;
        }
    }

    /**
     * Determines if a path represents an empty entity, either an empty directory or a zero-byte file.
     * This method is useful for cleanup operations, validation checks, or determining if content needs to be added.
     *
     * @param {string} p - The path to check for emptiness.
     * @returns {boolean} True if the path is empty or does not exist, false if it contains content.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * if (fs.$isEmpty('logs')) {
     *     console.log('Logs directory is empty.');
     * } else {
     *     console.log('Logs directory contains files.');
     * }
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
     * Synchronously reads the entire contents of a file, providing flexible encoding options for different data types.
     * This method is ideal for loading configuration files, templates, or any file content that needs to be processed in memory.
     *
     * @param {string} p - The path to the file to read.
     * @param {BufferEncoding | { encoding?: BufferEncoding; flag?: string }} [options='utf8'] - The encoding to use or an options object specifying encoding and file access flags.
     * @returns {string | Buffer} The file contents as a string (if encoding is specified) or Buffer (if no encoding).
     * @throws {Error} If the file does not exist, cannot be read, or other file system errors occur.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const content = fs.$readFile('README.md', 'utf8');
     * console.log(content);
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
     * Synchronously reads and parses a JSON file, automatically handling the file reading and JSON parsing in one convenient operation.
     * This method simplifies loading configuration files, data stores, or any JSON-formatted content with built-in error handling for malformed JSON.
     *
     * @param {string} p - The path to the JSON file to read and parse.
     * @returns {T} The parsed JSON object, typed according to the generic parameter.
     * @throws {SyntaxError} If the file content is not valid JSON.
     * @throws {Error} If the file does not exist or cannot be read.
     * @throws {TypeError} If the provided path is not a string.
     * @template T - The expected type of the parsed JSON object (defaults to any).
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const config = fs.$readJson<{ port: number; host: string }>('config.json');
     * console.log(`Server will run on ${config.host}:${config.port}`);
     */
    public $readJson<T = any>(p: string): T {
        const content = this.$readFile(p, "utf8") as string;
        return JSON.parse(content);
    }

    /**
     * Safely reads and parses a JSON file, gracefully handling errors by returning a predefined default value.
     * This method is perfect for optional configuration files or data that may not exist, preventing application crashes due to missing or invalid JSON.
     *
     * @param {string} p - The path to the JSON file to read and parse.
     * @param {T} defaultValue - The value to return if the file doesn't exist, cannot be read, or contains invalid JSON.
     * @returns {T} The parsed JSON object if successful, or the default value if any error occurs.
     * @throws {TypeError} If the provided path is not a string.
     * @template T - The expected type of the parsed JSON object and the default value.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const settings = fs.$readJsonSafe('user-settings.json', { theme: 'light', language: 'en' });
     * console.log(`User theme: ${settings.theme}`);
     */
    public $readJsonSafe<T = any>(p: string, defaultValue: T): T {
        try {
            return this.$readJson<T>(p);
        } catch {
            return defaultValue;
        }
    }

    /**
     * Reads a file and splits its content into an array of lines, handling different line ending conventions automatically.
     * This method is ideal for processing text files line by line, such as configuration files, logs, or CSV data.
     *
     * @param {string} p - The path to the file to read as lines.
     * @returns {string[]} An array of strings, where each element represents a line from the file (including empty lines).
     * @throws {Error} If the file does not exist or cannot be read.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const lines = fs.$readLines('todo.txt');
     * lines.forEach((line, index) => {
     *     console.log(`${index + 1}: ${line}`);
     * });
     */
    public $readLines(p: string): string[] {
        const content = this.$readFile(p, "utf8") as string;
        return content.split(/\r?\n/);
    }

    /**
     * Reads a file and returns an array of its non-empty lines, filtering out blank lines and whitespace-only lines.
     * This method is perfect for parsing configuration files, lists, or any text content where empty lines are irrelevant.
     *
     * @param {string} p - The path to the file to read and filter for non-empty lines.
     * @returns {string[]} An array of strings containing only the non-empty lines from the file, with whitespace trimmed.
     * @throws {Error} If the file does not exist or cannot be read.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const commands = fs.$readNonEmptyLines('build-commands.txt');
     * commands.forEach(command => {
     *     console.log(`Executing: ${command}`);
     *     // Execute command
     * });
     */
    public $readNonEmptyLines(p: string): string[] {
        return this.$readLines(p).filter((line) => line.trim().length > 0);
    }

    // ========== FILE WRITING ==========

    /**
     * Synchronously writes data to a file, automatically creating any necessary parent directories to ensure the write operation succeeds.
     * This method simplifies file creation and modification by handling directory structure setup transparently.
     *
     * @param {string} p - The path to the file to write to.
     * @param {string | NodeJS.ArrayBufferView} data - The data to write to the file.
     * @param {fs.WriteFileOptions} [options] - Optional write options such as encoding, mode, or flags.
     * @throws {Error} If the file cannot be written or directories cannot be created.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * fs.$writeFile('logs/app.log', 'Application started successfully\n');
     * // Creates the logs directory if it doesn't exist
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
     * Synchronously writes a JavaScript object to a JSON file with standardized 2-space indentation for readability.
     * This method combines object serialization and file writing, automatically creating parent directories as needed.
     *
     * @param {string} p - The path to the JSON file to write to.
     * @param {any} data - The JavaScript object or value to serialize and write as JSON.
     * @param {fs.WriteFileOptions} [options] - Optional write options such as encoding or mode.
     * @throws {Error} If the data cannot be serialized to JSON or the file cannot be written.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const config = { port: 3000, host: 'localhost', debug: true };
     * fs.$writeJson('config/app.json', config);
     * // Creates a formatted JSON file with proper indentation
     */
    public $writeJson(
        p: string,
        data: any,
        options?: fs.WriteFileOptions
    ): void {
        this.$writeFile(p, JSON.stringify(data, null, 2), options);
    }

    /**
     * Synchronously appends data to the end of an existing file, creating the file if it doesn't exist.
     * This method is essential for logging, accumulating data, or building files incrementally without overwriting existing content.
     *
     * @param {string} p - The path to the file to append data to.
     * @param {string | Uint8Array} data - The data to append to the file.
     * @param {fs.WriteFileOptions} [options] - Optional write options such as encoding or mode.
     * @throws {Error} If the file cannot be accessed or written to.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * fs.$append('logs/access.log', `${new Date().toISOString()} - User login\n`);
     * // Adds the log entry to the end of the file
     */
    public $append(
        p: string,
        data: string | Uint8Array,
        options?: fs.WriteFileOptions
    ): void {
        fs.appendFileSync(this.$resolve(p), data, options);
    }

    /**
     * Appends a single line of text to a file, automatically adding the appropriate newline character.
     * This method simplifies line-based file writing, ensuring consistent line endings across different platforms.
     *
     * @param {string} p - The path to the file to append the line to.
     * @param {string} line - The line of text to append (without needing to include the newline character).
     * @throws {Error} If the file cannot be accessed or written to.
     * @throws {TypeError} If the provided path or line is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * fs.$appendLine('todo.txt', 'Buy groceries');
     * fs.$appendLine('todo.txt', 'Finish project report');
     * // File now contains two lines with proper line endings
     */
    public $appendLine(p: string, line: string): void {
        this.$append(p, line + "\n");
    }

    /**
     * Creates an empty file if it doesn't exist, or updates the access and modification times of an existing file.
     * This method mimics the Unix 'touch' command behavior, useful for creating placeholder files or updating file timestamps.
     *
     * @param {string} p - The path to the file to touch.
     * @throws {Error} If the file cannot be created or its timestamps cannot be updated.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * fs.$touch('logs/app.log'); // Creates empty log file if it doesn't exist
     * // If file exists, updates its modification time to current time
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
     * Conditionally writes data to a file only if the file does not already exist, preventing accidental overwrites.
     * This method is crucial for creating default configuration files or initializing resources without destroying existing data.
     *
     * @param {string} p - The path to the file to potentially write to.
     * @param {string | NodeJS.ArrayBufferView} data - The data to write if the file doesn't exist.
     * @returns {boolean} True if the file was written (didn't exist), false if the file already existed.
     * @throws {Error} If the file exists and cannot be written to, or if writing fails.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const written = fs.$writeIfNotExists('config/default.json', '{"theme": "light"}');
     * if (written) {
     *     console.log('Default config created');
     * } else {
     *     console.log('Config already exists, not overwriting');
     * }
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
     * Synchronously creates a directory along with all necessary parent directories if they don't already exist.
     * This method ensures the complete directory path is available for subsequent file operations.
     *
     * @param {string} p - The path of the directory to create.
     * @param {boolean} [recursive=true] - Whether to create parent directories recursively (default: true).
     * @throws {Error} If the directory cannot be created or already exists and is not a directory.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * fs.$mkdir('data/processed/images/thumbnails');
     * // Creates the entire directory structure if it doesn't exist
     */
    public $mkdir(p: string, recursive: boolean = true): void {
        fs.mkdirSync(this.$resolve(p), { recursive });
    }

    /**
     * Guarantees that a directory exists by creating it if necessary, without throwing an error if it already exists.
     * This method is ideal for setup operations where you need to ensure directory availability without conditional checks.
     *
     * @param {string} p - The path of the directory to ensure exists.
     * @throws {Error} If the directory cannot be created and doesn't already exist.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * fs.$ensureDir('output/reports');
     * // Now safe to write files to 'output/reports/' without existence checks
     */
    public $ensureDir(p: string): void {
        const fullPath = this.$resolve(p);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
    }

    /**
     * Synchronously retrieves the list of items (files and directories) in a specified directory.
     * This method provides a simple way to explore directory contents without full path information.
     *
     * @param {string} p - The path of the directory to list.
     * @returns {string[]} An array of item names (files and directories) in the directory.
     * @throws {Error} If the directory does not exist or cannot be read.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const items = fs.$ls('src');
     * console.log('Items in src:', items);
     * // Output: ['index.ts', 'components', 'utils', ...]
     */
    public $ls(p: string): string[] {
        return fs.readdirSync(this.$resolve(p));
    }

    /**
     * Lists all items in a directory, returning their full absolute paths for immediate use in other operations.
     * This method is particularly useful when you need complete path information for subsequent file operations.
     *
     * @param {string} p - The path of the directory to list with full paths.
     * @returns {string[]} An array of full paths for all items in the directory.
     * @throws {Error} If the directory does not exist or cannot be read.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const fullPaths = fs.$lsFullPath('src');
     * fullPaths.forEach(path => {
     *     console.log('Processing:', path);
     *     // Can directly use these paths for other operations
     * });
     */
    public $lsFullPath(p: string): string[] {
        const fullPath = this.$resolve(p);
        return fs
            .readdirSync(fullPath)
            .map((item) => path.join(fullPath, item));
    }

    /**
     * Retrieves only the files (excluding directories and other items) from a directory listing.
     * This method is essential for operations that need to process only regular files in a specific directory.
     *
     * @param {string} p - The path of the directory to list files from.
     * @returns {string[]} An array of filenames that are regular files in the directory.
     * @throws {Error} If the directory does not exist or cannot be read.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const files = fs.$lsFiles('src');
     * files.forEach(file => {
     *     console.log('Found file:', file);
     *     // Process only files, ignore subdirectories
     * });
     */
    public $lsFiles(p: string): string[] {
        const fullPath = this.$resolve(p);
        return fs.readdirSync(fullPath).filter((item) => {
            return fs.statSync(path.join(fullPath, item)).isFile();
        });
    }

    /**
     * Retrieves only the subdirectories (excluding files and other items) from a directory listing.
     * This method is useful for traversing directory structures or performing operations on folder hierarchies.
     *
     * @param {string} p - The path of the directory to list subdirectories from.
     * @returns {string[]} An array of directory names that are subdirectories in the specified directory.
     * @throws {Error} If the directory does not exist or cannot be read.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const dirs = fs.$lsDirs('src');
     * dirs.forEach(dir => {
     *     console.log('Found directory:', dir);
     *     // Process subdirectories recursively if needed
     * });
     */
    public $lsDirs(p: string): string[] {
        const fullPath = this.$resolve(p);
        return fs.readdirSync(fullPath).filter((item) => {
            return fs.statSync(path.join(fullPath, item)).isDirectory();
        });
    }

    /**
     * Recursively traverses a directory tree and collects all file paths, with optional filtering capabilities.
     * This method is ideal for comprehensive directory analysis, bulk operations, or searching through entire project structures.
     *
     * @param {string} p - The root directory path to start the recursive listing from.
     * @param {(path: string) => boolean} [filter] - Optional filter function to include only files that match specific criteria.
     * @returns {string[]} An array of relative file paths from all subdirectories.
     * @throws {Error} If the directory does not exist or cannot be read.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const allFiles = fs.$lsRecursive('src');
     * console.log('All files in src:', allFiles);
     *
     * // With filter for TypeScript files only
     * const tsFiles = fs.$lsRecursive('src', file => file.endsWith('.ts'));
     * console.log('TypeScript files:', tsFiles);
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
     * Searches recursively through a directory tree to find all files with a specific extension.
     * This method simplifies locating files of particular types across complex project structures.
     *
     * @param {string} p - The root directory path to search in.
     * @param {string} ext - The file extension to search for (with or without leading dot).
     * @returns {string[]} An array of relative file paths that match the specified extension.
     * @throws {Error} If the directory does not exist or cannot be read.
     * @throws {TypeError} If the provided path or extension is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const jsFiles = fs.$findByExt('src', 'js');
     * const tsFiles = fs.$findByExt('src', '.ts');
     * console.log('JavaScript files:', jsFiles);
     * console.log('TypeScript files:', tsFiles);
     */
    public $findByExt(p: string, ext: string): string[] {
        const extension = ext.startsWith(".") ? ext : `.${ext}`;
        return this.$lsRecursive(p, (file) => file.endsWith(extension));
    }

    /**
     * Performs a recursive search through a directory tree using a regular expression pattern to find matching files.
     * This method provides powerful pattern-based file discovery for complex search requirements.
     *
     * @param {string} p - The root directory path to search in.
     * @param {RegExp} pattern - The regular expression pattern to match against file paths.
     * @returns {string[]} An array of relative file paths that match the provided pattern.
     * @throws {Error} If the directory does not exist or cannot be read.
     * @throws {TypeError} If the provided path is not a string or pattern is not a RegExp.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * // Find all test files
     * const testFiles = fs.$findByPattern('src', /test\.ts$/);
     * // Find all files starting with 'config'
     * const configFiles = fs.$findByPattern('.', /^config/);
     * console.log('Test files:', testFiles);
     */
    public $findByPattern(p: string, pattern: RegExp): string[] {
        return this.$lsRecursive(p, (file) => pattern.test(file));
    }

    // ========== COPY & MOVE OPERATIONS ==========

    /**
     * Synchronously copies a file or directory from one location to another, with optional overwrite control.
     * This method handles both files and directories recursively, ensuring complete and accurate duplication.
     *
     * @param {string} src - The source path of the file or directory to copy.
     * @param {string} dest - The destination path where the file or directory should be copied.
     * @param {boolean} [overwrite=true] - Whether to overwrite the destination if it exists (default: true).
     * @throws {Error} If the source doesn't exist, destination exists and overwrite is false, or copy operation fails.
     * @throws {TypeError} If the provided paths are not strings.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * fs.$copy('config/default.json', 'config/production.json');
     * // Copies the file, overwriting if production.json exists
     *
     * fs.$copy('templates', 'build/templates', false);
     * // Copies directory only if build/templates doesn't exist
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
     * Creates a duplicate of a file or directory within the same parent directory using a new name.
     * This method is convenient for creating backups, versions, or copies without specifying full destination paths.
     *
     * @param {string} p - The path of the file or directory to duplicate.
     * @param {string} newName - The new name for the duplicated item (without path).
     * @returns {string} The relative path of the newly created duplicate.
     * @throws {Error} If the source doesn't exist, destination already exists, or copy operation fails.
     * @throws {TypeError} If the provided paths are not strings.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const backupPath = fs.$duplicate('config.json', 'config.backup.json');
     * console.log('Backup created at:', backupPath);
     * // Creates 'config.backup.json' in the same directory as 'config.json'
     */
    public $duplicate(p: string, newName: string): string {
        const fullPath = this.$resolve(p);
        const dir = path.dirname(fullPath);
        const newPath = path.join(dir, newName);
        fs.cpSync(fullPath, newPath, { recursive: true });
        return path.relative(this.sys.__root__, newPath);
    }

    /**
     * Synchronously moves or renames a file or directory from one location to another.
     * This atomic operation ensures that the item is either completely moved or remains in its original location.
     *
     * @param {string} src - The source path of the file or directory to move.
     * @param {string} dest - The destination path where the file or directory should be moved.
     * @throws {Error} If the source doesn't exist, destination directory doesn't exist, or move operation fails.
     * @throws {TypeError} If the provided paths are not strings.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * fs.$move('temp/file.txt', 'archive/file.txt');
     * // Moves file.txt from temp/ to archive/ directory
     *
     * fs.$move('oldname.txt', 'newname.txt');
     * // Renames oldname.txt to newname.txt in the same directory
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
     * Renames a file or directory within its current directory using a new name.
     * This method provides a convenient way to change names without dealing with full path specifications.
     *
     * @param {string} oldPath - The current path of the file or directory to rename.
     * @param {string} newName - The new name for the item (without directory path).
     * @returns {string} The relative path of the renamed item.
     * @throws {Error} If the source doesn't exist, destination already exists, or rename operation fails.
     * @throws {TypeError} If the provided paths are not strings.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const newPath = fs.$rename('draft-report.txt', 'final-report.txt');
     * console.log('File renamed to:', newPath);
     * // Renames 'draft-report.txt' to 'final-report.txt' in the same directory
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
     * Synchronously removes a file or directory, including all contents recursively.
     * This method provides forceful deletion with configurable options for handling different scenarios.
     *
     * @param {string} p - The path of the file or directory to remove.
     * @param {fs.RmOptions} [options={ recursive: true, force: true }] - Options for the removal operation.
     * @throws {Error} If the path cannot be removed or doesn't exist.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * fs.$rm('temp/build');
     * // Removes the entire build directory and all its contents
     *
     * fs.$rm('unnecessary-file.txt', { recursive: false });
     * // Removes only the file (recursive defaults to true for safety)
     */
    public $rm(
        p: string,
        options: fs.RmOptions = { recursive: true, force: true }
    ): void {
        fs.rmSync(this.$resolve(p), options);
    }

    /**
     * Conditionally removes a file or directory only if it exists, preventing errors from attempting to delete non-existent paths.
     * This method is ideal for cleanup operations where the presence of the target is uncertain.
     *
     * @param {string} p - The path of the file or directory to remove if it exists.
     * @returns {boolean} True if the path was removed, false if it didn't exist.
     * @throws {Error} If the path exists but cannot be removed.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const removed = fs.$rmIfExists('temp/cache');
     * if (removed) {
     *     console.log('Cache directory cleaned up');
     * } else {
     *     console.log('Cache directory was already clean');
     * }
     */
    public $rmIfExists(p: string): boolean {
        if (this.$exists(p)) {
            this.$rm(p);
            return true;
        }
        return false;
    }

    /**
     * Removes all contents of a directory while preserving the directory itself.
     * This method is useful for clearing temporary directories, cache folders, or preparing directories for fresh content.
     *
     * @param {string} p - The path of the directory to empty.
     * @throws {Error} If the directory doesn't exist, is not a directory, or contents cannot be removed.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * fs.$emptyDir('build');
     * // Removes all files and subdirectories from build/, but keeps the build/ directory
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
     * Retrieves comprehensive statistics for a file or directory, including size, timestamps, and permissions.
     * This method provides access to all file system metadata available through Node.js fs.Stats.
     *
     * @param {string} p - The path of the file or directory to get statistics for.
     * @returns {fs.Stats} A Stats object containing detailed file system information.
     * @throws {Error} If the path does not exist or cannot be accessed.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const stats = fs.$stats('package.json');
     * console.log('File size:', stats.size, 'bytes');
     * console.log('Modified:', stats.mtime);
     * console.log('Is directory:', stats.isDirectory());
     */
    public $stats(p: string): fs.Stats {
        return fs.statSync(this.$resolve(p));
    }

    /**
     * Retrieves the size of a file in bytes, providing a direct way to check file dimensions.
     * This method is optimized for files and returns the raw byte count for precise size calculations.
     *
     * @param {string} p - The path of the file to get the size for.
     * @returns {number} The size of the file in bytes.
     * @throws {Error} If the path does not exist, is not a file, or cannot be accessed.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const fileSize = fs.$size('bundle.js');
     * console.log(`Bundle size: ${fileSize} bytes`);
     * if (fileSize > 1024 * 1024) {
     *     console.log('Warning: Bundle exceeds 1MB');
     * }
     */
    public $size(p: string): number {
        return this.$stats(p).size;
    }

    /**
     * Converts a file's size to a human-readable format with appropriate units (B, KB, MB, GB, TB).
     * This method provides user-friendly size representations for display purposes or logging.
     *
     * @param {string} p - The path of the file to get the human-readable size for.
     * @returns {string} The file size formatted as a string with appropriate units (e.g., "1.5 MB").
     * @throws {Error} If the path does not exist, is not a file, or cannot be accessed.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const readableSize = fs.$sizeHuman('large-dataset.json');
     * console.log(`Dataset size: ${readableSize}`);
     * // Output: "Dataset size: 45.2 MB"
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
     * Calculates the total size of a directory by recursively summing the sizes of all files within it.
     * This method provides comprehensive directory size analysis for storage management and optimization.
     *
     * @param {string} p - The path of the directory to calculate the total size for.
     * @returns {number} The total size of the directory in bytes, including all nested files.
     * @throws {Error} If the directory does not exist or cannot be accessed.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const totalSize = fs.$sizeDir('node_modules');
     * console.log(`Node modules size: ${Math.round(totalSize / 1024 / 1024)} MB`);
     * // Useful for monitoring project bloat or cache sizes
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
     * Retrieves the creation timestamp of a file or directory, indicating when it was first created on the file system.
     * This timestamp represents the initial creation time and may differ from modification time.
     *
     * @param {string} p - The path of the file or directory to get the creation time for.
     * @returns {Date} A Date object representing the creation time of the file system entry.
     * @throws {Error} If the path does not exist or cannot be accessed.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const created = fs.$createdAt('important-document.pdf');
     * console.log(`Document was created on: ${created.toLocaleDateString()}`);
     * // Useful for tracking file origins or implementing retention policies
     */
    public $createdAt(p: string): Date {
        return this.$stats(p).birthtime;
    }

    /**
     * Retrieves the last modification timestamp of a file or directory, indicating when its content was last changed.
     * This timestamp is crucial for build systems, caching mechanisms, and change detection algorithms.
     *
     * @param {string} p - The path of the file or directory to get the modification time for.
     * @returns {Date} A Date object representing the last modification time of the file system entry.
     * @throws {Error} If the path does not exist or cannot be accessed.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const modified = fs.$modifiedAt('src/index.ts');
     * const now = new Date();
     * const hoursSinceModified = (now - modified) / (1000 * 60 * 60);
     * if (hoursSinceModified > 24) {
     *     console.log('File hasn\'t been modified in over a day');
     * }
     */
    public $modifiedAt(p: string): Date {
        return this.$stats(p).mtime;
    }

    /**
     * Retrieves the last access timestamp of a file or directory, indicating when it was last read or accessed.
     * This timestamp is useful for understanding usage patterns, implementing LRU caches, or identifying stale files.
     *
     * @param {string} p - The path of the file or directory to get the access time for.
     * @returns {Date} A Date object representing the last access time of the file system entry.
     * @throws {Error} If the path does not exist or cannot be accessed.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const accessed = fs.$accessedAt('config/settings.json');
     * const daysSinceAccess = (Date.now() - accessed.getTime()) / (1000 * 60 * 60 * 24);
     * if (daysSinceAccess > 30) {
     *     console.log('Configuration file hasn\'t been accessed in over a month');
     * }
     */
    public $accessedAt(p: string): Date {
        return this.$stats(p).atime;
    }

    // ========== COMPARISON & SEARCH ==========

    /**
     * Compares the content of two files to determine if they are identical byte-for-byte.
     * This method is essential for duplicate detection, integrity verification, and change tracking.
     *
     * @param {string} path1 - The path of the first file to compare.
     * @param {string} path2 - The path of the second file to compare.
     * @returns {boolean} True if both files exist and have identical content, false otherwise.
     * @throws {TypeError} If either path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const identical = fs.$isSameContent('config/production.json', 'config/staging.json');
     * if (identical) {
     *     console.log('Configuration files are synchronized');
     * } else {
     *     console.log('Configuration files differ - review changes');
     * }
     */
    public $isSameContent(path1: string, path2: string): boolean {
        if (!this.$isFile(path1) || !this.$isFile(path2)) return false;
        const content1 = this.$readFile(path1);
        const content2 = this.$readFile(path2);
        return content1.toString() === content2.toString();
    }

    /**
     * Determines if the first file has been modified more recently than the second file.
     * This method is crucial for build systems, dependency checking, and incremental processing workflows.
     *
     * @param {string} path1 - The path of the first file to compare.
     * @param {string} path2 - The path of the second file to compare.
     * @returns {boolean} True if the first file is newer (modified more recently) than the second file.
     * @throws {Error} If either file does not exist.
     * @throws {TypeError} If either path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * if (fs.$isNewer('src/index.ts', 'dist/bundle.js')) {
     *     console.log('Source has been modified - rebuild needed');
     *     // Trigger build process
     * } else {
     *     console.log('Build is up to date');
     * }
     */
    public $isNewer(path1: string, path2: string): boolean {
        return this.$modifiedAt(path1) > this.$modifiedAt(path2);
    }

    /**
     * Determines if the first file has been modified less recently than the second file.
     * This method complements $isNewer and is useful for identifying outdated files or cache invalidation.
     *
     * @param {string} path1 - The path of the first file to compare.
     * @param {string} path2 - The path of the second file to compare.
     * @returns {boolean} True if the first file is older (modified less recently) than the second file.
     * @throws {Error} If either file does not exist.
     * @throws {TypeError} If either path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * if (fs.$isOlder('dist/bundle.js', 'src/index.ts')) {
     *     console.log('Bundle is outdated - source has been modified');
     *     // Trigger rebuild
     * } else {
     *     console.log('Bundle is current');
     * }
     */
    public $isOlder(path1: string, path2: string): boolean {
        return this.$modifiedAt(path1) < this.$modifiedAt(path2);
    }

    /**
     * Performs a recursive search through a directory tree to find all files containing the specified text.
     * This method is powerful for code analysis, configuration validation, and content discovery across project structures.
     *
     * @param {string} dir - The root directory path to search in.
     * @param {string} searchText - The text string to search for within files.
     * @returns {string[]} An array of relative file paths that contain the search text.
     * @throws {Error} If the directory does not exist or cannot be read.
     * @throws {TypeError} If the directory path or search text is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const filesWithTodo = fs.$searchInFiles('src', 'TODO');
     * console.log(`Found ${filesWithTodo.length} files with TODO comments:`);
     * filesWithTodo.forEach(file => console.log(`  - ${file}`));
     *
     * // Search for configuration references
     * const configRefs = fs.$searchInFiles('.', 'process.env.');
     * console.log('Files using environment variables:', configRefs);
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
     * Generates a unique filename by appending a numerical counter if the original filename already exists.
     * This method ensures file operations won't overwrite existing files by automatically finding an available name.
     *
     * @param {string} p - The desired filename path.
     * @returns {string} A unique filename path that doesn't conflict with existing files.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const uniqueName = fs.$uniqueFilename('backup.json');
     * console.log(`Using filename: ${uniqueName}`);
     * // If 'backup.json' exists, returns 'backup (1).json'
     * // If 'backup (1).json' also exists, returns 'backup (2).json', etc.
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
     * Creates a unique temporary directory with an optional prefix, ensuring no naming conflicts.
     * This method is ideal for temporary workspaces, build processes, or any scenario requiring isolated directory operations.
     *
     * @param {string} [prefix='tmp-'] - The prefix to use for the temporary directory name.
     * @returns {string} The relative path of the newly created temporary directory.
     * @throws {Error} If the temporary directory cannot be created.
     * @throws {TypeError} If the prefix is provided but not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const tempDir = fs.$mkdtemp('build-');
     * console.log(`Created temporary directory: ${tempDir}`);
     * // Creates something like 'build-abc123def' and returns its relative path
     *
     * // Use for temporary processing
     * fs.$writeFile(`${tempDir}/data.txt`, 'temporary data');
     * // ... process files ...
     * fs.$rm(tempDir); // Clean up when done
     */
    public $mkdtemp(prefix: string = "tmp-"): string {
        const tmpDir = fs.mkdtempSync(path.join(this.sys.__root__, prefix));
        return path.relative(this.sys.__root__, tmpDir);
    }

    /**
     * Reads file content and normalizes line endings to Unix-style (\n) for clipboard compatibility.
     * This method ensures that copied text maintains consistent formatting across different platforms and applications.
     *
     * @param {string} p - The path of the file to read for clipboard use.
     * @returns {string} The file content with normalized line endings suitable for clipboard operations.
     * @throws {Error} If the file does not exist or cannot be read.
     * @throws {TypeError} If the provided path is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const clipboardContent = fs.$readForClipboard('README.md');
     * // Copy to clipboard (platform-specific implementation needed)
     * // navigator.clipboard.writeText(clipboardContent);
     *
     * // Useful for sharing code snippets or documentation
     */
    public $readForClipboard(p: string): string {
        const content = this.$readFile(p, "utf8") as string;
        return content.replace(/\r\n/g, "\n");
    }

    /**
     * Sets up a file system watcher to monitor a file or directory for changes, enabling reactive responses to file system events.
     * This method is essential for live reloading, automated builds, and real-time file synchronization.
     *
     * @param {string} p - The path of the file or directory to watch.
     * @param {(eventType: string, filename: string | null) => void} callback - The function to call when changes occur.
     * @returns {fs.FSWatcher} The file system watcher instance that can be used to stop watching.
     * @throws {Error} If the path does not exist or the watcher cannot be established.
     * @throws {TypeError} If the path is not a string or callback is not a function.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const watcher = fs.$watch('src', (eventType, filename) => {
     *     console.log(`${eventType} detected on ${filename}`);
     *     if (eventType === 'change') {
     *         // Trigger rebuild or reload
     *         rebuildProject();
     *     }
     * });
     *
     * // Later, stop watching
     * // watcher.close();
     */
    public $watch(
        p: string,
        callback: (eventType: string, filename: string | null) => void
    ): fs.FSWatcher {
        return fs.watch(this.$resolve(p), callback);
    }

    /**
     * Applies a processing function to all files in a directory tree recursively, enabling bulk transformations and operations.
     * This method is powerful for code refactoring, content updates, or applying consistent changes across multiple files.
     *
     * @param {string} dir - The root directory path to process files in.
     * @param {(filePath: string, content: string) => string} processor - The function to apply to each file's content.
     * @throws {Error} If the directory does not exist or files cannot be processed.
     * @throws {TypeError} If the directory path is not a string or processor is not a function.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     *
     * // Update copyright notices in all TypeScript files
     * fs.$batchProcess('src', (filePath, content) => {
     *     if (filePath.endsWith('.ts')) {
     *         return content.replace(/Copyright 2023/g, 'Copyright 2024');
     *     }
     *     return content; // Return unchanged for non-TS files
     * });
     *
     * // Minify all JSON files
     * fs.$batchProcess('config', (filePath, content) => {
     *     if (filePath.endsWith('.json')) {
     *         return JSON.stringify(JSON.parse(content)); // Remove extra whitespace
     *     }
     *     return content;
     * });
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
     * Creates a backup copy of a file or directory by appending a suffix to the original name.
     * This method provides a simple way to preserve the current state before making potentially destructive changes.
     *
     * @param {string} p - The path of the file or directory to back up.
     * @param {string} [suffix='.backup'] - The suffix to append to create the backup filename.
     * @returns {string} The relative path of the created backup.
     * @throws {Error} If the source doesn't exist or the backup cannot be created.
     * @throws {TypeError} If the path or suffix is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     * const backupPath = fs.$backup('config/database.json');
     * console.log(`Backup created: ${backupPath}`);
     * // Creates 'config/database.json.backup'
     *
     * // Modify the original file safely
     * fs.$writeJson('config/database.json', newConfig);
     * // If something goes wrong, can restore from backup
     */
    public $backup(p: string, suffix: string = ".backup"): string {
        const fullPath = this.$resolve(p);
        const backupPath = fullPath + suffix;
        fs.cpSync(fullPath, backupPath, { recursive: true });
        return path.relative(this.sys.__root__, backupPath);
    }

    /**
     * Restores a file or directory from its backup copy created with the $backup method.
     * This method provides a reliable way to revert changes by replacing the current file with its backup version.
     *
     * @param {string} p - The path of the file or directory to restore.
     * @param {string} [suffix='.backup'] - The suffix used when creating the backup.
     * @returns {boolean} True if the restoration was successful, false if no backup was found.
     * @throws {Error} If the restoration process fails.
     * @throws {TypeError} If the path or suffix is not a string.
     * @example
     * const fs = new XyPrissFS({ __root__: '/home/user/project' });
     *
     * // Create a backup first
     * fs.$backup('config/settings.json');
     *
     * // Make changes that might need reverting
     * fs.$writeJson('config/settings.json', riskyChanges);
     *
     * // If something goes wrong, restore from backup
     * const restored = fs.$restore('config/settings.json');
     * if (restored) {
     *     console.log('Settings restored from backup');
     * } else {
     *     console.log('No backup found');
     * }
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


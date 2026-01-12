import { XyPrissRunner } from "./XyPrissRunner";

/**
 * **Base API Class**
 *
 * Serves as the foundational layer for all XyPriss domain-specific APIs.
 * It encapsulates the `XyPrissRunner` instance, ensuring that all subclasses
 * have unified access to the underlying Rust bridge for high-performance system operations.
 */
export class BaseApi {
    /**
     * Initializes the Base API with a shared runner instance.
     * @param runner The XyPrissRunner instance responsible for executing system commands.
     */
    constructor(protected runner: XyPrissRunner) {}
}

/**
 * **Professional Path Manipulation API**
 *
 * The `PathApi` class provides a comprehensive suite of robust, platform-independent
 * utilities for working with file and directory paths. By bridging directly to
 * Rust's `std::path` module, it ensures rigorous adherence to filesystem standards
 * across Windows, macOS, and Linux environments.
 *
 * **Key Benefits:**
 * - **Cross-Platform Consistency:** Eliminates separator issues (`/` vs `\`).
 * - **Security:** Prevents path traversal vulnerabilities via strict normalization.
 * - **Reliability:** Handles edge cases like trailing slashes and empty segments correctly.
 *
 * @class PathApi
 * @extends BaseApi
 */
export class PathApi extends BaseApi {
    /**
     * **Resolve to Absolute Path**
     *
     * Resolves a sequence of path segments into an absolute path. The resulting path
     * is normalized, meaning all `..` (parent) and `.` (current) references are resolved.
     *
     * This method is critical for generating safe, unambiguous file paths relative to
     * the project root or the current working directory.
     *
     * @param {...string[]} paths - A sequence of path segments to resolve.
     * @returns {string} The resulting absolute path string.
     *
     * @example
     * // Resolving a configuration file relative to the project root
     * const configPath = __sys__.$resolve("config", "settings.json");
     * console.log(configPath);
     * // Output (Linux): "/home/user/project/config/settings.json"
     * // Output (Windows): "C:\Users\user\project\config\settings.json"
     *
     * @example
     * // Handling parent directory navigation
     * const rootPath = __sys__.$resolve("src", "utils", "../..");
     * // Output: "/home/user/project" (Back to root)
     */
    public $resolve = (...paths: string[]): string =>
        this.runner.runSync("path", "resolve", paths);

    /**
     * **Join Path Segments**
     *
     * Joins all given path segments together using the platform-specific separator as a delimiter,
     * then normalizes the resulting path. This is the preferred way to construct paths
     * to ensure validity across different operating systems.
     *
     * @param {...string[]} paths - A sequence of path segments to join.
     * @returns {string} The constructed path string.
     *
     * @example
     * // Constructing a path for a log file
     * const logPath = __sys__.$join("var", "logs", "app.log");
     * // Output (Linux): "var/logs/app.log"
     * // Output (Windows): "var\logs\app.log"
     */
    public $join = (...paths: string[]): string =>
        this.runner.runSync("path", "join", paths);

    /**
     * **Get Directory Name**
     *
     * Returns the directory name of a `path`. Typically used to get the parent folder
     * of a file. It behavior follows the standard Unix `dirname` command.
     *
     * @param {string} p - The path to parse.
     * @returns {string} The directory portion of the path.
     *
     * @example
     * // Extracting the parent directory
     * const parentDir = __sys__.$dirname("/usr/local/bin/node");
     * console.log(parentDir); // -> "/usr/local/bin"
     */
    public $dirname = (p: string): string =>
        this.runner.runSync("path", "dirname", [p]);

    /**
     * **Get Base Name**
     *
     * Returns the last portion of a `path`. This is commonly used to extract the
     * filename from a full path. An optional suffix can be provided to remove
     * the file extension effectively.
     *
     * @param {string} p - The path to evaluate.
     * @param {string} [suffix] - An optional suffix to remove (e.g., ".txt").
     * @returns {string} The base name (filename) of the path.
     *
     * @example
     * // Getting a filename including extension
     * const file = __sys__.$basename("/src/models/user.ts");
     * console.log(file); // -> "user.ts"
     *
     * @example
     * // Getting a filename without extension
     * const name = __sys__.$basename("/src/models/user.ts", ".ts");
     * console.log(name); // -> "user"
     */
    public $basename = (p: string, suffix?: string): string =>
        this.runner.runSync("path", "basename", suffix ? [p, suffix] : [p]);

    /**
     * **Get File Extension**
     *
     * Returns the extension of the path, including the leading dot (`.`).
     * The extension is determined from the last portion of the path. If there
     * is no `.` in the last portion, or if the first character is `.`, exact
     * behavior mirrors standard library definitions (returning empty string or the dotfile name).
     *
     * @param {string} p - The path to evaluate.
     * @returns {string} The extension of the file (e.g., ".ts", ".json").
     *
     * @example
     * // checking file type
     * const ext = __sys__.$extname("data.json");
     * if (ext === ".json") {
     *   console.log("It's a JSON file!");
     * }
     */
    public $extname = (p: string): string =>
        this.runner.runSync("path", "extname", [p]);

    /**
     * **Calculate Relative Path**
     *
     * Solves the relative path from `from` to `to`.
     * This is essential when you need to generate import paths or link two files
     * relative to each other within the filesystem.
     *
     * @param {string} from - The source path (start point).
     * @param {string} to - The destination path.
     * @returns {string} The relative path string.
     *
     * @example
     * // Finding relationship between two directories
     * const relative = __sys__.$relative("/project/src/views", "/project/src/components");
     * console.log(relative); // -> "../components"
     */
    public $relative = (from: string, to: string): string =>
        this.runner.runSync("path", "relative", [from, to]);

    /**
     * **Normalize Path**
     *
     * Normalizes a given path string, resolving `..` and `.` segments.
     * It also collapses multiple sequential separators (e.g., `//` -> `/`)
     * and ensures the path is in its simplest standard form.
     *
     * @param {string} p - The path to normalize.
     * @returns {string} The clean, normalized path.
     *
     * @example
     * // Cleaning up a messy path
     * const clean = __sys__.$normalize("/users//john/./docs/../images");
     * console.log(clean); // -> "/users/john/images"
     */
    public $normalize = (p: string): string =>
        this.runner.runSync("path", "normalize", [p]);
}


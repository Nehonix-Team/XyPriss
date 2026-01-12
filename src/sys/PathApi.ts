import { XyPrissRunner } from "./XyPrissRunner";

/**
 * **Base API Class**
 *
 * Foundation for all domain-specific APIs in the XyPriss ecosystem.
 * Maintains the shared reference to the `XyPrissRunner` for Rust bridge communication.
 */
export class BaseApi {
    constructor(protected runner: XyPrissRunner) {}
}

/**
 * **Professional Path Manipulation API**
 *
 * Provides a robust, platform-independent interface for path resolution, normalization, and parsing.
 * Bridges directly to Rust's `std::path` for strictly correct handling of file paths across
 * Linux, macOS, and Windows environments.
 *
 * @final This API is part of the core system inheritance chain.
 * @access Public API via `__sys__` (e.g., `__sys__.$resolve(...)`).
 */
export class PathApi extends BaseApi {
    /**
     * **Resolve Absolute Path**
     *
     * Resolves a sequence of paths or path segments into an absolute path.
     * The resulting path is normalized and resolves `..` and `.` segments.
     * Use this to generate safe, absolute file paths relative to the project root.
     *
     * @param {...string[]} paths - A sequence of paths or path segments.
     * @returns {string} The absolute path.
     *
     * @example
     * ```typescript
     * // Resolve a path relative to the project root
     * const configPath = __sys__.$resolve("config", "settings.json");
     * console.log(configPath); // -> "/home/user/project/config/settings.json"
     * ```
     */
    public $resolve = (...paths: string[]): string =>
        this.runner.runSync("path", "resolve", paths);

    /**
     * **Join Path Segments**
     *
     * Joins all given path segments together using the platform-specific separator as a delimiter,
     * then normalizes the resulting path.
     *
     * @param {...string[]} paths - A sequence of path segments.
     * @returns {string} The joined path string.
     *
     * @example
     * ```typescript
     * const fullPath = __sys__.$join("src", "modules", "user.ts");
     * // Linux: "src/modules/user.ts"
     * // Windows: "src\modules\user.ts"
     * ```
     */
    public $join = (...paths: string[]): string =>
        this.runner.runSync("path", "join", paths);

    /**
     * **Get Directory Name**
     *
     * Returns the directory name of a path. Similar to the Unix `dirname` command.
     *
     * @param {string} p - The path to evaluate.
     * @returns {string} The directory name.
     *
     * @example
     * ```typescript
     * const parent = __sys__.$dirname("/home/user/docs/file.txt");
     * console.log(parent); // -> "/home/user/docs"
     * ```
     */
    public $dirname = (p: string): string =>
        this.runner.runSync("path", "dirname", [p]);

    /**
     * **Get Base Name**
     *
     * Returns the last portion of a path. Similar to the Unix `basename` command.
     * Often used to extract a filename from a full path.
     *
     * @param {string} p - The path to evaluate.
     * @param {string} [suffix] - An optional suffix to remove (e.g., ".txt").
     * @returns {string} The base name.
     *
     * @example
     * ```typescript
     * const filename = __sys__.$basename("/src/index.ts");
     * // -> "index.ts"
     *
     * const nameOnly = __sys__.$basename("/src/index.ts", ".ts");
     * // -> "index"
     * ```
     */
    public $basename = (p: string, suffix?: string): string =>
        this.runner.runSync("path", "basename", [p], { suffix });

    /**
     * **Get File Extension**
     *
     * Returns the extension of the path, from the last occurrence of the `.` (period) character to end of string in the last portion of the path.
     * If there is no `.` in the last portion of the path or the first character of it is `.`, returns an empty string.
     *
     * @param {string} p - The path to evaluate.
     * @returns {string} The extension (including the dot).
     *
     * @example
     * ```typescript
     * const ext = __sys__.$extname("index.html");
     * // -> ".html"
     * ```
     */
    public $extname = (p: string): string =>
        this.runner.runSync("path", "extname", [p]);

    /**
     * **Get Relative Path**
     *
     * Solves the relative path from `from` to `to`.
     * At times we have two absolute paths, and we need to derive the relative path from one to the other.
     *
     * @param {string} from - The source path.
     * @param {string} to - The destination path.
     * @returns {string} The relative path.
     *
     * @example
     * ```typescript
     * const rel = __sys__.$relative("/data/orandea/test/aaa", "/data/orandea/impl/bbb");
     * // -> "../../impl/bbb"
     * ```
     */
    public $relative = (from: string, to: string): string =>
        this.runner.runSync("path", "relative", [from, to]);

    /**
     * **Normalize Path**
     *
     * Normalizes the given path, resolving `..` and `.` segments.
     * When found, multiple, sequential path segment separation characters are replaced by a single instance of the platform-specific separator.
     * Trailing separators are preserved.
     *
     * @param {string} p - The path to normalize.
     * @returns {string} The normalized path.
     *
     * @example
     * ```typescript
     * const clean = __sys__.$normalize("/foo/bar//baz/asdf/quux/..");
     * // -> "/foo/bar/baz/asdf"
     * ```
     */
    public $normalize = (p: string): string =>
        this.runner.runSync("path", "normalize", [p]);
}


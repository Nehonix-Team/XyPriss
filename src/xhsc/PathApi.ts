/* *****************************************************************************
 * Nehonix XyPriss System
 *
 * ACCESS RESTRICTIONS:
 * - This software is exclusively for use by Authorized Personnel of NEHONIX
 * - Intended for Internal Use only within NEHONIX operations
 * - No rights granted to unauthorized individuals or entities
 * - All modifications are works made for hire assigned to NEHONIX
 *
 * PROHIBITED ACTIVITIES:
 * - Copying, distributing, or sublicensing without written permission
 * - Reverse engineering, decompiling, or disassembling
 * - Creating derivative works without explicit authorization
 * - External use or commercial distribution outside NEHONIX
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * For questions or permissions, contact:
 * NEHONIX Legal Department
 * Email: legal@nehonix.com
 * Website: www.nehonix.com
 ***************************************************************************** */

import { getRandomBytes } from "xypriss-security";
import {
    createXyprissTempDir,
    generateFuserTmpDir,
} from "../plugins/const/XyprissTempDir";
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
 * the native engine's internal path module, it ensures rigorous adherence to filesystem standards
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
     * const configPath = __sys__.path.resolve("config", "settings.json");
     * console.log(configPath);
     * // Output (Linux): "/home/user/project/config/settings.json"
     * // Output (Windows): "C:\Users\user\project\config\settings.json"
     *
     * @example
     * // Handling parent directory navigation
     * const rootPath = __sys__.path.resolve("src", "utils", "../..");
     * // Output: "/home/user/project" (Back to root)
     */
    public resolve = (...paths: string[]): string =>
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
     * const logPath = __sys__.path.join("var", "logs", "app.log");
     * // Output (Linux): "var/logs/app.log"
     * // Output (Windows): "var\logs\app.log"
     */
    public join = (...paths: string[]): string =>
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
     * const parentDir = __sys__.path.dirname("/usr/local/bin/node");
     * console.log(parentDir); // -> "/usr/local/bin"
     */
    public dirname = (p: string): string =>
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
     * const file = __sys__.path.basename("/src/models/user.ts");
     * console.log(file); // -> "user.ts"
     *
     * @example
     * // Getting a filename without extension
     * const name = __sys__.path.basename("/src/models/user.ts", ".ts");
     * console.log(name); // -> "user"
     */
    public basename = (p: string, suffix?: string): string =>
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
     * const ext = __sys__.path.extname("data.json");
     * if (ext === ".json") {
     *   console.log("It's a JSON file!");
     * }
     */
    public extname = (p: string): string =>
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
     * const relative = __sys__.path.relative("/project/src/views", "/project/src/components");
     * console.log(relative); // -> "../components"
     */
    public relative = (from: string, to: string): string =>
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
     * const clean = __sys__.path.normalize("/users//john/./docs/../images");
     * console.log(clean); // -> "/users/john/images"
     */
    public normalize = (p: string): string =>
        this.runner.runSync("path", "normalize", [p]);

    /**
     * **Check Child Path Relationship**
     *
     * Determines if a given `child` path is strictly contained within a `parent` directory.
     * This is a critical security utility for verifying that file operations remain
     * within authorized boundaries.
     *
     * @param {string} parent - The expected parent directory.
     * @param {string} child - The path to check.
     * @returns {boolean} True if child is inside parent.
     */
    public isChild = (parent: string, child: string): boolean =>
        this.runner.runSync("path", "is-child", [parent, child]);

    /**
     * **Secure Path Join**
     *
     * Joins path segments and ensures the result is strictly within the `base` path.
     * If the resulting path attempts to escape via traversal (e.g., `../`), it
     * throws a security error or returns a safe path.
     *
     * @param {string} base - The root/base directory.
     * @param {...string[]} segments - The segments to join.
     * @returns {string} The joined, safe path.
     */
    public secureJoin = (base: string, ...segments: string[]): string =>
        this.runner.runSync("path", "secure-join", [base, ...segments]);

    /**
     * **Get Comprehensive Path Metadata**
     *
     * Returns a structured object containing directory, base name, extension,
     * filename without extension, and absolute status - all in a single high-speed call.
     *
     * @param {string} p - The path to evaluate.
     * @returns {object} Metadata object: { dir, base, ext, name, isAbsolute }
     */
    public metadata = (
        p: string,
    ): {
        dir: string;
        base: string;
        ext: string;
        name: string;
        isAbsolute: boolean;
    } => this.runner.runSync("path", "metadata", [p]);

    /**
     * **Convert to Namespaced Path**
     *
     * Converts the path to a platform-specific namespaced path (e.g., UNC on Windows).
     * This is essential for handling extremely long paths or network shares natively.
     *
     * @param {string} p - The path to convert.
     * @returns {string} The namespaced path.
     */
    public toNamespacedPath = (p: string): string =>
        this.runner.runSync("path", "to-namespaced", [p]);

    /**
     * **Normalize Separators**
     *
     * Standardizes all path separators (`/` or `\`) to the current operating system's
     * primary separator format.
     *
     * @param {string} p - The path to handle.
     * @returns {string} The path with uniform separators.
     */
    public normalizeSeparators = (p: string): string =>
        this.runner.runSync("path", "normalize-separators", [p]);

    /**
     * **Identify Common Base Directory**
     *
     * Analyzes multiple paths and returns the deepest common directory shared by all.
     *
     * @param {...string[]} paths - Multiple paths to analyze.
     * @returns {string} The shared parent directory.
     */
    public commonBase = (...paths: string[]): string =>
        this.runner.runSync("path", "common-base", paths);

    /**
     * **Check if Path is Absolute**
     *
     * Determines if the given path is an absolute path. This is platform-aware,
     * correctly handling Windows drive letters and Unix root slashes.
     *
     * @param {string} p - The path to check.
     * @returns {boolean} True if the path is absolute, false otherwise.
     */
    public isAbsolute = (p: string): boolean =>
        this.runner.runSync("path", "is-absolute", [p]);

    /**
     * **Smart Path Correction**
     *
     * Attempts to fix path inconsistencies, such as doubled segments or redundant separators.
     * Uses the high-performance native engine for deep inspection.
     *
     * @param p - Path to correct.
     * @param tentative - Maximum number of correction attempts.
     */
    public correct = (p: string, tentative: number = 4): string =>
        this.runner.runSync("path", "correct", [p], { tentative });

    /**
     * **Get System Temp Directory**
     */
    public tempDir = (): string => {
        return require("os").tmpdir();
    };

    /**
     * **User-Scoped Temp Directory**
     *
     * Resolves and ensures a unique, ephemeral temporary directory scoped
     * to the current user session under the XyPriss shared temp root
     * (`<os.tmpdir>/nehonix.xypriss.data/xuser/<hex4>`).
     *
     * Each access generates a fresh random sub-path — suited for
     * short-lived scratch space that must not collide across concurrent
     * processes or requests.
     *
     * @returns {string} Absolute path to the isolated user temp directory.
     *
     * @example
     * const scratch = __sys__.path.tmpUserDir;
     * __sys__.fs.writeFile(scratch + "/output.json", data);
     */
    public get tmpUserDir(): string {
        return createXyprissTempDir([generateFuserTmpDir()]);
    }

    /**
     * **Check Existence**
     */
    public exists = (p: string): boolean => {
        try {
            const res = this.runner.runSync("fs", "check", [p]) as any;
            return res?.exists === true;
        } catch {
            return false;
        }
    };

    /**
     * **Check if Directory**
     */
    public isDir = (p: string): boolean => {
        try {
            const res = this.runner.runSync("fs", "stats", [p]) as any;
            return res?.is_dir === true;
        } catch {
            return false;
        }
    };

    /**
     * **Check if File**
     */
    public isFile = (p: string): boolean => {
        try {
            const res = this.runner.runSync("fs", "stats", [p]) as any;
            return res?.is_file === true;
        } catch {
            return false;
        }
    };

    /**
     * **Check if Symlink**
     */
    public isSymlink = (p: string): boolean => {
        try {
            const res = this.runner.runSync("fs", "stats", [p]) as any;
            return res?.is_symlink === true;
        } catch {
            return false;
        }
    };

    /**
     * **Check if Empty**
     */
    public isEmpty = (p: string): boolean => {
        try {
            if (this.isFile(p)) {
                const res = this.runner.runSync("fs", "size", [p]) as any;
                return res?.bytes === 0;
            }
            if (this.isDir(p)) {
                const res = this.runner.runSync("fs", "ls", [p]) as any[];
                return res?.length === 0;
            }
            return false;
        } catch {
            return false;
        }
    };
}


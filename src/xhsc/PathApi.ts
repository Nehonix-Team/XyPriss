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

import nodePath from "node:path";
import os from "node:os";
import { getRandomBytes } from "xypriss-security";
import {
    createXyprissTempDir,
    generateXUserTmpDir,
    getInstanceId,
    getSessionHash,
} from "../plugins/const/XyprissTempDir";
import { XyPrissRunner } from "./XyPrissRunner";

/**
 * **Base API Class**
 *
 * Serves as the foundational layer for all XyPriss domain-specific APIs.
 * It encapsulates the `XyPrissRunner` instance, ensuring that all subclasses
 * have unified access to the underlying XHSC bridge for high-performance system operations.
 */
export class BaseApi {
    /**
     * Initializes the Base API with a shared runner instance.
     * @param runner - The XyPrissRunner used to invoke native XHSC binaries.
     */
    constructor(protected runner: XyPrissRunner) {}
}

/**
 * **Professional Path Manipulation API**
 *
 * The `PathApi` class provides a comprehensive suite of robust, platform-independent
 * utilities for working with file and directory paths. By bridging directly to
 * the XHSC native binary, it ensures rigorous adherence to filesystem standards
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
    public resolve = (...paths: string[]): string => {
        try {
            return this.runner.runSync<string>("path", "resolve", paths);
        } catch {
            return nodePath.resolve(...paths);
        }
    };

    public join = (...paths: string[]): string => {
        try {
            return this.runner.runSync<string>("path", "join", paths);
        } catch {
            return nodePath.join(...paths);
        }
    };

    public dirname = (p: string): string => {
        try {
            return this.runner.runSync<string>("path", "dirname", [p]);
        } catch {
            return nodePath.dirname(p);
        }
    };

    public basename = (p: string, suffix?: string): string => {
        try {
            return this.runner.runSync<string>(
                "path",
                "basename",
                suffix !== undefined ? [p, suffix] : [p],
            );
        } catch {
            return nodePath.basename(p, suffix);
        }
    };

    public extname = (p: string): string => {
        try {
            return this.runner.runSync<string>("path", "extname", [p]);
        } catch {
            return nodePath.extname(p);
        }
    };

    public relative = (from: string, to: string): string => {
        try {
            return this.runner.runSync<string>("path", "relative", [from, to]);
        } catch {
            return nodePath.relative(from, to);
        }
    };

    public normalize = (p: string): string => {
        try {
            return this.runner.runSync<string>("path", "normalize", [p]);
        } catch {
            return nodePath.normalize(p);
        }
    };

    public isChild = (parent: string, child: string): boolean => {
        try {
            return this.runner.runSync<boolean>("path", "is-child", [
                parent,
                child,
            ]);
        } catch {
            const rel = nodePath.relative(
                nodePath.resolve(parent),
                nodePath.resolve(child),
            );
            return !rel.startsWith("..") && !nodePath.isAbsolute(rel);
        }
    };

    public secureJoin = (base: string, ...segments: string[]): string => {
        try {
            return this.runner.runSync<string>("path", "secure-join", [
                base,
                ...segments,
            ]);
        } catch {
            const resolvedBase = nodePath.resolve(base);
            const target = nodePath.resolve(resolvedBase, ...segments);
            if (!this.isChild(resolvedBase, target) && resolvedBase !== target) {
                throw new Error(
                    `Path traversal attempt detected: ${target} escapes ${resolvedBase}`,
                );
            }
            return target;
        }
    };

    public metadata = (
        p: string,
    ): {
        dir: string;
        base: string;
        ext: string;
        name: string;
        isAbsolute: boolean;
    } => {
        try {
            const res = this.runner.runSync<any>("path", "metadata", [p]);
            if (res && typeof res === "object") {
                return {
                    dir: res.dir || "",
                    base: res.base || "",
                    ext: res.ext || "",
                    name: res.name || "",
                    isAbsolute: Boolean(res.is_absolute ?? res.isAbsolute),
                };
            }
        } catch {}
        return {
            dir: nodePath.dirname(p),
            base: nodePath.basename(p),
            ext: nodePath.extname(p),
            name: nodePath.basename(p, nodePath.extname(p)),
            isAbsolute: nodePath.isAbsolute(p),
        };
    };

    public toNamespacedPath = (p: string): string => {
        try {
            return this.runner.runSync<string>("path", "to-namespaced", [p]);
        } catch {
            return nodePath.toNamespacedPath(p);
        }
    };

    public normalizeSeparators = (p: string): string => {
        try {
            return this.runner.runSync<string>("path", "normalize-separators", [
                p,
            ]);
        } catch {
            return p.replace(/[/\\]+/g, nodePath.sep);
        }
    };

    public commonBase = (...paths: string[]): string => {
        try {
            return this.runner.runSync<string>("path", "common-base", paths);
        } catch {
            if (paths.length === 0) return "";
            if (paths.length === 1)
                return nodePath.dirname(nodePath.resolve(paths[0]));
            const splitPaths = paths.map((p) =>
                nodePath.resolve(p).split(nodePath.sep),
            );
            const minLen = Math.min(...splitPaths.map((p) => p.length));
            let common: string[] = [];
            for (let i = 0; i < minLen; i++) {
                const seg = splitPaths[0][i];
                if (splitPaths.every((p) => p[i] === seg)) {
                    common.push(seg);
                } else {
                    break;
                }
            }
            return common.join(nodePath.sep) || nodePath.sep;
        }
    };

    public isAbsolute = (p: string): boolean => {
        try {
            return this.runner.runSync<boolean>("path", "is-absolute", [p]);
        } catch {
            return nodePath.isAbsolute(p);
        }
    };

    /**
     * **Smart Path Correction**
     *
     * Attempts to fix path inconsistencies, such as doubled segments or redundant separators.
     * Prioritizes the high-performance XHSC implementation.
     *
     * @param p - Path to correct.
     * @param tentative - Maximum number of correction attempts.
     */
    public correct(
        path: string,
        options: { tentative?: number; verify?: boolean } = {},
    ): string {
        const tentative = options.tentative ?? 3;
        const verify = options.verify ?? false;
        return this.runner.runSync<string>("path", "correct", [
            path,
            String(tentative),
            String(verify),
        ]);
    }

    /**
     * **Get System Temp Directory**
     */
    public tempDir = (): string => {
        try {
            return this.runner.runSync<string>("path", "tempdir");
        } catch {
            return (
                process.env.XYPRISS_USER_TMP ||
                process.env.XESS_SESSION_TMP ||
                (typeof os !== "undefined" ? os.tmpdir() : "/tmp")
            );
        }
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
        const userDir = generateXUserTmpDir();
        return userDir || "";
    }

    /**
     * **Instance Unique Identifier Hash**
     *
     * Returns the 8-character process-scoped instance hash for the active server run.
     */
    public get instanceId(): string {
        return getInstanceId();
    }

    /**
     * **Session Hash**
     *
     * Returns the 8-character session hash ID for the active server instance.
     * Guaranteed to match between xfpm, libproc, libport, libxess, and XyPriss.
     */
    public get sessionHash(): string {
        return getSessionHash();
    }

    /**
     * **Check Existence**
     */
    public exist = (p: string): boolean => {
        try {
            const res = this.runner.runSync("fs", "check", [p]) as any;
            return res?.exists === true;
        } catch {
            return false;
        }
    };

    // for compatibility
    /**
     * **Check Existence**
     * @deprecated use exist instead
     */
    public exists = (p: string): boolean => this.exist(p);

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


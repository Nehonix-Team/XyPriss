import { getRandomBytes } from "xypriss-security";

/**
 * Lazy accessor for `localSysApi`.
 *
 * Deferred to call-time to break the circular initialization chain:
 * `xhsc.ts` -> `PathApi` -> `XyprissTempDir` -> `xhsc` (localSysApi)
 */
export function getSysApi() {
    return (require("../../xhsc") as typeof import("../../xhsc")).localSysApi;
}

/**
 * Returns the absolute path to the XyPriss shared temp directory.
 *
 * @returns {string} Path to `<os.tmpdir>/nehonix.xypriss.data`
 */
export function getXyprissTempDir(): string {
    const sys = getSysApi();
    return sys.path.join(sys.path.tempDir(), "nehonix.xypriss.data");
}

/**
 * Resolves and ensures a sub-path within the XyPriss temp directory exists.
 *
 * @param {string | string[]} _p - Sub-path segment(s) to append.
 * @returns {string} The absolute resolved temp sub-path.
 */
export function createXyprissTempDir(_p: string | string[]): string {
    const sys = getSysApi();
    const base = getXyprissTempDir();

    const segment =
        typeof _p === "string"
            ? _p
            : _p.includes("/")
              ? _p.map((p) => p.replace("/", "")).join("/")
              : _p.join("/");

    // Use the native corrective layer to prevent doubling or redundant separators
    const rawPath = segment.startsWith(base)
        ? segment
        : sys.path.join(base, segment);
    const normalisedPath = sys.path.correct(rawPath, 2);

    if (!sys.fs.exists(normalisedPath)) {
        sys.fs.mkdir(normalisedPath, { parents: true });
    }

    return normalisedPath;
}

/**
 * **Session Temp Directory (singleton)**
 *
 * Unique sub-path generated once per process lifetime under the XyPriss
 * temp root (`<os.tmpdir>/nehonix.xypriss.data/xuser/<hex4>`).
 *
 * The value is memoized on first access and remains stable for the entire
 * duration of the running process, ensuring all callers within the same
 * session share the same isolated scratch space.
 */
let _sessionTmpDir: string | null = null;

/**
 * Returns the process-scoped user temp directory path.
 *
 * Generates a 4-byte hex identifier once and caches it for the lifetime
 * of the process. Subsequent calls always return the same path.
 *
 * @returns {string} Absolute path, e.g. `/tmp/nehonix.xypriss.data/xuser/a3f1`
 */
export function generateFuserTmpDir(): string {
    if (_sessionTmpDir !== null) {
        return _sessionTmpDir;
    }

    const sys = getSysApi();
    const hex = getRandomBytes(16).slice(0, 4).toString("hex");
    _sessionTmpDir = sys.path.join(getXyprissTempDir(), "xuser", hex);

    return _sessionTmpDir;
}

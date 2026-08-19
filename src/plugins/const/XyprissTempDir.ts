import { getRandomBytes, Hash } from "xypriss-security";
import { getSysApi } from "./getSysApi";


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
    const normalisedPath = sys.path.correct(rawPath, { tentative: 2 });
    // console.log("normalisedPath: ", normalisedPath);

    if (!sys.fs.exists(normalisedPath)) {
        sys.fs.mkdir(normalisedPath, { parents: true });
    }

    return normalisedPath;
}

let _instanceId: string | null = null;

/**
 * Returns a unique 8-character instance identifier (hash) for the active server process.
 * Memoized once per process run.
 */
export function getInstanceId(): string {
    if (_instanceId !== null) {
        return _instanceId;
    }
    const raw = `${process.pid}-${Date.now()}-${getRandomBytes(8).toString("hex")}`;
    _instanceId = Hash.create(Buffer.from(raw), { algorithm: "sha256" }).toString("hex").slice(0, 8);
    return _instanceId;
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
 * Safely purges orphan session folders from past terminated/dead processes
 * without touching active server instances.
 */
export function sweepOrphanXUserTmpDirs(): void {
    try {
        const sys = getSysApi();
        const xuserRoot = sys.path.join(getXyprissTempDir(), "xuser");
        if (!sys.fs.exist(xuserRoot)) return;

        const entries = sys.fs.ls(xuserRoot);
        for (const entry of entries) {
            const folderName = typeof entry === "string" ? entry : entry[0];
            const fullPath = sys.path.join(xuserRoot, folderName);

            // Skip current active process session temp directory
            if (_sessionTmpDir && sys.path.resolve(fullPath) === sys.path.resolve(_sessionTmpDir)) {
                continue;
            }

            const pidFile = sys.path.join(fullPath, ".pid");
            let isAlive = false;

            if (sys.fs.exist(pidFile)) {
                try {
                    const pidRaw = sys.fs.readSync(pidFile);
                    const pidContent = String(pidRaw || "").trim();
                    const pid = parseInt(pidContent, 10);
                    if (!isNaN(pid) && pid > 0) {
                        try {
                            isAlive = process.kill(pid, 0);
                        } catch (err: any) {
                            isAlive = err.code === "EPERM";
                        }
                    }
                } catch {}
            }

            // Do not delete temp directories of active running instances!
            if (isAlive) {
                continue;
            }

            if (sys.fs.exist(fullPath)) {
                try {
                    sys.fs.rm(fullPath, { force: true });
                } catch {}
            }
        }
    } catch {}
}

/**
 * Returns the process-scoped user temp directory path for THIS active server instance.
 *
 * Generates an instance ID hash once and caches it for the lifetime of the process.
 * E.g. `/tmp/nehonix.xypriss.data/xuser/12daa75a`
 *
 * @returns {string} Absolute path to instance temp directory
 */
export function generateXUserTmpDir(): string {
    if (_sessionTmpDir !== null) {
        return _sessionTmpDir;
    }

    const sys = getSysApi();
    const instanceId = getInstanceId();
    _sessionTmpDir = sys.path.join(getXyprissTempDir(), "xuser", instanceId);

    if (!sys.fs.exist(_sessionTmpDir)) {
        sys.fs.mkdir(_sessionTmpDir, { parents: true });
    }

    // Write .pid lockfile inside the instance directory
    try {
        const pidFile = sys.path.join(_sessionTmpDir, ".pid");
        sys.fs.writeFileSync(pidFile, String(process.pid));
    } catch {}

    // Sweep orphaned folders from past dead processes safely
    sweepOrphanXUserTmpDirs();

    return _sessionTmpDir;
}



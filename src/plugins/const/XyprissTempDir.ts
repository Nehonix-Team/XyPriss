import { getSysApi } from "./getSysApi";

/**
 * Returns the absolute path to the XyPriss shared temp directory.
 *
 * @returns {string} Path to `<os.tmpdir>/nehonix.xypriss.data`
 */
export function getXyprissTempDir(): string {
    const sys = getSysApi();
    return sys!.path.join(sys!.path.tempDir(), "nehonix.xypriss.data");
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
        : sys!.path.join(base, segment);
    const normalisedPath = sys!.path.correct(rawPath, { tentative: 2 });

    if (!sys!.fs.exist(normalisedPath)) {
        sys!.fs.mkdir(normalisedPath, { parents: true });
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
 * Safely purges orphan session folders from past terminated/dead processes
 * without touching active server instances.
 */
export function sweepOrphanXUserTmpDirs(): void {
    try {
        const sys = getSysApi();
        if (!sys) return;

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
                    sys.fs.rm(fullPath, { force: true, recursive: true } as any);
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

    // 1. Adopt the session directory allocated exclusively by the libProc supervisor
    const envSession =
        sys?.__env__?.get("XYPRISS_USER_TMP") ||
        sys?.__env__?.get("XESS_SESSION_TMP") ||
        (typeof process !== "undefined"
            ? (process.env?.XYPRISS_USER_TMP || (process.env as any)?.XESS_SESSION_TMP)
            : undefined);

    if (envSession && typeof envSession === "string") {
        _sessionTmpDir = envSession;
        if (sys?.fs && !sys.fs.exist(_sessionTmpDir)) {
            sys.fs.mkdir(_sessionTmpDir, { parents: true });
        }
        return _sessionTmpDir;
    }

    // No supervisor session provisioned by libProc: unconfined execution has no valid session
    return "";
}

/**
 * Returns the unique 8-character session hash ID for the active server instance.
 * Delegated exclusively to the libProc supervisor (Single Source of Truth).
 */
export function getSessionHash(): string {
    const sys = getSysApi();

    const envHash =
        sys?.__env__?.get("XYPRISS_SESSION_HASH") ||
        (typeof process !== "undefined" ? process.env?.XYPRISS_SESSION_HASH : undefined);

    if (envHash && typeof envHash === "string") {
        return envHash;
    }

    if (_sessionTmpDir) {
        if (sys?.path) {
            return sys.path.basename(_sessionTmpDir);
        }
        const parts = _sessionTmpDir.split(/[/\\]/).filter(Boolean);
        return parts[parts.length - 1] || "";
    }

    return "";
}

/**
 * Backward-compatibility alias for getSessionHash().
 */
export function getInstanceId(): string {
    return getSessionHash();
}

/**
 * **Scoped libXESS Temp Directory**
 *
 * Scopes libXESS temporary decoys and IPC socket files inside the dedicated
 * session temp directory under `xuser` (`<tmpdir>/nehonix.xypriss.data/xuser/<instanceId>/xess`).
 *
 * @returns {string} Absolute path to instance xess temp directory
 */
export function getXessTempDir(): string {
    const sys = getSysApi();

    const envXess =
        sys?.__env__?.get("XESS_TEMP_DIR") ||
        (typeof process !== "undefined" ? process.env?.XESS_TEMP_DIR : undefined);
    if (envXess && typeof envXess === "string") {
        return envXess;
    }

    const sessionDir = generateXUserTmpDir();
    if (!sessionDir) {
        return "";
    }

    const xessDir = sys?.path ? sys.path.join(sessionDir, "xess") : `${sessionDir}/xess`;

    if (sys?.fs && !sys.fs.exist(xessDir)) {
        sys.fs.mkdir(xessDir, { parents: true });
    }

    return xessDir;
}




import fs from "node:fs";
import path from "node:path";

let _ephemeralToken: string | null = null;

/**
 * Retrieves the ephemeral session token provisioned exclusively by libxess.
 * Adheres strictly to Zero-Trust Confinement:
 * - Reads from isolated session directory ($XYPRISS_USER_TMP/.auth_token).
 * - No mock sessions or fallbacks outside XESS supervisor.
 */
export function getInternalSignature(): string {
    if (_ephemeralToken) {
        return _ephemeralToken;
    }

    // 1. Read from session directory provisioned by libxess
    const sessionDir = process.env.XYPRISS_USER_TMP || (process.env as any).XESS_SESSION_TMP;
    if (sessionDir) {
        const tokenFile = path.join(sessionDir, ".auth_token");
        try {
            if (fs.existsSync(tokenFile)) {
                _ephemeralToken = fs.readFileSync(tokenFile, "utf-8").trim();
                return _ephemeralToken;
            }
        } catch {
            // Unreadable or protected
        }
    }

    // 2. Read from protected environment variable if passed by parent supervisor
    if (process.env.XYPRISS_INTERNAL_TOKEN) {
        _ephemeralToken = process.env.XYPRISS_INTERNAL_TOKEN.trim();
        return _ephemeralToken;
    }

    return "";
}

/**
 * Explicitly burns the ephemeral token from memory and unsets environment references.
 */
export function clearInternalSignature(): void {
    _ephemeralToken = null;
    try {
        delete (process.env as any).XYPRISS_INTERNAL_TOKEN;
        delete (process.env as any).XYPRISS_XESS_AUTH_TOKEN;
    } catch {}
}

/**
 * Irreversibly locks the internal session authentication post-boot:
 * - Shreds and unlinks the ephemeral .auth_token from disk
 * - Clears in-memory ephemeral token references
 * - Deletes environment variables
 * After this call, no subsequent or rogue process can ever boot XHSC.
 */
export function lockSessionAuth(): void {
    _ephemeralToken = null;
    try {
        const sessionDir = process.env.XYPRISS_USER_TMP || (process.env as any).XESS_SESSION_TMP;
        if (sessionDir) {
            const tokenPath = path.join(sessionDir, ".auth_token");
            if (fs.existsSync(tokenPath)) {
                try {
                    fs.writeFileSync(tokenPath, "0".repeat(64), "utf-8");
                } catch {}
                fs.unlinkSync(tokenPath);
            }
        }
    } catch {}
    clearInternalSignature();
}

export const XHSC_SIGNATURE = "";

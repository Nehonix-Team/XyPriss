/**
 * @module HoneypotTarpit
 *
 * A specialized dynamic tarpit to instantly drop connections from malicious bots
 * and vulnerability scanners.
 *
 * ### Security Benefits
 * - Immediate socket destruction for known bot attacks (O(1) lookups).
 * - Bypasses all expensive application routing, regex matching, and payload parsing.
 * - Saves server CPU and event-loop resources when under automated attack.
 */
export class HoneypotTarpit {
    // ─────────────────────────────────────────────────────────────────────────
    // Trap Signatures
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Set of exact paths that represent common vulnerability scans.
     * Legitimate users should never request these files.
     */
    private static readonly EXACT_TRAPS = new Set([
        "/.env",
        "/.env.local",
        "/.env.production",
        "/.git",
        "/.git/config",
        "/wp-login.php",
        "/wp-admin",
        "/wp-config.php",
        "/config.json",
        "/.aws/credentials",
        "/.ssh/id_rsa",
        "/.ssh/authorized_keys",
        "/.vscode/sftp.json",
        "/phpinfo.php",
        "/docker-compose.yml",
        "/composer.lock",
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Checks if the normalized path matches any of our known honeypot traps.
     *
     * @param {string} normalizedPath - The perfectly normalized URI path.
     * @returns {boolean} `true` if the path is a trap, `false` otherwise.
     */
    public static isTrap(normalizedPath: string): boolean {
        // Fast exact match for common root files
        if (HoneypotTarpit.EXACT_TRAPS.has(normalizedPath)) {
            return true;
        }

        // Block obvious PHP and WordPress scanner extensions natively
        if (
            normalizedPath.endsWith(".php") ||
            normalizedPath.includes("/wp-includes/")
        ) {
            return true;
        }

        return false;
    }

    /**
     * Instantly dismantles the connection at the lowest possible TCP/HTTP level.
     *
     * By destroying the underlying socket without sending an HTTP response:
     * 1. We keep the scanner hanging or disconnected.
     * 2. We consume fewer internal Node.js resources.
     * 3. We avoid contributing to bandwidth usage with 4xx or 5xx bodies.
     *
     * @param req The raw incoming request (http.IncomingMessage or similar).
     * @param res The raw incoming response (http.ServerResponse or similar).
     */
    public static handleTrap(req: any, res: any): void {
        try {
            // Destroy the socket completely if available to enact a real Tarpit
            if (req.socket && typeof req.socket.destroy === "function") {
                req.socket.destroy();
            } else if (res.destroy && typeof res.destroy === "function") {
                res.destroy();
            } else {
                // Fallback dropping if socket destroy isn't supported in the specific server impl
                if (typeof res.end === "function") {
                    res.writeHead(403, "Forbidden");
                    res.end();
                }
            }
        } catch (e) {
            // Failsafe: Do nothing. If destroy throws, the connection is already dead.
        }
    }
}


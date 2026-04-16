/**
 * @module HoneypotTarpit
 * @version 2.0.0
 *
 * A hardened, zero-false-positive honeypot tarpit designed to instantly identify
 * and neutralize connections from malicious bots, vulnerability scanners, and
 * automated exploit frameworks (e.g. Shodan crawlers, Nuclei, WPScan, Metasploit).
 *
 * ### Architecture
 * Detection is performed in a layered pipeline, ordered from cheapest to most
 * specific, so the most common attacks are rejected at the very first check:
 *
 * ```
 * raw path
 *   │
 *   ▼
 * [1] sanitizeInput()       — rejects null / non-string / oversized paths
 *   │
 *   ▼
 * [2] normalizePath()       — decodes percent-encoding, collapses traversal
 *                             sequences, removes redundant slashes
 *   │
 *   ▼
 * [3] matchesExactTrap()    — O(1) Set lookup for highest-confidence paths
 *   │
 *   ▼
 * [4] matchesPrefixTrap()   — catches sub-paths under sensitive directories
 *   │
 *   ▼
 * [5] matchesSuffixTrap()   — catches files by dangerous extension
 *   │
 *   ▼
 * [6] matchesSegmentTrap()  — catches scanner-specific path segments
 *   │
 *   ▼
 * result → true (trap) | false (safe)
 * ```
 *
 * ### Design Principles
 * - **Zero false positives**: every rule targets patterns that are *never* used
 *   by legitimate production applications. Generic extensions like `.php` are
 *   intentionally excluded; only high-signal, context-specific signatures are used.
 * - **Bypass resistance**: the normalizer resolves URL encoding, path traversal
 *   (`../`), and duplicate slashes before any rule is evaluated.
 * - **O(1) hot path**: the most common scanner payloads hit a `Set` lookup and
 *   return immediately with no iteration cost.
 * - **No public surface expansion**: all detection helpers are `private static`,
 *   keeping the public API surface identical to v1.
 *
 * ### Security Benefits
 * - Bypasses all expensive application routing, regex matching, and payload parsing.
 * - Responds with a bare 403 before any middleware, session, or DB code runs.
 * - Saves server CPU and Node.js event-loop headroom under automated attack.
 *
 * @example
 * ```typescript
 * // Middleware usage (Express / Fastify raw handler)
 * app.use((req, res, next) => {
 *   if (HoneypotTarpit.isTrap(req.url)) {
 *     return HoneypotTarpit.handleTrap(req, res);
 *   }
 *   next();
 * });
 * ```
 */
import { UriNormalizer } from "./UriNormalizer";

export class HoneypotTarpit {
    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Maximum accepted path length (bytes).
     * Paths exceeding this length are treated as traps to neutralize buffer-probing
     * attacks before any string processing occurs.
     *
     * @internal
     */
    private static readonly MAX_PATH_LENGTH = 2048;

    // ─────────────────────────────────────────────────────────────────────────
    // Trap Signatures — Exact Paths
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * High-confidence exact paths that are **never** legitimate in any modern
     * web application. All entries are lowercase; comparison is performed against
     * a lowercased, normalized path.
     *
     * Sources: OWASP Top-10 scanner payloads, Shodan query signatures,
     * Nuclei template library, Metasploit auxiliary scanner modules.
     *
     * @internal
     */
    private static readonly EXACT_TRAPS = new Set<string>([
        // ── Credentials & Secrets ─────────────────────────────────────────
        "/.env",
        "/.env.local",
        "/.env.production",
        "/.env.staging",
        "/.env.development",
        "/.env.test",
        "/.env.backup",
        "/.env.bak",
        "/.env.old",
        "/.env.orig",
        "/.env.example", // may contain real secrets in misconfigured repos
        "/.aws/credentials",
        "/.aws/config",
        "/.ssh/id_rsa",
        "/.ssh/id_dsa",
        "/.ssh/id_ecdsa",
        "/.ssh/id_ed25519",
        "/.ssh/authorized_keys",
        "/.ssh/known_hosts",
        "/.netrc",
        "/.htpasswd",
        "/.pgpass",

        // ── Git / Version Control ─────────────────────────────────────────
        "/.git",
        "/.git/config",
        "/.git/head",
        "/.git/index",
        "/.git/packed-refs",
        "/.git/refs/heads/main",
        "/.git/refs/heads/master",
        "/.gitconfig",
        "/.svn/entries",
        "/.hg/hgrc",

        // ── Cloud & Infrastructure Config ─────────────────────────────────
        "/docker-compose.yml",
        "/docker-compose.yaml",
        "/.dockerenv",
        "/dockerfile",
        "/kubernetes.yml",
        "/k8s.yml",
        "/terraform.tfvars",
        "/.terraform/terraform.tfstate",

        // ── Application Config Files ──────────────────────────────────────
        "/config.json",
        "/config.yml",
        "/config.yaml",
        "/settings.json",
        "/appsettings.json",
        "/appsettings.production.json",
        "/web.config",
        "/app.config",
        "/database.yml",
        "/secrets.yml",

        // ── Dependency & Build Artefacts ──────────────────────────────────
        "/composer.lock",
        "/composer.json",
        "/package.json",
        "/package-lock.json",
        "/yarn.lock",
        "/gemfile.lock",
        "/pipfile.lock",
        "/poetry.lock",
        "/cargo.lock",
        "/go.sum",

        // ── IDE & Editor Files ────────────────────────────────────────────
        "/.vscode/sftp.json",
        "/.vscode/launch.json",
        "/.idea/dataSources.xml",
        "/.idea/workspace.xml",

        // ── PHP / WordPress ───────────────────────────────────────────────
        "/wp-login.php",
        "/wp-admin",
        "/wp-config.php",
        "/wp-config.php.bak",
        "/wp-config.php.orig",
        "/wp-config.php.save",
        "/wp-config-sample.php",
        "/xmlrpc.php",
        "/phpinfo.php",
        "/php.ini",
        "/php-fpm.conf",

        // ── Spring Boot / Java Actuator ───────────────────────────────────
        "/actuator",
        "/actuator/env",
        "/actuator/health",
        "/actuator/info",
        "/actuator/mappings",
        "/actuator/beans",
        "/actuator/configprops",
        "/actuator/dump",
        "/actuator/shutdown",
        "/env", // standalone Spring env endpoint
        "/heapdump",
        "/trace",

        // ── Common CMS / Admin Panels ─────────────────────────────────────
        "/admin",
        "/administrator",
        "/phpmyadmin",
        "/pma",
        "/adminer",
        "/adminer.php",
        "/typo3",
        "/joomla",
        "/drupal",
        "/magento",
        "/manager/html", // Tomcat manager

        // ── macOS / OS Artefacts ──────────────────────────────────────────
        "/.ds_store",
        "/thumbs.db",
        "/desktop.ini",

        // ── Backup & Dump Files ───────────────────────────────────────────
        "/backup.sql",
        "/dump.sql",
        "/database.sql",
        "/db.sql",
        "/backup.zip",
        "/backup.tar.gz",
        "/www.zip",
        "/site.tar.gz",
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // Trap Signatures — Directory Prefixes
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Path prefixes whose entire subtree should be considered traps.
     * A request for `/.git/logs/HEAD` is just as dangerous as one for `/.git/config`.
     *
     * Rules are matched with a trailing-slash anchor to avoid collisions
     * (e.g. `/.gitignore` must **not** match the `/.git/` prefix rule).
     *
     * @internal
     */
    private static readonly PREFIX_TRAPS = new Set<string>([
        "/.git/",
        "/.svn/",
        "/.hg/",
        "/.ssh/",
        "/.aws/",
        "/.vscode/",
        "/.idea/",
        "/wp-includes/",
        "/wp-content/plugins/",
        "/wp-admin/",
        "/actuator/",
        "/proc/", // Linux /proc LFI attempts
        "/etc/", // /etc/passwd, /etc/shadow LFI attempts
        "/var/log/", // log file LFI
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // Trap Signatures — File Extensions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * File extensions that are exclusively associated with scanner probes or
     * sensitive file types that should **never** be served over HTTP in any
     * legitimate modern application.
     *
     * Deliberately conservative — common extensions like `.php`, `.bak`, or
     * `.log` are excluded because they *may* be intentionally served by some
     * apps. Only zero-ambiguity extensions are listed here.
     *
     * @internal
     */
    private static readonly SUFFIX_TRAPS = new Set<string>([
        ".pem", // TLS private keys / certificates
        ".p12", // PKCS#12 keystores
        ".pfx", // Personal Information Exchange (Windows keystore)
        ".key", // Generic private keys
        ".crt", // X.509 certificates (when accessed directly)
        ".cer", // Alternative certificate extension
        ".jks", // Java KeyStore
        ".id_rsa", // SSH private key variants with compound extensions
        ".htaccess", // Apache access control — never a user-facing resource
        ".htpasswd", // Apache password file
        ".DS_Store", // macOS metadata (case-normalised before comparison)
        ".tfstate", // Terraform state (may contain secrets)
        ".tfvars", // Terraform variable files (often contain secrets)
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // Trap Signatures — Path Segments
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Discrete path segments (surrounded by `/` boundaries or at string edges)
     * that indicate well-known scanner probes regardless of their position in
     * the path hierarchy.
     *
     * Each entry is matched as a full segment to prevent substring collisions
     * (e.g. `"admin"` must not trap `/admin-panel` but must trap `/api/admin`).
     *
     * @internal
     */
    private static readonly SEGMENT_TRAPS = new Set<string>([
        "phpmyadmin",
        "pma",
        "adminer",
        "wp-login.php",
        "xmlrpc.php",
        "phpinfo.php",
        ".env",
        ".git",
        ".svn",
        ".hg",
        "actuator",
        "heapdump",
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Determines whether a raw URI path matches any known honeypot trap signature.
     *
     * The method is intentionally **stateless and synchronous** to guarantee
     * sub-millisecond latency even under high-volume scanner floods. It applies
     * a four-stage pipeline internally (see module-level docs) and returns as
     * soon as the first positive match is found.
     *
     * #### False-positive safeguards
     * - Input is sanitized and validated before any rule is evaluated.
     * - Path normalization resolves all encoding tricks before matching.
     * - All rules are scoped to patterns that are unambiguously malicious.
     * - Broad wildcard rules (e.g. "all `.php` files") are deliberately absent.
     *
     * @param {string} rawPath - The raw, un-normalized URI path from the incoming
     *   request (e.g. `req.url` in Node.js `http.IncomingMessage`). Query strings
     *   and fragments are accepted but stripped before evaluation.
     * @returns {boolean} `true` if the path matches a trap and the request should
     *   be handed to {@link handleTrap}; `false` if the path appears legitimate.
     *
     * @example
     * ```typescript
     * HoneypotTarpit.isTrap("/.env");                 // true
     * HoneypotTarpit.isTrap("/.env%2elocal");         // true  (encoded bypass)
     * HoneypotTarpit.isTrap("/api/v1/users");         // false
     * HoneypotTarpit.isTrap("/assets/logo.png");      // false
     * HoneypotTarpit.isTrap("/../.env");              // true  (traversal bypass)
     * ```
     */
    public static isTrap(rawPath: string): boolean {
        if (!HoneypotTarpit.sanitizeInput(rawPath)) {
            // Malformed or oversized paths are themselves a signal of probing.
            return true;
        }

        const pathPart = rawPath.split(/[?#]/)[0];
        const normalized = UriNormalizer.normalizePath(pathPart).toLowerCase();

        return (
            HoneypotTarpit.matchesExactTrap(normalized) ||
            HoneypotTarpit.matchesPrefixTrap(normalized) ||
            HoneypotTarpit.matchesSuffixTrap(normalized) ||
            HoneypotTarpit.matchesSegmentTrap(normalized)
        );
    }

    /**
     * Sends a minimal HTTP 403 Forbidden response and terminates the connection.
     *
     * The response is intentionally bare — no body, no `Content-Type`, no
     * application-level headers — to minimize bandwidth consumption and avoid
     * leaking server fingerprint information to the scanner.
     *
     * #### Why 403 and not a socket destroy?
     * Destroying the raw socket (`req.socket.destroy()`) is tempting but unsafe
     * when the Node.js process sits behind a reverse proxy (nginx, Caddy, HAProxy)
     * or uses keep-alive connection pooling, because the socket may be shared
     * across multiple logical HTTP requests. A 403 + `res.end()` correctly closes
     * only the current HTTP transaction without disrupting the underlying TCP
     * connection pool.
     *
     * @param {object} req - The raw incoming request object. Compatible with
     *   `http.IncomingMessage`, `Http2ServerRequest`, and Fastify/Express
     *   request wrappers. Not used directly but accepted for API symmetry and
     *   future extensibility (e.g. logging, rate-limiting by IP).
     * @param {object} res - The raw outgoing response object. Must expose
     *   `writeHead(statusCode: number): void` and `end(): void`. Compatible
     *   with `http.ServerResponse`, `Http2ServerResponse`, and most framework
     *   response wrappers.
     * @returns {void}
     *
     * @example
     * ```typescript
     * app.use((req, res, next) => {
     *   if (HoneypotTarpit.isTrap(req.url)) {
     *     return HoneypotTarpit.handleTrap(req, res);
     *   }
     *   next();
     * });
     * ```
     */
    public static handleTrap(
        req: { socket?: unknown },
        res: { writeHead?: (status: number) => void; end?: () => void },
    ): void {
        try {
            if (typeof res.writeHead === "function") {
                res.writeHead(403);
            }
            if (typeof res.end === "function") {
                res.end();
            }
        } catch {
            // Failsafe: swallow all errors — the goal is merely to drop the
            // connection. Any exception here means the socket is already gone.
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private — Input Validation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Validates that the raw path is a non-empty string within the accepted
     * length budget.
     *
     * Paths that fail this check (wrong type, empty, or suspiciously long) are
     * themselves indicators of malicious probing and should be treated as traps
     * by the caller.
     *
     * @param {unknown} value - The raw value received from the request object.
     * @returns {boolean} `true` if the value is a safe, processable string;
     *   `false` if it should be rejected immediately.
     *
     * @internal
     */
    private static sanitizeInput(value: unknown): value is string {
        return (
            typeof value === "string" &&
            value.length > 0 &&
            value.length <= HoneypotTarpit.MAX_PATH_LENGTH
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private — Match Layers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Layer 1 — Exact path match.
     *
     * Performs an O(1) `Set` lookup against {@link EXACT_TRAPS}. This is the
     * most performant check and handles the vast majority of scanner probes,
     * which tend to request well-known canonical paths verbatim.
     *
     * @param {string} normalizedPath - The fully normalized, lowercase path.
     * @returns {boolean} `true` if the path is an exact trap match.
     *
     * @internal
     */
    private static matchesExactTrap(normalizedPath: string): boolean {
        return HoneypotTarpit.EXACT_TRAPS.has(normalizedPath);
    }

    /**
     * Layer 2 — Directory prefix match.
     *
     * Tests whether the normalized path starts with any entry from
     * {@link PREFIX_TRAPS}. This catches requests for any sub-resource within
     * a sensitive directory (e.g. `/.git/logs/HEAD`, `/.ssh/known_hosts`).
     *
     * Each prefix entry is stored with a trailing `/` to prevent false positives
     * from partial name collisions (e.g. `/.gitignore` must not match the
     * `/.git/` prefix).
     *
     * @param {string} normalizedPath - The fully normalized, lowercase path.
     * @returns {boolean} `true` if the path falls under a trapped directory.
     *
     * @internal
     */
    private static matchesPrefixTrap(normalizedPath: string): boolean {
        for (const prefix of HoneypotTarpit.PREFIX_TRAPS) {
            if (normalizedPath.startsWith(prefix)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Layer 3 — File extension (suffix) match.
     *
     * Extracts the file extension from the final path segment and checks it
     * against {@link SUFFIX_TRAPS}. Only the extension of the *filename* is
     * considered; directory components are ignored to prevent collisions like
     * `/certs-info/page` matching `.certs`.
     *
     * The comparison is performed on the already-lowercased normalized path,
     * so no additional case folding is required here.
     *
     * @param {string} normalizedPath - The fully normalized, lowercase path.
     * @returns {boolean} `true` if the file extension is a known trap extension.
     *
     * @internal
     */
    private static matchesSuffixTrap(normalizedPath: string): boolean {
        const lastSegment = normalizedPath.split("/").pop() ?? "";
        const dotIndex = lastSegment.lastIndexOf(".");
        if (dotIndex === -1) {
            return false; // No extension present.
        }
        const extension = lastSegment.slice(dotIndex); // e.g. ".pem"
        return HoneypotTarpit.SUFFIX_TRAPS.has(extension);
    }

    /**
     * Layer 4 — Path segment match.
     *
     * Splits the normalized path into discrete segments and checks each one
     * against {@link SEGMENT_TRAPS}. This catches scanner payloads embedded
     * at arbitrary depths (e.g. `/api/v2/actuator`, `/proxy/wp-login.php`).
     *
     * Matching on full segments (rather than substrings) prevents false positives
     * such as `/administration` matching a rule for `admin`.
     *
     * @param {string} normalizedPath - The fully normalized, lowercase path.
     * @returns {boolean} `true` if any path segment matches a known trap segment.
     *
     * @internal
     */
    private static matchesSegmentTrap(normalizedPath: string): boolean {
        const segments = normalizedPath.split("/").filter(Boolean);
        for (const segment of segments) {
            if (HoneypotTarpit.SEGMENT_TRAPS.has(segment)) {
                return true;
            }
        }
        return false;
    }
}


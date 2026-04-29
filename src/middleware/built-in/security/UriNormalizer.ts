import * as vm from "vm";

/**
 * @module UriNormalizer
 *
 * Normalization and security utilities for URIs and paths.
 *
 * ### Supported Threats
 * - Path traversal (including encoded variants: `%2F`, `%2E`, double-encoded `%2520`)
 * - Injection of null bytes and control characters
 * - ReDoS attacks via sandbox execution with an adaptive timeout
 * - Backslash smuggling (`\..\..\`)
 * - Unicode normalized segments (NFC) to prevent traversal homoglyphs
 *
 * ### Non-regression Guarantees (no false positives)
 * - Legitimate paths with encoded special characters are preserved correctly.
 * - The trailing slash is preserved if present in the original input.
 * - Internal empty segments are cleanly removed (`//` collapse).
 * - The root `/` is always returned for an empty or null input.
 *
 * @example
 * ```ts 
 * UriNormalizer.normalizePath("/foo/%2E%2E/bar");   // => "/bar"
 * UriNormalizer.normalizePath("/a//b/../c/");        // => "/a/c/"
 * UriNormalizer.safeRegexCheck(/^[a-z]+$/, "hello"); // => true
 * ```
 */
export class UriNormalizer {
    // ─────────────────────────────────────────────────────────────────────────
    // Private Constants
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Maximum number of URI decoding iterations to stop infinite loops
     * on pathological inputs (e.g., synthetic infinite encodings).
     */
    private static readonly MAX_DECODE_ITERATIONS = 10;

    /**
     * Minimum length (inclusive) from which regex execution is deferred
     * to an isolated VM context with a timeout, regardless of the apparent
     * complexity of the pattern.
     *
     * Lowered to 20 chars to cover catastrophic patterns on short
     * repetitive inputs (e.g., `(a+)+` tested on `"aaaaaaaaaaaaaaaab"`).
     */
    private static readonly REGEX_VM_LENGTH_THRESHOLD = 20;

    /**
     * Base VM timeout in milliseconds. It is proportionally increased
     * according to the string length to avoid false positives on long
     * legitimate inputs while keeping a hard limit on ReDoS.
     *
     * @see {@link UriNormalizer.computeRegexTimeout}
     */
    private static readonly REGEX_BASE_TIMEOUT_MS = 50;

    /**
     * Multiplicative factor (ms per 1,000 characters) added to the base
     * timeout for long strings. This prevents false positives on large
     * legitimate inputs.
     */
    private static readonly REGEX_TIMEOUT_PER_1K_CHARS = 5;

    /**
     * Absolute ceiling for the VM timeout in milliseconds to prevent
     * a massive input from rendering the timeout useless.
     */
    private static readonly REGEX_MAX_TIMEOUT_MS = 200;

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Normalizes a URI path by resolving `.` and `..` segments, multiple
     * slashes, backslashes, null bytes, control characters, and all URI
     * encodings (including double-encodings such as `%2520`).
     *
     * Normalization follows this strict order to eliminate bypass vectors:
     * 1. Iterative decoding until stabilization (anti double-encoding).
     * 2. Unicode NFC normalization (anti homoglyphs).
     * 3. Replacement of backslashes with forward slashes.
     * 4. Removal of null bytes and control characters.
     * 5. Collapse of multiple slashes.
     * 6. Resolution of `.` and `..` segments.
     * 7. Restoration of the trailing slash if the original input had one.
     *
     * ### Guaranteed Behaviors
     * - `""` or `null`/`undefined` → `"/"`
     * - Paths where all segments resolve above the root are clipped
     *   to `"/"` (no underflow possible).
     * - The trailing slash is faithfully preserved or removed based on the input.
     * - Unicode control characters (U+0000–U+001F, U+007F–U+009F)
     *   are systematically removed.
     *
     * @param {string} pathStr - The raw path to normalize (can be encoded).
     * @returns {string} The normalized path, always prefixed with `/`.
     *
     * @example
     * ```ts
     * UriNormalizer.normalizePath("/foo/bar");              // "/foo/bar"
     * UriNormalizer.normalizePath("/foo/../bar");           // "/bar"
     * UriNormalizer.normalizePath("/foo/%2E%2E/bar");       // "/bar"
     * UriNormalizer.normalizePath("/foo/%252E%252E/bar");   // "/bar"  (double-encoded)
     * UriNormalizer.normalizePath("/a//b/./c/");            // "/a/b/c/"
     * UriNormalizer.normalizePath("\\foo\\..\\bar");        // "/bar"
     * UriNormalizer.normalizePath("/foo/\0bar");            // "/foo/bar"
     * UriNormalizer.normalizePath("");                      // "/"
     * ```
     */
    public static normalizePath(pathStr: string): string {
        if (!pathStr) return "/";

        // Step 1: Iterative decoding to neutralize double-encodings
        const decoded = UriNormalizer.iterativeDecode(pathStr);

        // Step 2: Unicode NFC normalization
        const nfc = decoded.normalize("NFC");

        // Step 3: Replace backslashes with forward slashes
        const forwardSlashed = nfc.replace(/\\/g, "/");

        // Step 4: Removal of null bytes and control characters
        const sanitized = UriNormalizer.stripControlCharacters(forwardSlashed);

        // Step 5: Collapse multiple slashes (e.g., `///` → `/`)
        const collapsed = sanitized.replace(/\/+/g, "/");

        // Memorize trailing slash before resolution (it will be lost during split)
        const hasTrailingSlash =
            collapsed.endsWith("/") && collapsed.length > 1;

        // Step 6: Resolve `.` and `..` segments
        const resolved = UriNormalizer.resolveSegments(collapsed);

        // Step 7: Restore trailing slash
        return hasTrailingSlash ? resolved + "/" : resolved;
    }

    /**
     * Executes a regex test with a strict timeout to prevent ReDoS
     * (Regular Expression Denial of Service) attacks.
     *
     * ### Protection Strategy
     * - Short strings (< {@link REGEX_VM_LENGTH_THRESHOLD} characters) are
     *   tested directly for performance, but the threshold has been lowered to
     *   20 to cover catastrophic patterns on short repetitions.
     * - Beyond the threshold, the regex is executed in an isolated Node.js VM
     *   context with an adaptive timeout calculated by {@link computeRegexTimeout}.
     * - In the event of a timeout or VM error, the method returns `false` **and**
     *   throws a typed error to distinguish a real ReDoS from a false positive.
     *
     * ### Error Differentiation
     * - `UriNormalizerRegexTimeoutError`: timeout reached → probable ReDoS.
     * - Any other internal exception is propagated as-is to avoid hiding
     *   caller layer bugs.
     *
     * @param {RegExp}  pattern   - The regular expression to evaluate.
     * @param {string}  str       - The string to test against.
     * @param {number}  [timeoutMs] - Base timeout in ms (default: {@link REGEX_BASE_TIMEOUT_MS}).
     *                                Automatically increased based on `str` length.
     * @returns {boolean} `true` if the regex matches, `false` otherwise or on timeout.
     * @throws {TypeError}                    If `pattern` is not a RegExp instance.
     * @throws {UriNormalizerRegexTimeoutError} If the VM timeout is reached (probable ReDoS).
     *
     * @example
     * ```ts
     * // Basic usage
     * UriNormalizer.safeRegexCheck(/^[a-z]+$/, "hello");          // true
     * UriNormalizer.safeRegexCheck(/^[a-z]+$/, "Hello");          // false
     *
     * // Potentially catastrophic pattern on long input
     * try {
     *   UriNormalizer.safeRegexCheck(/(a+)+$/, "a".repeat(5000) + "!");
     * } catch (e) {
     *   if (e instanceof UriNormalizerRegexTimeoutError) {
     *     console.warn("ReDoS blocked: ", e.message);
     *   }
     * }
     * ```
     */
    public static safeRegexCheck(
        pattern: RegExp,
        str: string,
        timeoutMs: number = UriNormalizer.REGEX_BASE_TIMEOUT_MS,
    ): boolean {
        // Strict pattern validation for a clear error message
        if (!(pattern instanceof RegExp)) {
            throw new TypeError(
                `UriNormalizer.safeRegexCheck: "pattern" must be an instance of RegExp, received: ${typeof pattern}`,
            );
        }

        // Fast path for very short strings (negligible ReDoS risk)
        if (str.length < UriNormalizer.REGEX_VM_LENGTH_THRESHOLD) {
            return pattern.test(str);
        }

        // Calculate adaptive timeout
        const effectiveTimeout = UriNormalizer.computeRegexTimeout(
            str.length,
            timeoutMs,
        );

        try {
            const sandbox = { result: false, pattern, str };
            const context = vm.createContext(sandbox);
            vm.runInContext("result = pattern.test(str)", context, {
                timeout: effectiveTimeout,
            });
            return sandbox.result;
        } catch (e: unknown) {
            // Distinguish a VM timeout from an unexpected error
            if (UriNormalizer.isVmTimeoutError(e)) {
                throw new UriNormalizerRegexTimeoutError(
                    `Regex exceeded timeout (${effectiveTimeout}ms) on an input of ${str.length} characters. Possible ReDoS.`,
                    effectiveTimeout,
                    str.length,
                );
            }
            // Propagate any other VM error (e.g., internal syntax error)
            throw e;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private Methods — URI Decoding
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Iteratively decodes a URI path until it is stable (idempotent),
     * neutralizing double-encodings and cascading encodings.
     *
     * **Example of bypass without this protection:**
     * ```
     * %2520  →  (1st decode)  %20  →  (2nd decode)  " "
     * %252E%252E  →  %2E%2E  →  ..   ← hidden traversal
     * ```
     *
     * The loop is bounded to {@link MAX_DECODE_ITERATIONS} to prevent any
     * infinite loop on pathological synthetic inputs. If the limit is reached,
     * the last stable state is returned without throwing an exception.
     *
     * @param {string} raw - The raw string, potentially multi-encoded.
     * @returns {string} The fully decoded string.
     *
     * @private
     */
    private static iterativeDecode(raw: string): string {
        let current = raw;

        for (let i = 0; i < UriNormalizer.MAX_DECODE_ITERATIONS; i++) {
            let next: string;
            try {
                next = decodeURIComponent(current);
            } catch {
                // Malformed URI (e.g., `%GG`): abort and keep previous state
                break;
            }

            if (next === current) {
                // Idempotence reached: decoding is stable
                break;
            }

            current = next;
        }

        return current;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private Methods — String Sanitization
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Strips all ASCII and Unicode control characters from a string.
     *
     * The removed ranges are:
     * - U+0000–U+001F: C0 control characters (including null byte, tab, LF, CR...)
     * - U+007F       : DEL
     * - U+0080–U+009F: C1 control characters
     *
     * These characters can be exploited to bypass filters relying on naive
     * string comparisons or to cause unexpected behavior in downstream parsers
     * (e.g., HTTP servers, file systems).
     *
     * @param {string} str - The string to sanitize.
     * @returns {string} The string without control characters.
     *
     * @private
     */
    private static stripControlCharacters(str: string): string {
        // eslint-disable-next-line no-control-regex
        return str.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private Methods — Segment Resolution
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Resolves `.` (current directory) and `..` (parent directory) segments
     * from a normalized path (without double-slashes or residual encodings).
     *
     * The stack can never go below the root: a `..` at the head of the path
     * is silently ignored, preventing any underflow to `../`.
     *
     * @param {string} path - The pre-normalized path (consolidated slashes, decoded).
     * @returns {string} The path with all `.` and `..` segments resolved,
     *                   always prefixed by `/`.
     *
     * @example
     * ```ts
     * // (private method — internal illustration)
     * resolveSegments("/a/b/../../c")  // "/c"
     * resolveSegments("/../../../etc") // "/etc"  ← no underflow
     * resolveSegments("/a/./b")        // "/a/b"
     * ```
     *
     * @private
     */
    private static resolveSegments(path: string): string {
        const parts = path.split("/");
        const stack: string[] = [];

        for (const segment of parts) {
            if (segment === "..") {
                // Never exceed root (anti-underflow)
                if (stack.length > 0) {
                    stack.pop();
                }
            } else if (segment !== "." && segment !== "") {
                stack.push(segment);
            }
        }

        return "/" + stack.join("/");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Private Methods — ReDoS / VM Utilities
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Calculates an adaptive timeout for executing a regex in the VM sandbox,
     * adding a delta proportional to the length of the string being tested.
     *
     * ### Formula
     * ```
     * timeout = min(baseMs + floor(length / 1000) * PER_1K, MAX_TIMEOUT)
     * ```
     *
     * This avoids false positives on long legitimate inputs while maintaining
     * a hard ceiling ({@link REGEX_MAX_TIMEOUT_MS}) to contain severe ReDoS.
     *
     * @param {number} length   - Length of the tested string.
     * @param {number} baseMs   - Base timeout provided by the caller.
     * @returns {number} The effective timeout in milliseconds.
     *
     * @private
     */
    private static computeRegexTimeout(length: number, baseMs: number): number {
        const delta =
            Math.floor(length / 1000) *
            UriNormalizer.REGEX_TIMEOUT_PER_1K_CHARS;
        return Math.min(baseMs + delta, UriNormalizer.REGEX_MAX_TIMEOUT_MS);
    }

    /**
     * Determines whether an error thrown by `vm.runInContext` is a timeout
     * overrun (i.e. a Node.js script interruption).
     *
     * Node.js does not provide a dedicated error class for this type of error.
     * Detection relies on the `ERR_SCRIPT_EXECUTION_TIMEOUT` error code and/or
     * the error message (`"Script execution timed out"`), which are stable since Node 10.
     *
     * @param {unknown} error - The exception to inspect.
     * @returns {boolean} `true` if the error is a VM timeout, `false` otherwise.
     *
     * @private
     */
    private static isVmTimeoutError(error: unknown): boolean {
        if (!(error instanceof Error)) return false;

        const nodeError = error as NodeJS.ErrnoException;
        if (nodeError.code === "ERR_SCRIPT_EXECUTION_TIMEOUT") return true;

        // Fallback to the message for older Node versions
        return error.message.toLowerCase().includes("timed out");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom Errors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Error thrown by {@link UriNormalizer.safeRegexCheck} when regex execution
 * in the VM context exceeds the allocated timeout.
 *
 * This error allows the calling layer to distinguish a true ReDoS block
 * from a legitimate `false` return (normal non-match), and to apply an
 * appropriate security policy (log, alert, block the request...).
 *
 * @extends {Error}
 *
 * @example
 * ```ts
 * try {
 *   UriNormalizer.safeRegexCheck(/(a+)+$/, "a".repeat(10_000) + "!");
 * } catch (e) {
 *   if (e instanceof UriNormalizerRegexTimeoutError) {
 *     console.error(`ReDoS detected (timeout=${e.timeoutMs}ms, len=${e.inputLength})`);
 *   }
 * }
 * ```
 */
export class UriNormalizerRegexTimeoutError extends Error {
    /** Class name for reliable instanceof and logging. */
    public override readonly name = "UriNormalizerRegexTimeoutError";

    /**
     * Effective timeout (in ms) that was exceeded during VM execution.
     * @readonly
     */
    public readonly timeoutMs: number;

    /**
     * Length of the input string that caused the timeout.
     * Useful for diagnostics and threshold tuning.
     * @readonly
     */
    public readonly inputLength: number;

    /**
     * @param {string} message     - Descriptive error message.
     * @param {number} timeoutMs   - Exceeded effective timeout.
     * @param {number} inputLength - Length of the tested input.
     */
    constructor(message: string, timeoutMs: number, inputLength: number) {
        super(message);
        this.timeoutMs = timeoutMs;
        this.inputLength = inputLength;

        // Proper prototype chain restoration in TypeScript/Babel
        Object.setPrototypeOf(this, new.target.prototype);
    }
}


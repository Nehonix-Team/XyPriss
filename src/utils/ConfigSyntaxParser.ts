/**
 * **Config Syntax Parser**
 *
 * Handles resolution of dynamic references in configuration files:
 * - `$(env).KEY`   / `&(env).KEY`   : Environment variables
 * - `$(pkg).path`  / `&(pkg).path`  : package.json properties (dot-notation)
 * - `$(this).KEY`  / `&(this).KEY`  : Properties from the currently parsed object
 * - `$(const).KEY` / `&(const).KEY` : Build-time constants injected at construction
 * - `$(date).FMT`  / `&(date).FMT`  : Current date/time helpers (ISO, YEAR, MONTH, DAY, TS)
 * - `$(file).path` / `&(file).path` : Synchronous file content (use for secrets, certs, etc.)
 */

import { getSysApi } from "../plugins/const/getSysApi";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnvProvider {
    has(key: string): boolean;
    get(key: string): string | undefined;
}

export interface ConfigSyntaxParserOptions {
    /** Absolute base directory used to resolve $(file) paths. Defaults to process.cwd(). */
    fileBasePath?: string;
    /** Maximum number of re-resolution passes (guards against infinite loops). Default: 20. */
    maxPasses?: number;
}

// Valid reference types — extend here when adding new syntax.
const VALID_TYPES = new Set(["env", "pkg", "this", "const", "date", "file"]);

// Date format tokens supported by $(date).TOKEN
const DATE_TOKENS: Record<string, () => string> = {
    ISO: () => new Date().toISOString(),
    YEAR: () => String(new Date().getFullYear()),
    MONTH: () => String(new Date().getMonth() + 1).padStart(2, "0"),
    DAY: () => String(new Date().getDate()).padStart(2, "0"),
    TS: () => String(Date.now()),
    TIME: () => new Date().toTimeString().split(" ")[0], // HH:MM:SS
};

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

export class ConfigSyntaxParser {
    private readonly fileBasePath: string;
    private readonly maxPasses: number;

    // LRU-style cache for getDeepValue on the same object reference
    private readonly deepValueCache = new WeakMap<
        object,
        Map<string, unknown>
    >();

    constructor(
        private readonly packageJson: unknown = null,
        private readonly envProvider: EnvProvider | null = null,
        private readonly constants: Record<string, string> = {},
        options: ConfigSyntaxParserOptions = {},
    ) {
        this.fileBasePath = options.fileBasePath ?? process.cwd();
        this.maxPasses = options.maxPasses ?? 20;
    }

    // -------------------------------------------------------------------------
    // Public API — signatures intentionally unchanged
    // -------------------------------------------------------------------------

    /**
     * Resolves all dynamic references in a configuration object or string.
     * Non-string/array/object values are returned as-is.
     */
    public resolve(obj: unknown, rootObj?: unknown): unknown {
        if (rootObj === undefined) rootObj = obj;

        if (typeof obj === "string") return this.resolveString(obj, rootObj);
        if (Array.isArray(obj))
            return obj.map((item) => this.resolve(item, rootObj));

        if (typeof obj === "object" && obj !== null) {
            const resolved: Record<string, unknown> = {};
            for (const key of Object.keys(obj as object)) {
                const resolvedKey = String(this.resolve(key, rootObj));
                resolved[resolvedKey] = this.resolve(
                    (obj as Record<string, unknown>)[key],
                    rootObj,
                );
            }
            return resolved;
        }

        return obj; // number, boolean, null, undefined — pass through untouched
    }

    // -------------------------------------------------------------------------
    // Core resolution
    // -------------------------------------------------------------------------

    /**
     * Resolves dynamic references in a string, supporting chained || fallbacks.
     */
    private resolveString(value: string, rootObj: unknown): string {
        // Matches: $(type).key  ||  $(type).key  ||  literal-fallback
        // Group 1 — prefix ($ or &)
        // Group 2 — type
        // Group 3 — key/path
        // Group 4 — remainder of the || chain
        const chainRegex =
            /([$&])\(([\w]+)\)\.([\w\d_./-]+)((?:\s*\|\|\s*(?:[$&]\((?:[\w]+)\)\.[\w\d_./-]+|[^|,]+))*)/g;

        let result = value;
        let passes = 0;

        while (passes++ < this.maxPasses) {
            const prev = result;

            // Reset regex before each pass (global flag keeps lastIndex)
            chainRegex.lastIndex = 0;

            result = result.replace(
                chainRegex,
                (_match, _prefix, type, key, chain) => {
                    const val = this.getValue(type, key, rootObj);
                    if (val !== undefined) return val;

                    if (chain) {
                        // Strip leading " || " and let the next pass handle it
                        return chain.replace(/^\s*\|\|\s*/, "");
                    }

                    throw new Error(this.buildMissingError(type, key));
                },
            );

            if (result === prev) break;
        }

        if (passes > this.maxPasses) {
            throw new Error(
                `ESYNC: Resolution did not stabilise after ${this.maxPasses} passes in "${value}". ` +
                    `Possible circular reference.`,
            );
        }

        this.validateSyntax(result);
        return result;
    }

    // -------------------------------------------------------------------------
    // Value retrieval
    // -------------------------------------------------------------------------

    /**
     * Dispatches value retrieval to the appropriate provider.
     */
    private getValue(
        type: string,
        key: string,
        rootObj: unknown,
    ): string | undefined {
        switch (type) {
            case "env":
                return this.getEnv(key);
            case "pkg":
                return this.getPkg(key);
            case "this":
                return this.getThis(key, rootObj);
            case "const":
                return this.getConst(key);
            case "date":
                return this.getDate(key);
            case "file":
                return this.getFile(key);
            default:
                return undefined; // validateSyntax will catch this
        }
    }

    private getEnv(key: string): string | undefined {
        return this.envProvider?.has(key)
            ? this.envProvider.get(key)
            : undefined;
    }

    private getPkg(key: string): string | undefined {
        if (!this.packageJson) return undefined;
        const val = this.getDeepValue(this.packageJson as object, key);
        return val !== undefined ? String(val) : undefined;
    }

    private getThis(key: string, rootObj: unknown): string | undefined {
        if (rootObj === null || typeof rootObj !== "object") return undefined;
        const val = this.getDeepValue(rootObj as object, key);
        return val !== undefined ? String(val) : undefined;
    }

    private getConst(key: string): string | undefined {
        return Object.prototype.hasOwnProperty.call(this.constants, key)
            ? this.constants[key]
            : undefined;
    }

    private getDate(token: string): string | undefined {
        const upper = token.toUpperCase();
        return DATE_TOKENS[upper]?.();
        // Unknown date tokens fall through to the error handler
    }

    private getFile(filePath: string): string | undefined {
        try {
            const sys = getSysApi();
            const resolved = sys.path.isAbsolute(filePath)
                ? filePath
                : sys.path.resolve(this.fileBasePath, filePath);
            return sys.fs.readFileSync(resolved, "utf8").trim();
        } catch {
            return undefined; // triggers fallback chain or missing-key error
        }
    }

    // -------------------------------------------------------------------------
    // Deep value with caching
    // -------------------------------------------------------------------------

    /**
     * Retrieves a value from a nested object using dot notation.
     * Results are cached per object reference to avoid repeated traversal.
     */
    private getDeepValue(obj: object, path: string): unknown {
        // Check cache
        let pathMap = this.deepValueCache.get(obj);
        if (pathMap?.has(path)) return pathMap.get(path);

        const parts = path.split(".");
        let current: unknown = obj;

        for (const part of parts) {
            if (current === null || typeof current !== "object") {
                current = undefined;
                break;
            }
            current = (current as Record<string, unknown>)[part];
        }

        // Store in cache
        if (!pathMap) {
            pathMap = new Map();
            this.deepValueCache.set(obj, pathMap);
        }
        pathMap.set(path, current);

        return current;
    }

    // -------------------------------------------------------------------------
    // Validation
    // -------------------------------------------------------------------------

    /**
     * Validates that no unresolved or malformed markers remain in the string.
     */
    private validateSyntax(value: string): void {
        if (!/[$&]\(/.test(value)) return;

        const malformedRegex = /([$&])\(([^)]*)\)(\.?)([\w\d_./-]*)/g;
        let match: RegExpExecArray | null;

        while ((match = malformedRegex.exec(value)) !== null) {
            const [full, _prefix, type, dot, key] = match;

            if (!VALID_TYPES.has(type)) {
                throw new Error(
                    `ESYNC: Invalid reference type "(${type})" in "${full}". ` +
                        `Valid types: ${[...VALID_TYPES].join(", ")}. ` +
                        `See https://github.com/Nehonix-Team/XyPriss/blob/master/docs/config/configuration.md`,
                );
            }
            if (dot !== ".") {
                throw new Error(
                    `ESYNC: Malformed syntax "${full}". Missing dot separator after type (e.g., $(env).KEY).`,
                );
            }
            if (!key) {
                throw new Error(
                    `ESYNC: Malformed syntax "${full}". Missing key or property path.`,
                );
            }
        }

        // Catch-all
        throw new Error(
            `ESYNC: Invalid or malformed injection syntax detected in "${value}".`,
        );
    }

    // -------------------------------------------------------------------------
    // Error formatting
    // -------------------------------------------------------------------------

    private buildMissingError(type: string, key: string): string {
        const descriptions: Record<string, string> = {
            env: `Environment variable "${key}"`,
            pkg: `Property "${key}" in package.json`,
            this: `Property "${key}" in current object`,
            const: `Constant "${key}"`,
            date: `Date token "${key}" (valid: ${Object.keys(DATE_TOKENS).join(", ")})`,
            file: `File "${key}"`,
        };
        const desc = descriptions[type] ?? `Reference "${key}" (type: ${type})`;
        return `EDYNC: ${desc} not found or could not be resolved.`;
    }
}


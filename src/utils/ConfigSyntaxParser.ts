/**
 * **Config Syntax Parser**
 * 
 * Handles resolution of dynamic references in configuration files:
 * - `$(env).KEY` / `&(env).KEY` : Environment variables
 * - `$(pkg).path` / `&(pkg).path` : package.json properties
 */
export class ConfigSyntaxParser {
    constructor(
        private readonly packageJson: any = null,
        private readonly envProvider: { has(key: string): boolean; get(key: string): string | undefined } | null = null
    ) {}

    /**
     * Resolves all dynamic references in a configuration object or string.
     */
    public resolve(obj: any): any {
        if (typeof obj === "string") {
            return this.resolveString(obj);
        } else if (Array.isArray(obj)) {
            return obj.map((item) => this.resolve(item));
        } else if (typeof obj === "object" && obj !== null) {
            const resolved: any = {};
            for (const key in obj) {
                const resolvedKey = this.resolve(key);
                resolved[resolvedKey] = this.resolve(obj[key]);
            }
            return resolved;
        }
        return obj;
    }

    /**
     * Resolves dynamic references in a string.
     */
    private resolveString(value: string): string {
        let result = value;

        // Regex for a reference followed by an optional chain of || fallbacks
        // Group 1: prefix ($ or &)
        // Group 2: type (env or pkg)
        // Group 3: key/path
        // Group 4: the rest of the chain (e.g. " || $(env).B || default")
        const chainRegex =
            /([\$\&])\((env|pkg)\)\.([\w\d_.-]+)((?:\s*\|\|\s*(?:[\$\&]\((?:env|pkg)\)\.[\w\d_.-]+|[^|,]+))*)/g;

        while (true) {
            const lastResult = result;

            result = result.replace(
                chainRegex,
                (_match, _prefix, type, key, chain) => {
                    const val = this.getValue(type, key);
                    if (val !== undefined) return val;

                    if (chain) {
                        // Remove leading " || " and return the rest for next pass
                        return chain.replace(/^\s*\|\|\s*/, "");
                    }

                    throw new Error(
                        `EDYNC: ${
                            type === "env"
                                ? 'Environment variable'
                                : 'Property'
                        } "${key}" not found${
                            type === "pkg" ? " in package.json" : ""
                        }`,
                    );
                },
            );

            if (result === lastResult) break;
        }

        // Validate that no malformed or unresolved references remain
        this.validateSyntax(result);

        return result;
    }

    /**
     * Validates that no unresolved or malformed markers remain in the string.
     */
    private validateSyntax(value: string): void {
        const marker = /[\$\&]\(/;
        if (!marker.test(value)) return;

        // Try to identify the specific malformed part
        const malformedRegex = /([\$\&])\(([^)]*)\)(\.?)([\w\d_.-]*)/g;
        let match;

        // Reset regex state for global search
        malformedRegex.lastIndex = 0;
        match = malformedRegex.exec(value);

        if (match) {
            const [full, _prefix, type, dot, key] = match;

            if (type !== "env" && type !== "pkg") {
                throw new Error(
                    `ESYNC: Invalid reference type "(${type})" in "${full}". Supported types are (env) and (pkg).`,
                );
            }
            if (dot !== ".") {
                throw new Error(
                    `ESYNC: Malformed syntax "${full}". Missing dot separator after type (e.g., $(env).KEY).`,
                );
            }
            if (!key) {
                throw new Error(
                    `ESYNC: Malformed syntax "${full}". Missing key or property path in "${full}".`,
                );
            }
        }

        // Catch-all for other malformed markers
        throw new Error(
            `ESYNC: Invalid or malformed injection syntax detected in "${value}"`,
        );
    }

    /**
     * Unifies value retrieval for env and pkg.
     */
    private getValue(type: string, key: string): string | undefined {
        if (type === "env") {
            return this.envProvider?.has(key)
                ? this.envProvider.get(key)
                : undefined;
        } else {
            const val = this.packageJson
                ? this.getDeepValue(this.packageJson, key)
                : undefined;
            return val !== undefined ? String(val) : undefined;
        }
    }

    /**
     * Retrieves a value from a nested object using dot notation.
     */
    private getDeepValue(obj: any, path: string): any {
        if (!obj) return undefined;
        const parts = path.split(".");
        let current = obj;
        for (const part of parts) {
            if (current === null || typeof current !== "object") return undefined;
            current = current[part];
        }
        return current;
    }
}

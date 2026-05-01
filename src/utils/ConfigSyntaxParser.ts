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
        let resolved = value;

        // 1. Resolve $(env).KEY or &(env).KEY (with optional || fallback)
        resolved = resolved.replace(
            /([\$\&])\(env\)\.([\w\d_.-]+)(?:\s*\|\|\s*([^)]+))?/g,
            (match, _prefix, key, fallback) => {
                const env = this.envProvider;
                if (!env) return fallback !== undefined ? fallback.trim() : match;

                if (!env.has(key)) {
                    if (fallback !== undefined) {
                        return fallback.trim();
                    }
                    throw new Error(
                        `EDYNC: Environment variable "${key}" not found`,
                    );
                }
                return env.get(key)!;
            },
        );

        // 2. Resolve $(pkg).path or &(pkg).path (with optional || fallback)
        resolved = resolved.replace(
            /([\$\&])\(pkg\)\.([\w\d_.-]+)(?:\s*\|\|\s*([^)]+))?/g,
            (_match, _prefix, propPath, fallback) => {
                if (!this.packageJson)
                    return fallback !== undefined ? fallback.trim() : _match;

                const val = this.getDeepValue(this.packageJson, propPath);
                if (val === undefined) {
                    if (fallback !== undefined) {
                        return fallback.trim();
                    }
                    throw new Error(
                        `EDYNC: Property "${propPath}" not found in package.json`,
                    );
                }
                return String(val);
            },
        );

        return resolved;
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

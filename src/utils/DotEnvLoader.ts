import fs from "fs";
import path from "path";

/**
 * **DotEnvLoader**
 *
 * A lightweight, zero-dependency .env file parser and loader.
 * Inspired by the standard dotenv logic but built specifically for XyPriss.
 */
export class DotEnvLoader {
    private static readonly LINE =
        /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;

    /**
     * Parses a string or buffer containing .env file content.
     * @param src Content of the .env file.
     * @returns Object with key-value pairs.
     */
    public static parse(src: string | Buffer): Record<string, string> {
        const obj: Record<string, string> = {};
        let content = src.toString();
        content = content.replace(/\r\n?/gm, "\n");

        let match;
        // Reset lastIndex for the global regex
        this.LINE.lastIndex = 0;

        while ((match = this.LINE.exec(content)) !== null) {
            const key = match[1];
            let value = (match[2] || "").trim();

            // Handle quoted values
            const maybeQuote = value[0];
            value = value.replace(/^(['"`])([\s\S]*)\1$/gm, "$2");

            // Handle escaped characters in double quotes
            if (maybeQuote === '"') {
                value = value.replace(/\\n/g, "\n");
                value = value.replace(/\\r/g, "\r");
            }

            obj[key] = value;
        }

        return obj;
    }

    /**
     * Loads .env files into an object (usually process.env).
     * @param options Configuration for loading.
     * @returns The parsed object.
     */
    public static load(
        options: { path?: string | string[]; override?: boolean } = {},
    ): Record<string, string> {
        const paths = Array.isArray(options.path)
            ? options.path
            : [options.path || path.resolve(process.cwd(), ".env")];

        const override = options.override ?? false;
        const parsedAll: Record<string, string> = {};

        for (const envPath of paths) {
            try {
                if (fs.existsSync(envPath)) {
                    const content = fs.readFileSync(envPath);
                    const parsed = this.parse(content);

                    for (const [key, value] of Object.entries(parsed)) {
                        if (override || process.env[key] === undefined) {
                            process.env[key] = value;
                        }
                        parsedAll[key] = value;
                    }
                }
            } catch (err) {
                // Silently ignore or log if debug is enabled
            }
        }

        return parsedAll;
    }
}


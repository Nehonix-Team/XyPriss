/**
 * JSON Utility Library
 *
 * Implements robust comment stripping and safe parsing for JSONC/JSON configuration files.
 */
export class JsonUtils {
    /**
     * Strip single-line (//) and multi-line (/*) comments from a string content,
     * while retaining strings and resolving trailing commas for JSON-compatibility.
     *
     * @param content - Raw JSONC content.
     * @returns Sanitized standard JSON string.
     */
    public static stripComments(content: string): string {
        const noComments = content.replace(
            /("(?:[^"\\]|\\.)*")|\/\/.*|\/\*[\s\S]*?\*\//g,
            (match, group1) => (group1 ? group1 : ""),
        );
        return noComments.replace(
            /("(?:[^"\\]|\\.)*")|,\s*([}\]])/g,
            (match, group1, group2) => (group1 ? group1 : group2),
        );
    }

    /**
     * Safely parse comments-enabled JSONC strings into JavaScript objects.
     *
     * @param content - Raw JSONC string.
     * @returns Parsed object.
     */
    public static parse<T = any>(content: string): T {
        const clean = this.stripComments(content);
        return JSON.parse(clean);
    }
}

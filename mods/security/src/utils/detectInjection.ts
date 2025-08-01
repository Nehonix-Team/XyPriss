import { sqlPatterns, xssPatterns } from "./patterns";

/**
 *  Function to test input against all patterns
 *  @example
 *  const testInput = "'; DROP TABLE users; --";
    const result = detectInjection(testInput);
    console.log(result);
    // Output: { sql: true, xss: false, type: 'sql', matches: [...] }
 */

function detectInjection(input: string, patternType = "all") {
    const results: {
        sql: boolean;
        xss: boolean;
        type: "sql" | "xss" | "mixed" | null;
        matches: {
            type: string;
            pattern: string;
            match: RegExpMatchArray | null;
        }[];
    } = {
        sql: false,
        xss: false,
        type: null,
        matches: [],
    };

    if (patternType === "all" || patternType === "sql") {
        for (const pattern of sqlPatterns) {
            if (pattern.test(input)) {
                results.sql = true;
                results.type = "sql";
                results.matches.push({
                    type: "SQL",
                    pattern: pattern.toString(),
                    match: input.match(pattern),
                });
            }
        }
    }

    if (patternType === "all" || patternType === "xss") {
        for (const pattern of xssPatterns) {
            if (pattern.test(input)) {
                results.xss = true;
                results.type = results.type ? "mixed" : "xss";
                results.matches.push({
                    type: "XSS",
                    pattern: pattern.toString(),
                    match: input.match(pattern),
                });
            }
        }
    }

    return results;
}

export { detectInjection };

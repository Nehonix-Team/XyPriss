/**
 * Optimized XSS and SQL Injection Detection Patterns
 *
 * This module provides optimized regular expressions and patterns for detecting
 * various security vulnerabilities in user input. Designed for production use
 * with reduced false positives and improved performance.
 *
 * @author Seth Eleazar
 * @version 2.0.0
 * @since 1.0.0
 */

/**
 * SQL Injection Detection Patterns
 *
 * Optimized patterns for detecting SQL injection attempts with reduced false positives.
 * These patterns focus on high-confidence indicators while minimizing impact on
 * legitimate input containing SQL-like keywords.
 *
 * @type {RegExp[]}
 * @example
 * ```typescript
 * const userInput = "1' OR '1'='1";
 * const isSqlInjection = sqlPatterns.some(pattern => pattern.test(userInput));
 * ```
 */
const sqlPatterns: RegExp[] = [
    // High-confidence SQL injection patterns
    // Union-based injection (most common attack vector)
    /\bUNION\s+(ALL\s+)?SELECT\b/i,

    // Boolean-based blind injection
    /\b(OR|AND)\s+['"]?\w*['"]?\s*[=<>!]+\s*['"]?\w*['"]?\s*(--|\#|\/\*)/i,
    /\b(OR|AND)\s+\d+\s*[=<>!]+\s*\d+\s*(--|\#|\/\*)/i,
    /\b(OR|AND)\s+['"][^'"]*['"]\s*[=<>!]+\s*['"][^'"]*['"](\s|$)/i,

    // Time-based blind injection
    /\b(SLEEP|WAITFOR\s+DELAY|BENCHMARK|PG_SLEEP)\s*\(/i,

    // Stacked queries (semicolon followed by SQL keywords)
    /;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b/i,

    // Information disclosure patterns
    /\b(INFORMATION_SCHEMA|SYSOBJECTS|SYSCOLUMNS|MSYSOBJECTS)\.\w+/i,
    /\b@@(VERSION|USER|SERVERNAME|DATABASE)\b/i,
    /\b(VERSION|USER|DATABASE|SCHEMA)\s*\(\s*\)/i,

    // Advanced injection techniques
    /\b(INTO\s+(OUTFILE|DUMPFILE)|LOAD_FILE|xp_cmdshell|sp_executesql)\b/i,

    // SQL comments in suspicious contexts
    /['"].*?(--|\/\*|\#)/,

    // Hex-encoded strings (common in SQLi)
    /0x[0-9A-Fa-f]{6,}/,

    // Error-based injection patterns
    /\b(EXTRACTVALUE|UPDATEXML|GEOMETRYCOLLECTION)\s*\(/i,

    // Blind injection with conditional responses
    /\bEXISTS\s*\(\s*SELECT.*?\bFROM\b/i,
];

/**
 * Cross-Site Scripting (XSS) Detection Patterns
 *
 * Optimized patterns for detecting XSS attempts with focus on executable content
 * and common bypass techniques. Reduced false positives for legitimate HTML/JavaScript.
 *
 * @type {RegExp[]}
 * @example
 * ```typescript
 * const userInput = "<script>alert('xss')</script>";
 * const isXSS = xssPatterns.some(pattern => pattern.test(userInput));
 * ```
 */
const xssPatterns: RegExp[] = [
    // Script injection patterns
    /<script[^>]*>.*?<\/script>/gi,
    /<script[^>]*(?:src\s*=|>)/gi,

    // JavaScript protocol (high confidence)
    /javascript\s*:\s*(?!void\(0\))/gi,

    // Event handlers with suspicious content
    /\bon\w+\s*=\s*["'][^"']*(?:javascript|eval|alert|prompt|confirm|document|window)/gi,

    // Dangerous HTML tags
    /<(iframe|object|embed|applet|form)\b[^>]*>/gi,
    /<link[^>]*href\s*=\s*["']?javascript:/gi,

    // JavaScript execution functions
    /\b(eval|setTimeout|setInterval|Function|execScript)\s*\(\s*["'][^"']*["']/gi,

    // CSS-based attacks
    /expression\s*\(|behavior\s*:|@import.*javascript/gi,

    // Data URIs with executable content
    /data\s*:\s*(?:text\/html|application\/javascript|text\/javascript)/gi,

    // VBScript injection
    /vbscript\s*:/gi,

    // DOM manipulation with user content
    /(?:innerHTML|outerHTML|insertAdjacentHTML)\s*=.*?["'][^"']*<(?:script|iframe|object)/gi,

    // SVG-based XSS
    /<svg[^>]*>.*?<(?:script|foreignObject|use)/gi,

    // Template injection patterns
    /\{\{.*?(?:constructor|__proto__|eval|window|document)/gi,
    /\$\{.*?(?:eval|window|document|process)/gi,

    // Angular/React specific
    /ng-[a-z-]+\s*=.*?["'][^"']*(?:javascript|eval)/gi,
    /dangerouslySetInnerHTML.*?["'][^"']*<script/gi,

    // Encoded script patterns
    /(?:%3C|&lt;)script.*?(?:%3E|&gt;)/gi,
    /&#(?:x3c|60);script/gi,

    // Base64 encoded scripts
    /data:text\/html;base64,.*?(?:PHNjcmlwdA|c2NyaXB0|SCRIPT)/gi,
];

/**
 * Context-specific injection patterns
 *
 * Patterns for detecting injection attacks in specific contexts like LDAP, XML, etc.
 * Each context has patterns tailored to the specific attack vectors.
 *
 * @type {Record<string, RegExp[]>}
 */
const contexts: Record<string, RegExp[]> = {
    /**
     * LDAP Injection Detection Patterns
     * Detects attempts to manipulate LDAP queries
     */
    ldap: [
        /[\(\)\|\&\*](?![a-zA-Z0-9\s])/, // LDAP special chars not in normal context
        /\*(?=\)|\||&)/, // Wildcards in suspicious positions
        /\(\|.*?\)/, // OR conditions
        /\(&.*?\)/, // AND conditions
    ],

    /**
     * XML Injection Detection Patterns
     * Detects XML-based attacks including XXE
     */
    xml: [
        /<!(?:DOCTYPE|ENTITY).*?(?:SYSTEM|PUBLIC)/gi,
        /<!\[CDATA\[.*?(?:<script|javascript)/gi,
        /<\?xml.*?encoding\s*=\s*["'][^"']*(?:utf-7|utf7)/gi,
    ],

    /**
     * Command Injection Detection Patterns
     * Detects OS command injection attempts
     */
    command: [
        /[;&|`$()](?:\s*(?:cat|ls|pwd|whoami|id|uname|wget|curl|nc|sh|bash|cmd|powershell|rm|del)\b)/i,
        /\.\.[\/\\].*?[\/\\]/, // Path traversal with depth
        /~[\/\\]\.{2,}/, // Home directory traversal
        /\$\(.*?\)/, // Command substitution
        /`.*?`/, // Backtick execution
    ],

    /**
     * Path Traversal Detection Patterns
     * Detects directory traversal attempts
     */
    pathTraversal: [
        /(?:\.{2}[\/\\]){2,}/, // Multiple directory traversals
        /[\/\\]\.{2}[\/\\].*?(?:etc|windows|system32)/i,
        /\.{2}[\/\\].*?\.(?:conf|ini|log|txt)$/i,
    ],

    /**
     * NoSQL Injection Detection Patterns
     * Detects MongoDB and other NoSQL injection attempts
     */
    nosql: [
        /\$(?:where|ne|gt|lt|gte|lte|in|nin|regex|or|and|not)\b/gi,
        /\{\s*\$(?:where|regex)\s*:/gi,
        /this\.\w+.*?(?:==|!=|>|<)/gi, // JavaScript in $where
    ],
};

/**
 * Common weak passwords list
 *
 * Curated list of commonly used passwords for validation.
 * Includes most frequent passwords from security breaches and common patterns.
 *
 * @type {string[]}
 * @readonly
 */
const commonPassword: readonly string[] = [
    // Top 25 most common passwords
    "password",
    "123456",
    "password123",
    "admin",
    "qwerty",
    "letmein",
    "welcome",
    "monkey",
    "1234567890",
    "abc123",
    "111111",
    "dragon",
    "master",
    "696969",
    "mustang",
    "123123",
    "batman",
    "trustno1",
    "hunter",
    "2000",
    "test",
    "superman",
    "1234",
    "soccer",
    "harley",

    // Common variations
    "password1",
    "password12",
    "qwerty123",
    "admin123",
    "root",
    "toor",
    "administrator",
    "guest",
    "user",
    "demo",

    // Keyboard patterns
    "qwertyui",
    "asdfgh",
    "zxcvbn",
    "123qwe",
    "qwe123",

    // Common substitutions
    "p@ssw0rd",
    "passw0rd",
    "p4ssw0rd",
    "pa55w0rd",
    "adm1n",

    // Seasonal/contextual
    "winter2023",
    "summer2023",
    "christmas",
    "welcome123",

    // Company/generic terms
    "company",
    "office",
    "login",
    "changeme",
    "default",
] as const;

/**
 * Keyboard pattern detection expressions
 *
 * Patterns to detect common keyboard sequences and weak password patterns.
 * Useful for password strength validation.
 *
 * @type {RegExp[]}
 */
const keyboardPatterns: RegExp[] = [
    // QWERTY row patterns (4+ consecutive chars)
    /(?:qwert|werty|ertyu|rtyui|tyuio|yuiop|asdfg|sdfgh|dfghj|fghjk|ghjkl|zxcvb|xcvbn|cvbnm){4,}/i,

    // Number sequences (4+ consecutive)
    /(?:1234|2345|3456|4567|5678|6789|0123|9876|8765|7654|6543|5432|4321|3210){4,}/,

    // Alphabet sequences (4+ consecutive)
    /(?:abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz){4,}/i,

    // Repeated characters (3+ same char)
    /(.)\1{2,}/,

    // Date patterns that are too obvious
    /(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])/,
    /(?:0[1-9]|1[0-2])[-\/](?:0[1-9]|[12]\d|3[01])[-\/](?:19|20)?\d{2}/,

    // Phone number patterns
    /\d{3}[-.]?\d{3}[-.]?\d{4}/,

    // Common leet speak substitutions (when too obvious)
    /(?:p@ssw0rd|adm1n|h@ck3r|l33t|3lit3|pwn3d){4,}/i,
];

/**
 * Validates input against SQL injection patterns
 *
 * @param input - The input string to validate
 * @returns True if potential SQL injection is detected
 * @example
 * ```typescript
 * if (detectSQLInjection(userInput)) {
 *   throw new Error('Potential SQL injection detected');
 * }
 * ```
 */
export const detectSQLInjection = (input: string): boolean => {
    if (!input || typeof input !== "string") return false;
    return sqlPatterns.some((pattern) => pattern.test(input));
};

/**
 * Validates input against XSS patterns
 *
 * @param input - The input string to validate
 * @returns True if potential XSS is detected
 * @example
 * ```typescript
 * if (detectXSS(userInput)) {
 *   // Sanitize or reject input
 * }
 * ```
 */
export const detectXSS = (input: string): boolean => {
    if (!input || typeof input !== "string") return false;
    return xssPatterns.some((pattern) => pattern.test(input));
};

/**
 * Validates input against context-specific injection patterns
 *
 * @param input - The input string to validate
 * @param contextType - The context type to check against
 * @returns True if potential injection is detected for the given context
 * @example
 * ```typescript
 * if (detectContextInjection(ldapQuery, 'ldap')) {
 *   throw new Error('Potential LDAP injection detected');
 * }
 * ```
 */
export const detectContextInjection = (
    input: string,
    contextType: keyof typeof contexts
): boolean => {
    if (!input || typeof input !== "string" || !contexts[contextType])
        return false;
    return contexts[contextType].some((pattern) => pattern.test(input));
};

/**
 * Checks if a password is in the common passwords list
 *
 * @param password - The password to check
 * @returns True if the password is commonly used
 * @example
 * ```typescript
 * if (isCommonPassword(userPassword)) {
 *   return { error: 'Please choose a stronger password' };
 * }
 * ```
 */
export const isCommonPassword = (password: string): boolean => {
    if (!password || typeof password !== "string") return false;
    return commonPassword.includes(password.toLowerCase());
};

/**
 * Detects keyboard patterns in passwords
 *
 * @param password - The password to analyze
 * @returns True if keyboard patterns are detected
 * @example
 * ```typescript
 * if (hasKeyboardPattern(userPassword)) {
 *   // Suggest stronger password
 * }
 * ```
 */
export const hasKeyboardPattern = (password: string): boolean => {
    if (!password || typeof password !== "string") return false;
    return keyboardPatterns.some((pattern) => pattern.test(password));
};

// Export original arrays for backward compatibility
export { sqlPatterns, xssPatterns, contexts, commonPassword, keyboardPatterns };

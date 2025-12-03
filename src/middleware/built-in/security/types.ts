/**
 * Common types for security modules
 */

export interface SecurityDetectionResult {
    isMalicious: boolean;
    confidence: number;
    detectedPatterns: string[];
    sanitizedInput?: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    metadata?: Record<string, any>;
}

export interface SecurityModuleConfig {
    enabled?: boolean;
    strictMode?: boolean;
    logAttempts?: boolean;
    blockOnDetection?: boolean;
    falsePositiveThreshold?: number;
    customPatterns?: RegExp[];
}

export interface ContextInfo {
    fieldName?: string;
    fieldType?: string;
    userRole?: string;
    ipAddress?: string;
    userAgent?: string;
    requestPath?: string;
}

export interface RequestSignatureConfig {
    /** The secret value that must match the XP-Request-Sig header */
    secret: string;

    /** Custom error message for blocked requests */
    errorMessage?: string;

    /** HTTP status code for blocked requests */
    statusCode?: number;

    /** Enable debug logging */
    debug?: boolean;

    /** Case-sensitive comparison (default: true) */
    caseSensitive?: boolean;

    /** Trim whitespace from header value (default: true) */
    trimValue?: boolean;

    /** Maximum allowed header length to prevent DoS (default: 512) */
    maxHeaderLength?: number;

    /** Rate limiting: max failed attempts before temporary block (default: 5) */
    maxFailedAttempts?: number;

    /** Rate limiting: block duration in milliseconds (default: 15 minutes) */
    blockDuration?: number;

    /** Disable rate limiting entirely (default: false) */
    disableRateLimiting?: boolean;

    /** Scale factor for rate limiting thresholds (default: 1.0) */
    rateLimitScaleFactor?: number;

    /** Minimum secret length requirement (default: 32) */
    minSecretLength?: number;

    /** Enable timing attack protection (default: true) */
    timingSafeComparison?: boolean;

    /** Reject requests with suspicious patterns (default: true) */
    rejectSuspiciousPatterns?: boolean;
}

export interface FailedAttempt {
    count: number;
    blockedUntil: number | null;
    lastAttempt: number;
}

/**
 * Browser-Only Protection Configuration
 *
 * Blocks non-browser requests (cURL, Postman, scripts) while allowing legitimate browser access.
 * Useful for APIs that should only be accessed through web browsers.
 *
 * @example Enable with defaults:
 * ```typescript
 * browserOnly: true
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * browserOnly: {
 *   requireSecFetch: true,
 *   blockAutomationTools: true,
 *   allowOriginRequests: true,
 *   errorMessage: "Browser access required"
 * }
 * ```
 */

export interface BrowserOnlyConfig {
    /** Enable browser-only protection (default: true when config provided) */
    enable?: boolean;

    /** Block requests without Sec-Fetch headers */
    requireSecFetch?: boolean;

    /** Block requests with curl/wget user agents */
    blockAutomationTools?: boolean;

    /** Require complex Accept header */
    requireComplexAccept?: boolean;

    /** Allow requests with Origin header (CORS) */
    allowOriginRequests?: boolean;

    /** Custom error message */
    errorMessage?: string;

    /** HTTP status code for blocked requests */
    statusCode?: number;

    /** Custom validation function */
    customValidator?: (req: any) => boolean;

    /** Enable debug logging */
    debug?: boolean;
}

/**
 * Terminal-Only Protection Configuration
 *
 * Blocks browser requests while allowing terminal/API tools.
 * Perfect for API-only endpoints or development tools.
 *
 * @example Enable with defaults:
 * ```typescript
 * terminalOnly: true
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * terminalOnly: {
 *   blockSecFetch: true,
 *   allowedTools: ["curl", "wget"],
 *   blockBrowserIndicators: true,
 *   debug: true
 * }
 * ```
 */
export interface TerminalOnlyConfig {
    /** Enable terminal-only protection (default: true when config provided) */
    enable?: boolean;

    /** Block requests with Sec-Fetch headers (browsers) */
    blockSecFetch?: boolean;
    /** Allow specific automation tools (whitelist approach) */
    allowedTools?: string[];
    /** Block requests with complex browser headers */
    blockBrowserIndicators?: boolean;
    /** Require simple Accept header */
    requireSimpleAccept?: boolean;
    /** Custom error message */
    errorMessage?: string;
    /** HTTP status code for blocked requests */
    statusCode?: number;
    /** Custom validation function */
    customValidator?: (req: any) => boolean;
    /** Enable debug logging */
    debug?: boolean;
}


/**
 * Wildcard pattern matching utility for CORS origins
 *
 * Supports patterns like:
 * - "localhost:*" matches "localhost:3000", "localhost:8080", etc.
 * - "*.example.com" matches "api.example.com", "app.example.com", etc.
 * - "127.0.0.1:*" matches "127.0.0.1:3000", "127.0.0.1:8080", etc.
 * - "::1:*" matches "::1:3000", "::1:8080", etc.
 */

/**
 * Validates if a string is a valid pattern
 */
function isValidPattern(pattern: string): boolean {
    if (typeof pattern !== "string" || pattern.trim().length === 0) {
        return false;
    }

    // Check for invalid wildcard usage (e.g., multiple consecutive wildcards)
    if (pattern.includes("**")) {
        return false;
    }

    return true;
}

/**
 * Normalizes a host string by trimming and converting to lowercase
 */
function normalizeHost(host: string): string {
    return host.trim().toLowerCase();
}

/**
 * Extracts the default port for a given protocol
 */
function getDefaultPort(protocol: string): string | null {
    const protocolMap: Record<string, string> = {
        "http:": "80",
        "https:": "443",
        "ws:": "80",
        "wss:": "443",
    };

    return protocolMap[protocol] || null;
}

/**
 * Checks if a string is a valid IPv6 address
 */
function isIPv6(hostname: string): boolean {
    // Basic IPv6 validation - contains colons and valid hex characters
    return hostname.includes(":") && /^[0-9a-f:]+$/i.test(hostname);
}

/**
 * Extracts host:port from an IPv6 URL
 */
function extractIPv6Host(url: URL): string {
    let hostname = url.hostname;

    // Remove brackets if present
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
        hostname = hostname.slice(1, -1);
    }

    return url.port ? `${hostname}:${url.port}` : hostname;
}

/**
 * Extracts host from a URL with special handling for default ports
 */
function extractHostFromURL(urlString: string): string | null {
    try {
        const url = new URL(urlString);

        // Handle IPv6 addresses
        if (url.hostname.startsWith("[") || isIPv6(url.hostname)) {
            return extractIPv6Host(url);
        }

        // Use url.host which includes port, or add default port if missing
        if (url.port) {
            return normalizeHost(url.host);
        }

        // Add default port for localhost when port is implicit
        const defaultPort = getDefaultPort(url.protocol);
        if (defaultPort && url.hostname === "localhost") {
            return normalizeHost(`${url.hostname}:${defaultPort}`);
        }

        return normalizeHost(url.host);
    } catch (error) {
        return null;
    }
}

/**
 * Sanitizes a pattern by escaping special regex characters
 */
function escapeRegexSpecialChars(str: string): string {
    return str.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Converts a wildcard pattern to a regular expression
 * @param pattern - The wildcard pattern (e.g., "localhost:*", "*.example.com")
 * @returns RegExp object for matching
 */
function patternToRegex(pattern: string): RegExp {
    if (!isValidPattern(pattern)) {
        throw new Error(`Invalid pattern: ${pattern}`);
    }

    const normalizedPattern = normalizeHost(pattern);

    // Escape special regex characters except for *
    const escaped = escapeRegexSpecialChars(normalizedPattern).replace(
        /\\\*/g,
        ".*"
    ); // Replace escaped \* with .*

    // Ensure exact match with ^ and $
    return new RegExp(`^${escaped}$`, "i");
}

/**
 * Checks if an origin matches a wildcard pattern
 * @param origin - The origin to check (e.g., "http://localhost:3000")
 * @param pattern - The wildcard pattern (e.g., "localhost:*")
 * @returns true if the origin matches the pattern
 */
export function matchesWildcardPattern(
    origin: string,
    pattern: string
): boolean {
    // Validate inputs
    if (!origin || typeof origin !== "string" || origin.trim().length === 0) {
        return false;
    }

    if (
        !pattern ||
        typeof pattern !== "string" ||
        pattern.trim().length === 0
    ) {
        return false;
    }

    const normalizedOrigin = origin.trim();
    const normalizedPattern = pattern.trim();

    // Handle exact matches first (no wildcards)
    if (!normalizedPattern.includes("*")) {
        // Try exact match
        if (normalizedOrigin === normalizedPattern) {
            return true;
        }

        // Try case-insensitive match
        if (
            normalizedOrigin.toLowerCase() === normalizedPattern.toLowerCase()
        ) {
            return true;
        }

        // Try matching if origin contains the pattern (for backwards compatibility)
        if (
            normalizedOrigin
                .toLowerCase()
                .includes(normalizedPattern.toLowerCase())
        ) {
            return true;
        }

        return false;
    }

    // Extract the host:port part from the origin URL
    let originHost = extractHostFromURL(normalizedOrigin);

    // If URL parsing failed, treat it as a host:port string directly
    if (originHost === null) {
        originHost = normalizeHost(normalizedOrigin);
    }

    try {
        const regex = patternToRegex(normalizedPattern);
        return regex.test(originHost);
    } catch (error) {
        // If pattern is invalid, return false
        return false;
    }
}

/**
 * Checks if an origin is allowed based on an array of patterns
 * @param origin - The origin to check
 * @param allowedOrigins - Array of allowed origins (can include wildcards)
 * @returns true if the origin is allowed
 */
export function isOriginAllowed(
    origin: string,
    allowedOrigins: string[]
): boolean {
    // Validate inputs
    if (!origin || typeof origin !== "string" || origin.trim().length === 0) {
        return false;
    }

    if (
        !allowedOrigins ||
        !Array.isArray(allowedOrigins) ||
        allowedOrigins.length === 0
    ) {
        return false;
    }

    // Filter out invalid patterns and check each one
    const validPatterns = allowedOrigins.filter(
        (p) => p && typeof p === "string" && p.trim().length > 0
    );

    if (validPatterns.length === 0) {
        return false;
    }

    return validPatterns.some((pattern) => {
        try {
            return matchesWildcardPattern(origin, pattern);
        } catch (error) {
            // Skip invalid patterns
            return false;
        }
    });
}

/**
 * Creates a CORS origin function that supports wildcard patterns
 * @param allowedOrigins - Array of allowed origins (can include wildcards)
 * @returns Function compatible with cors middleware
 */
export function createWildcardOriginFunction(allowedOrigins: string[]) {
    // Validate and cache the allowed origins array
    if (!allowedOrigins || !Array.isArray(allowedOrigins)) {
        throw new Error("allowedOrigins must be an array");
    }

    const validOrigins = allowedOrigins.filter(
        (p) => p && typeof p === "string" && p.trim().length > 0
    );

    if (validOrigins.length === 0) {
        console.warn("createWildcardOriginFunction: No valid origins provided");
    }

    return (
        origin: string | undefined,
        callback: (err: Error | null, allow?: boolean) => void
    ) => {
        // Validate callback
        if (typeof callback !== "function") {
            throw new Error("Callback must be a function");
        }

        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        }

        try {
            const allowed = isOriginAllowed(origin, validOrigins);
            callback(null, allowed);
        } catch (error) {
            // In case of any error, deny access for security
            callback(null, false);
        }
    };
}


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
 * Converts a wildcard pattern to a regular expression
 * @param pattern - The wildcard pattern (e.g., "localhost:*", "*.example.com")
 * @returns RegExp object for matching
 */
function patternToRegex(pattern: string): RegExp {
    // Escape special regex characters except for *
    const escaped = pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special chars
        .replace(/\*/g, '.*');                   // Replace * with .*
    
    // Ensure exact match with ^ and $
    return new RegExp(`^${escaped}$`, 'i'); // Case insensitive
}

/**
 * Checks if an origin matches a wildcard pattern
 * @param origin - The origin to check (e.g., "http://localhost:3000")
 * @param pattern - The wildcard pattern (e.g., "localhost:*")
 * @returns true if the origin matches the pattern
 */
export function matchesWildcardPattern(origin: string, pattern: string): boolean {
    // Handle exact matches first (no wildcards)
    if (!pattern.includes('*')) {
        return origin === pattern || origin.includes(pattern);
    }
     
    // Extract the host:port part from the origin URL
    let originHost: string;
    try {
        const url = new URL(origin);
        originHost = url.host; // This includes both hostname and port
        
        // Special handling for default ports
        if (url.protocol === 'https:' && url.port === '' && url.hostname === 'localhost') {
            originHost = 'localhost:443';
        } else if (url.protocol === 'http:' && url.port === '' && url.hostname === 'localhost') {
            originHost = 'localhost:80';
        }
        
        // Handle IPv6 addresses - remove brackets for pattern matching
        if (url.hostname.startsWith('[') && url.hostname.endsWith(']')) {
            const ipv6Host = url.hostname.slice(1, -1); // Remove brackets
            originHost = url.port ? `${ipv6Host}:${url.port}` : ipv6Host;
        }
    } catch {
        // If it's not a valid URL, treat it as a host:port string
        originHost = origin;
    }
    
    const regex = patternToRegex(pattern);
    return regex.test(originHost);
}

/**
 * Checks if an origin is allowed based on an array of patterns
 * @param origin - The origin to check
 * @param allowedOrigins - Array of allowed origins (can include wildcards)
 * @returns true if the origin is allowed
 */
export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
    if (!origin || !allowedOrigins || allowedOrigins.length === 0) {
        return false;
    }
    
    return allowedOrigins.some(pattern => matchesWildcardPattern(origin, pattern));
}

/**
 * Creates a CORS origin function that supports wildcard patterns
 * @param allowedOrigins - Array of allowed origins (can include wildcards)
 * @returns Function compatible with cors middleware
 */
export function createWildcardOriginFunction(allowedOrigins: string[]) {
    return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        }
        
        const allowed = isOriginAllowed(origin, allowedOrigins);
        callback(null, allowed);
    };
}

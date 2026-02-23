/**
 * Supported HTTP methods by XyPriss
 */

export const SUPPORTED_HTTP_METHODS = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
    "OPTIONS",
    "HEAD",
    "CONNECT",
    "TRACE",
] as const;

/**
 * Type representing supported HTTP methods
 */
export type HttpMethod = (typeof SUPPORTED_HTTP_METHODS)[number];

/**
 * Common HTTP methods that are most frequently used
 */
export const COMMON_HTTP_METHODS: HttpMethod[] = [
    "GET",
    "POST",
    "PUT",
    "DELETE",
    "PATCH",
];


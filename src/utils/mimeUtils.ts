/**
 * MIME Utilities for XyPriss
 */

/**
 * Normalizes a MIME type by stripping parameters (e.g., "text/plain; charset=utf-8" -> "text/plain").
 * @param mime The MIME type string to normalize.
 * @returns The base MIME type.
 */
export function normalizeMime(mime: string): string {
    if (!mime) return "";
    return mime.split(";")[0].trim().toLowerCase();
}


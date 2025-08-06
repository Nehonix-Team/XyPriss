/**
 * General helper utilities for ACPES
 */
 
/**
 * Checks if data is compressed
 */
export function isCompressed(data: string): boolean {
    return data.startsWith("[COMPRESSED]");
}

/**
 * Generates a storage key with prefix
 */
export function generateStorageKey(key: string): string {
    return `secure_${key}`;
}


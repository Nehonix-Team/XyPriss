/**
 * Compression utilities for ACPES
 */

import LZString from "lz-string";

/**
 * Compression utility class
 */
export class CompressionUtils {
    /**
     * Compresses data using LZ-string and encodes it safely
     */
    public static compress(data: string): string {
        const compressed = LZString.compressToBase64(data);
        return `[COMPRESSED]${compressed}`;
    }

    /**
     * Decompresses data with error handling
     */
    public static decompress(compressedData: string): string {
        if (!this.isCompressed(compressedData)) return compressedData;

        try {
            const data = compressedData.replace("[COMPRESSED]", "");
            const decompressed = LZString.decompressFromBase64(data);

            if (decompressed === null || decompressed === undefined) {
                throw new Error(
                    "Decompression returned null - data may be corrupted"
                );
            }

            return decompressed;
        } catch (error) {
            throw new Error(
                `Decompression failed: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    /**
     * Checks if data is compressed
     */
    public static isCompressed(data: string): boolean {
        return data.startsWith("[COMPRESSED]");
    }
}


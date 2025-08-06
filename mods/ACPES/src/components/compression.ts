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
     * Decompresses data
     */
    public static decompress(compressedData: string): string {
        if (!this.isCompressed(compressedData)) return compressedData;
        const data = compressedData.replace("[COMPRESSED]", "");
        return LZString.decompressFromBase64(data) || compressedData;
    }

    /**
     * Checks if data is compressed
     */
    public static isCompressed(data: string): boolean {
        return data.startsWith("[COMPRESSED]");
    }
}


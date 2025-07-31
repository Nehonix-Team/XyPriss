import { promisify } from "util";
import { existsSync, mkdirSync, statSync, readdirSync } from "fs";
import path from "path";
import zlib from "zlib";
import { SecureRandom } from "../../core";
import * as crypto from "crypto";

/**
 * Ensure directory exists for file cache operations
 */
export const ensureDirectoryExists = async (
    filePath: string
): Promise<void> => {
    const dir = path.dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
};

/**
 * Encrypt data for file storage
 */
export const encryptFileData = (
    data: string,
    key?: Buffer
): {
    encrypted: string;
    iv: string;
    authTag: string;
    key: string;
} => {
    const encryptionKey = key || SecureRandom.getRandomBytes(32);
    const iv = SecureRandom.getRandomBytes(16);

    const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
    let encrypted = cipher.update(data, "utf8", "base64");
    encrypted += cipher.final("base64");

    const authTag = cipher.getAuthTag();

    return {
        encrypted,
        iv: iv.toString("base64"),
        authTag: authTag.toString("base64"),
        key: encryptionKey.toString("base64"),
    };
};

/**
 * Decrypt data from file storage
 */
export const decryptFileData = (
    encrypted: string,
    iv: string,
    authTag: string,
    key: string
): string => {
    const keyBuffer = Buffer.from(key, "base64");
    const ivBuffer = Buffer.from(iv, "base64");
    const authTagBuffer = Buffer.from(authTag, "base64");

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        keyBuffer,
        ivBuffer
    );
    decipher.setAuthTag(authTagBuffer);

    let decrypted = decipher.update(encrypted, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
};

/**
 * Compress data if beneficial
 */
export const compressFileData = async (
    data: string
): Promise<{
    data: string;
    compressed: boolean;
}> => {
    if (data.length < 1024) {
        // Don't compress small data
        return { data, compressed: false };
    }

    try {
        const deflate = promisify(zlib.deflate);
        const compressed = await deflate(Buffer.from(data, "utf8"));
        const compressedString = compressed.toString("base64");

        if (compressedString.length < data.length * 0.9) {
            return { data: compressedString, compressed: true };
        }
    } catch (error) {
        console.warn("File compression failed:", error);
    }

    return { data, compressed: false };
};

/**
 * Decompress data
 */
export const decompressFileData = async (
    data: string,
    compressed: boolean
): Promise<string> => {
    if (!compressed) return data;

    try {
        const inflate = promisify(zlib.inflate);
        const decompressed = await inflate(Buffer.from(data, "base64"));
        return decompressed.toString("utf8");
    } catch (error) {
        console.error("File decompression failed:", error);
        throw new Error("Data decompression failed");
    }
};

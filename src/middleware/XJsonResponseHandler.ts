/**
 * XJsonResponseHandler - Advanced JSON Response Handler
 * Handles large data serialization without limits
 */

import { expressStringify } from "../../mods/security/src/components/fortified-function/serializer/safe-serializer";
import { XyPrisResponse } from "../types/httpServer.type";

export interface XJsonOptions {
    /**
     * Maximum depth for object serialization
     * @default 20
     */
    maxDepth?: number;

    /**
     * Maximum string length before truncation
     * @default 10000
     */
    truncateStrings?: number;

    /**
     * Include non-enumerable properties
     * @default false
     */
    includeNonEnumerable?: boolean;

    /**
     * Enable streaming for very large responses
     * @default true
     */
    enableStreaming?: boolean;

    /**
     * Chunk size for streaming responses (in bytes)
     * @default 1024 * 64 (64KB)
     */
    chunkSize?: number;
}

export class XJsonResponseHandler {
    private options: Required<XJsonOptions>;

    constructor(options: XJsonOptions = {}) {
        this.options = {
            maxDepth: 20,
            truncateStrings: 10000,
            includeNonEnumerable: false,
            enableStreaming: true,
            chunkSize: 1024 * 64, // 64KB chunks
            ...options,
        };
    }

    /**
     * Main method to handle XJson responses
     */
    public xJson(res: XyPrisResponse, data: any): void {
        try {
            // Set content type
            res.setHeader("Content-Type", "application/json");

            // Serialize the data
            const serialized = this.serializeData(data);

            // Check if we should use streaming
            if (
                this.options.enableStreaming &&
                serialized.length > this.options.chunkSize
            ) {
                this.streamResponse(res, serialized);
            } else {
                // Regular response for smaller data
                res.end(serialized);
            }
        } catch (error) {
            this.handleSerializationError(res, error);
        }
    }

    /**
     * Serialize data using safe serialization
     */
    private serializeData(data: any): string {
        try {
            // First try standard JSON serialization for performance
            const standardResult = JSON.stringify(data);
            return standardResult;
        } catch (error: any) {
            // Handle BigInt serialization8
            if (
                (error instanceof Error && error.message.includes("BigInt")) ||
                error.message.includes("bigint")
            ) {
                return this.handleBigIntSerialization(data);
            }
            // Fall back to safe serialization for other errors
            return expressStringify(data);
        }
    }

    /**
     * Handle BigInt serialization by converting BigInt to string
     */
    private handleBigIntSerialization(data: any): string {
        const replacer = (key: string, value: any) => {
            if (typeof value === "bigint") {
                return value.toString();
            }
            return value;
        };

        try {
            return JSON.stringify(data, replacer);
        } catch (error) {
            // If still fails, fall back to safe serialization
            return expressStringify(data);
        }
    }

    /**
     * Stream large responses in chunks
     */
    private streamResponse(res: XyPrisResponse, data: string): void {
        let position = 0;
        const length = data.length;

        // Set content length header
        res.setHeader("Content-Length", length);

        // Stream data in chunks
        const streamChunk = () => {
            while (position < length) {
                const chunkSize = Math.min(
                    this.options.chunkSize,
                    length - position
                );
                const chunk = data.substring(position, position + chunkSize);
                position += chunkSize;

                // Send chunk
                const sent = res.write(chunk);

                // If write returns false, wait for drain event
                if (!sent) {
                    res.once("drain", streamChunk);
                    return;
                }
            }

            // End response when done
            res.end();
        };

        streamChunk();
    }

    /**
     * Handle serialization errors
     */
    private handleSerializationError(res: XyPrisResponse, error: any): void {
        console.error("❌ XJson Serialization Error:", error);

        res.status(500).json({
            error: "Internal Server Error",
            message: "Failed to serialize response",
            details: error instanceof Error ? error.message : String(error),
        });
    }

    /**
     * Create middleware to override res.xJson
     */
    public static createMiddleware(
        options: XJsonOptions = {}
    ): (req: any, res: XyPrisResponse, next: () => void) => void {
        const handler = new XJsonResponseHandler(options);

        return (req, res, next) => {
            // Override res.xJson method
            res.xJson = (data: any) => {
                handler.xJson(res, data);
            };

            // Also provide res.json as alias for backward compatibility
            const originalJson = res.json;
            res.json = (data: any) => {
                if (
                    req.path.endsWith(".xJson") ||
                    req.headers["accept"]?.includes("application/x-json")
                ) {
                    handler.xJson(res, data);
                } else {
                    originalJson.call(res, data);
                }
            };

            next();
        };
    }

    /**
     * Utility method for direct XJson serialization
     */
    public static stringify(data: any, options: XJsonOptions = {}): string {
        const handler = new XJsonResponseHandler(options);
        return handler.serializeData(data);
    }
}


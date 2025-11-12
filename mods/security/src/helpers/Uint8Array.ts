import { __strl__ } from "strulink";
import { EncodingType } from "../types/random";
import { bufferToHex } from "../utils";
  
/**
 * Enhanced Uint8Array with encoding support and improved security
 */
export class EnhancedUint8Array extends Uint8Array {
    private _isCleared: boolean = false;

    /**
     * Convert to string with specified encoding
     * @param encoding - Encoding type (optional, defaults to hex for security)
     * @returns Encoded string
     */
    public toString(encoding?: EncodingType): string {
        this._checkCleared();

        // Default to hex encoding for security if no encoding specified
        const safeEncoding = encoding || "hex";

        switch (safeEncoding) {
            case "hex":
                return this._toHexSecure();

            case "base64":
                return this._toBase64Secure();

            case "base64url":
                const base64 = this._toBase64Secure();
                return base64
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_")
                    .replace(/=/g, "");

            case "base58":
                return this._toBase58Secure();

            case "binary":
                // Security warning: binary encoding can be dangerous
                console.warn(
                    "Binary encoding may expose sensitive data in logs"
                );
                return this._toBinarySecure();

            case "utf8":
                return this._toUtf8Secure();

            default:
                // Validate encoding parameter to prevent injection
                if (
                    typeof safeEncoding !== "string" ||
                    !/^[a-zA-Z0-9_-]+$/.test(safeEncoding)
                ) {
                    throw new Error("Invalid encoding type");
                }
                return __strl__.encode(bufferToHex(this), safeEncoding);
        }
    }

    /**
     * Secure hex conversion
     */
    private _toHexSecure(): string {
        const result = new Array(this.length * 2);
        for (let i = 0; i < this.length; i++) {
            const hex = this[i].toString(16);
            result[i * 2] = hex.length === 1 ? "0" : hex[0];
            result[i * 2 + 1] = hex.length === 1 ? hex[0] : hex[1];
        }
        return result.join("");
    }

    /**
     * Secure base64 conversion
     */
    private _toBase64Secure(): string {
        if (typeof Buffer !== "undefined") {
            return Buffer.from(this).toString("base64");
        } else {
            // More secure browser fallback with validation
            try {
                // Validate data length to prevent memory issues
                if (this.length > 1024 * 1024) {
                    // 1MB limit
                    throw new Error("Data too large for base64 encoding");
                }

                let binary = "";
                const chunkSize = 8192; // Process in chunks to avoid call stack limits

                for (let i = 0; i < this.length; i += chunkSize) {
                    const chunk = this.slice(
                        i,
                        Math.min(i + chunkSize, this.length)
                    );
                    binary += String.fromCharCode(...chunk);
                }

                return btoa(binary);
            } catch (error) {
                throw new Error(
                    "Base64 encoding failed: " + (error as Error).message
                );
            }
        }
    }

    /**
     * Secure Base58 conversion with improved error handling
     */
    private _toBase58Secure(): string {
        const ALPHABET =
            "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

        if (this.length === 0) return "";

        // Validate input size to prevent DoS
        if (this.length > 1024) {
            throw new Error("Input too large for Base58 encoding");
        }

        try {
            // Count leading zeros
            let leadingZeros = 0;
            for (const byte of this) {
                if (byte === 0) leadingZeros++;
                else break;
            }

            // Convert to base58 with overflow protection
            let num = BigInt(0);
            for (const byte of this) {
                const newNum = num * BigInt(256) + BigInt(byte);
                // Check for reasonable bounds
                if (newNum > BigInt(Number.MAX_SAFE_INTEGER) * BigInt(1000)) {
                    throw new Error("Number too large for Base58 conversion");
                }
                num = newNum;
            }

            let result = "";
            while (num > 0) {
                const remainder = Number(num % BigInt(58));
                result = ALPHABET[remainder] + result;
                num = num / BigInt(58);
            }

            return "1".repeat(leadingZeros) + result;
        } catch (error) {
            throw new Error(
                "Base58 encoding failed: " + (error as Error).message
            );
        }
    }

    /**
     * Secure binary conversion
     */
    private _toBinarySecure(): string {
        try {
            // Limit size to prevent memory issues
            if (this.length > 65536) {
                // 64KB limit
                throw new Error("Data too large for binary string conversion");
            }

            let result = "";
            const chunkSize = 8192;

            for (let i = 0; i < this.length; i += chunkSize) {
                const chunk = this.slice(
                    i,
                    Math.min(i + chunkSize, this.length)
                );
                result += String.fromCharCode(...chunk);
            }

            return result;
        } catch (error) {
            throw new Error(
                "Binary encoding failed: " + (error as Error).message
            );
        }
    }

    /**
     * Secure UTF-8 conversion
     */
    private _toUtf8Secure(): string {
        if (typeof TextDecoder !== "undefined") {
            try {
                const decoder = new TextDecoder("utf-8", { fatal: true });
                return decoder.decode(this);
            } catch (error) {
                throw new Error("Invalid UTF-8 sequence");
            }
        } else {
            // Fallback with validation
            try {
                return this._toBinarySecure();
            } catch (error) {
                throw new Error(
                    "UTF-8 decoding failed: " + (error as Error).message
                );
            }
        }
    }

    /**
     * Get entropy information with enhanced analysis
     */
    public getEntropyInfo(): {
        bytes: number;
        bits: number;
        quality: string;
        entropy: number;
    } {
        this._checkCleared();

        const entropy = this._calculateShannonEntropy();

        return {
            bytes: this.length,
            bits: this.length * 8,
            quality: this._getQualityRating(entropy),
            entropy: Math.round(entropy * 100) / 100,
        };
    }

    /**
     * Calculate Shannon entropy for quality assessment
     */
    private _calculateShannonEntropy(): number {
        if (this.length === 0) return 0;

        const frequency = new Map<number, number>();

        // Count byte frequencies
        for (const byte of this) {
            frequency.set(byte, (frequency.get(byte) || 0) + 1);
        }

        // Calculate entropy
        let entropy = 0;
        for (const count of frequency.values()) {
            const probability = count / this.length;
            entropy -= probability * Math.log2(probability);
        }

        return entropy;
    }

    /**
     * Get quality rating based on entropy and length
     */
    private _getQualityRating(entropy: number): string {
        if (this.length < 8) return "VERY_LOW";
        if (this.length < 16) return "LOW";

        if (entropy < 6) return "LOW";
        if (entropy < 7) return "MEDIUM";
        if (entropy < 7.5) return "HIGH";
        return "VERY_HIGH";
    }

    /**
     * Get as Buffer with proper typing and security
     * @returns Buffer<ArrayBufferLike> containing the same data
     */ 
    public getBuffer(): Buffer<ArrayBufferLike> {
        this._checkCleared();

        if (typeof Buffer !== "undefined") {
            // Create a proper Buffer from the Uint8Array
            const buffer = Buffer.from(
                this.buffer,
                this.byteOffset,
                this.byteLength
            );
            return buffer as Buffer<ArrayBufferLike>;
        } else {
            // Enhanced browser fallback with proper Buffer-like interface
            const arrayBuffer = this.buffer.slice(
                this.byteOffset,
                this.byteOffset + this.byteLength
            );
            const buffer = new Uint8Array(arrayBuffer) as any;

            // Add Buffer methods
            buffer.toString = (encoding?: BufferEncoding) => {
                switch (encoding) {
                    case "hex":
                        return this._toHexSecure();
                    case "base64":
                        return this._toBase64Secure();
                    case "utf8":
                    case "utf-8":
                        return this._toUtf8Secure();
                    case "binary":
                        return this._toBinarySecure();
                    case "ascii":
                        return this._toBinarySecure(); // ASCII is subset of binary
                    default:
                        return this._toHexSecure();
                }
            };

            // Add other essential Buffer properties
            Object.defineProperty(buffer, "length", {
                value: this.length,
                writable: false,
            });

            // Add buffer property pointing to the ArrayBuffer
            Object.defineProperty(buffer, "buffer", {
                value: arrayBuffer,
                writable: false,
            });

            return buffer as Buffer<ArrayBufferLike>;
        }
    }

    /**
     * Securely clear the array contents
     */
    public clear(): void {
        if (!this._isCleared) {
            // Overwrite with random data first, then zeros
            if (typeof crypto !== "undefined" && crypto.getRandomValues) {
                crypto.getRandomValues(this);
            }
            this.fill(0);
            this._isCleared = true;
        }
    }

    /**
     * Check if array has been cleared
     */
    private _checkCleared(): void {
        if (this._isCleared) {
            throw new Error("Cannot access cleared EnhancedUint8Array");
        }
    }

    /**
     * Create a secure copy of the array
     */
    public secureClone(): EnhancedUint8Array {
        this._checkCleared();
        const clone = new EnhancedUint8Array(this.length);
        clone.set(this);
        return clone;
    }

    /**
     * Compare with another array in constant time to prevent timing attacks
     */
    public constantTimeEquals(other: Uint8Array): boolean {
        this._checkCleared();

        if (this.length !== other.length) {
            return false;
        }

        let result = 0;
        for (let i = 0; i < this.length; i++) {
            result |= this[i] ^ other[i];
        }

        return result === 0;
    }

    /**
     * Convert to regular Uint8Array for safe Buffer operations
     */
    public toUint8Array(): Uint8Array {
        this._checkCleared();
        return new Uint8Array(this);
    }

    /**
     * Override valueOf to provide safe primitive conversion
     * Returns this instance for Buffer.from() compatibility
     */
    public valueOf(): this {
        this._checkCleared();
        return this;
    }
}

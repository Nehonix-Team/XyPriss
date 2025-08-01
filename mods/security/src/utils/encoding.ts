import { CHAR_SETS } from "./constants";

/**
 * Enhanced encoding utilities for various formats
 */

// =============================================================================
// HEX UTILITIES
// =============================================================================

/**
 * Convert a buffer to a hexadecimal string
 * @param buffer - The buffer to convert
 * @param uppercase - Whether to use uppercase letters (default: false)
 * @param separator - Optional separator between bytes (e.g., ':', ' ', '-')
 * @returns Hexadecimal string representation
 */
export function bufferToHex(
    buffer: Uint8Array,
    uppercase: boolean = false,
    separator?: string
): string {
    const hex = Array.from(buffer)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(separator || "");

    return uppercase ? hex.toUpperCase() : hex;
}

/**
 * Convert a hexadecimal string to a buffer
 * @param hex - The hexadecimal string to convert
 * @returns Uint8Array representation
 */
export function hexToBuffer(hex: string): Uint8Array {
    // Remove common separators and whitespace
    const cleanHex = hex.replace(/[:\s-]/g, "");

    if (cleanHex.length % 2 !== 0) {
        throw new Error("Hex string must have an even number of characters");
    }

    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
        bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
    }

    return bytes;
}

// =============================================================================
// BINARY UTILITIES
// =============================================================================

/**
 * Convert a buffer to a binary string
 * @param buffer - The buffer to convert
 * @param separator - Optional separator between bytes (e.g., ' ', '-')
 * @returns Binary string representation
 */
export function bufferToBinary(buffer: Uint8Array, separator?: string): string {
    const binary = Array.from(buffer)
        .map((b) => b.toString(2).padStart(8, "0"))
        .join(separator || "");

    return binary;
}

/**
 * Convert a binary string to a buffer
 * @param binary - The binary string to convert
 * @returns Uint8Array representation
 */
export function binaryToBuffer(binary: string): Uint8Array {
    // Remove separators and whitespace
    const cleanBinary = binary.replace(/[\s-]/g, "");

    if (cleanBinary.length % 8 !== 0) {
        throw new Error("Binary string length must be a multiple of 8");
    }

    const bytes = new Uint8Array(cleanBinary.length / 8);
    for (let i = 0; i < cleanBinary.length; i += 8) {
        bytes[i / 8] = parseInt(cleanBinary.substring(i, i + 8), 2);
    }

    return bytes;
}

/**
 * Convert a number to binary string with specified bit width
 * @param num - The number to convert
 * @param bits - The number of bits (default: 8)
 * @returns Binary string representation
 */
export function numberToBinary(num: number, bits: number = 8): string {
    return (num >>> 0).toString(2).padStart(bits, "0");
}

/**
 * Convert a binary string to a number
 * @param binary - The binary string to convert
 * @returns Number representation
 */
export function binaryToNumber(binary: string): number {
    return parseInt(binary, 2);
}

// =============================================================================
// BASE64 UTILITIES (Enhanced)
// =============================================================================

/**
 * Convert a buffer to a Base64 string
 * @param buffer - The buffer to convert
 * @param urlSafe - Whether to use URL-safe Base64 (default: false)
 * @returns Base64 string representation
 */
export function bufferToBase64(
    buffer: Uint8Array,
    urlSafe: boolean = false
): string {
    let result: string;

    if (typeof Buffer !== "undefined") {
        // Node.js environment
        result = Buffer.from(buffer).toString("base64");
    } else if (typeof btoa === "function") {
        // Browser environment
        const binary = Array.from(buffer)
            .map((b) => String.fromCharCode(b))
            .join("");
        result = btoa(binary);
    } else {
        // Fallback implementation
        const CHARS =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        result = "";
        const bytes = new Uint8Array(buffer);
        const len = bytes.length;
        let i = 0;

        while (i < len) {
            const b1 = bytes[i++];
            const b2 = i < len ? bytes[i++] : 0;
            const b3 = i < len ? bytes[i++] : 0;

            const triplet = (b1 << 16) | (b2 << 8) | b3;

            result += CHARS[(triplet >> 18) & 0x3f];
            result += CHARS[(triplet >> 12) & 0x3f];
            result += i > len - 2 ? "=" : CHARS[(triplet >> 6) & 0x3f];
            result += i > len - 1 ? "=" : CHARS[triplet & 0x3f];
        }
    }

    if (urlSafe) {
        result = result
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");
    }

    return result;
}

/**
 * Convert a Base64 string to a buffer
 * @param base64 - The Base64 string to convert
 * @param urlSafe - Whether the input is URL-safe Base64 (default: false)
 * @returns Uint8Array representation
 */
export function base64ToBuffer(
    base64: string,
    urlSafe: boolean = false
): Uint8Array {
    let str = base64;

    if (urlSafe) {
        str = str.replace(/-/g, "+").replace(/_/g, "/");
        // Add padding if needed
        while (str.length % 4) {
            str += "=";
        }
    }

    if (typeof Buffer !== "undefined") {
        // Node.js environment
        return new Uint8Array(Buffer.from(str, "base64"));
    } else if (typeof atob === "function") {
        // Browser environment
        const binary = atob(str);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    } else {
        // Fallback implementation
        const CHARS =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

        // Remove padding if present
        const cleanStr = str.replace(/=+$/, "");
        const bytesLength = Math.floor((cleanStr.length * 3) / 4);
        const bytes = new Uint8Array(bytesLength);

        let p = 0;
        for (let i = 0; i < cleanStr.length; i += 4) {
            const c1 = CHARS.indexOf(cleanStr[i]);
            const c2 = CHARS.indexOf(cleanStr[i + 1]);
            const c3 =
                i + 2 < cleanStr.length ? CHARS.indexOf(cleanStr[i + 2]) : 64;
            const c4 =
                i + 3 < cleanStr.length ? CHARS.indexOf(cleanStr[i + 3]) : 64;

            bytes[p++] = (c1 << 2) | (c2 >> 4);
            if (c3 < 64) bytes[p++] = ((c2 & 15) << 4) | (c3 >> 2);
            if (c4 < 64) bytes[p++] = ((c3 & 3) << 6) | c4;
        }

        return bytes;
    }
}

// =============================================================================
// BASE58 UTILITIES (Enhanced)
// =============================================================================

/**
 * Convert a buffer to a Base58 string (Bitcoin style)
 * @param buffer - The buffer to convert
 * @returns Base58 string representation
 */
export function bufferToBase58(buffer: Uint8Array): string {
    const ALPHABET = CHAR_SETS.BASE58;

    // Count leading zeros
    let zeros = 0;
    for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === 0) {
            zeros++;
        } else {
            break;
        }
    }

    // Convert to base58
    const input = Array.from(buffer);
    let output = "";

    for (let i = zeros; i < input.length; i++) {
        let carry = input[i];

        // Apply "b58 = b58 * 256 + ch"
        for (let k = output.length - 1; k >= 0 || carry > 0; k--) {
            if (k < 0) {
                output = ALPHABET[0] + output;
                k = 0;
            }

            let x = ALPHABET.indexOf(output[k]) * 256 + carry;
            output =
                output.substring(0, k) +
                ALPHABET[x % 58] +
                output.substring(k + 1);
            carry = Math.floor(x / 58);
        }
    }

    // Add leading '1's for each leading zero byte
    for (let i = 0; i < zeros; i++) {
        output = ALPHABET[0] + output;
    }

    return output;
}

/**
 * Convert a Base58 string to a buffer
 * @param base58 - The Base58 string to convert
 * @returns Uint8Array representation
 */
export function base58ToBuffer(base58: string): Uint8Array {
    const ALPHABET = CHAR_SETS.BASE58;

    if (!base58) {
        return new Uint8Array(0);
    }

    // Count leading '1's
    let zeros = 0;
    for (let i = 0; i < base58.length; i++) {
        if (base58[i] === ALPHABET[0]) {
            zeros++;
        } else {
            break;
        }
    }

    // Convert from base58 to base256
    const input = Array.from(base58);
    const output = new Uint8Array(base58.length * 2); // Over-allocate for safety
    let outputLen = 0;

    for (let i = zeros; i < input.length; i++) {
        const c = ALPHABET.indexOf(input[i]);
        if (c < 0) {
            throw new Error(`Invalid Base58 character: ${input[i]}`);
        }

        let carry = c;
        for (let j = 0; j < outputLen; j++) {
            carry += output[j] * 58;
            output[j] = carry & 0xff;
            carry >>= 8;
        }

        while (carry > 0) {
            output[outputLen++] = carry & 0xff;
            carry >>= 8;
        }
    }

    // Add leading zeros
    for (let i = 0; i < zeros; i++) {
        output[outputLen++] = 0;
    }

    // Reverse the array
    const result = new Uint8Array(outputLen);
    for (let i = 0; i < outputLen; i++) {
        result[i] = output[outputLen - 1 - i];
    }

    return result;
}

// =============================================================================
// BASE32 UTILITIES (Enhanced)
// =============================================================================

/**
 * Convert a buffer to a Base32 string (RFC 4648)
 * @param buffer - The buffer to convert
 * @param padding - Whether to include padding (default: true)
 * @returns Base32 string representation
 */
export function bufferToBase32(
    buffer: Uint8Array,
    padding: boolean = true
): string {
    const ALPHABET = CHAR_SETS.BASE32;
    let result = "";
    let bits = 0;
    let value = 0;

    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | buffer[i];
        bits += 8;

        while (bits >= 5) {
            result += ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        result += ALPHABET[(value << (5 - bits)) & 31];
    }

    // Add padding
    if (padding) {
        while (result.length % 8 !== 0) {
            result += "=";
        }
    }

    return result;
}

/**
 * Convert a Base32 string to a buffer
 * @param base32 - The Base32 string to convert
 * @returns Uint8Array representation
 */
export function base32ToBuffer(base32: string): Uint8Array {
    const ALPHABET = CHAR_SETS.BASE32;

    // Remove padding and convert to uppercase
    const str = base32.toUpperCase().replace(/=+$/, "");

    let bits = 0;
    let value = 0;
    let index = 0;
    const output = new Uint8Array(Math.ceil((str.length * 5) / 8));

    for (let i = 0; i < str.length; i++) {
        const c = ALPHABET.indexOf(str[i]);
        if (c < 0) {
            throw new Error(`Invalid Base32 character: ${str[i]}`);
        }

        value = (value << 5) | c;
        bits += 5;

        if (bits >= 8) {
            output[index++] = (value >>> (bits - 8)) & 255;
            bits -= 8;
        }
    }

    return output.slice(0, index);
}

// =============================================================================
// OCTAL UTILITIES
// =============================================================================

/**
 * Convert a buffer to an octal string
 * @param buffer - The buffer to convert
 * @param separator - Optional separator between bytes
 * @returns Octal string representation
 */
export function bufferToOctal(buffer: Uint8Array, separator?: string): string {
    return Array.from(buffer)
        .map((b) => b.toString(8).padStart(3, "0"))
        .join(separator || "");
}

/**
 * Convert an octal string to a buffer
 * @param octal - The octal string to convert
 * @returns Uint8Array representation
 */
export function octalToBuffer(octal: string): Uint8Array {
    // Remove separators and whitespace
    const cleanOctal = octal.replace(/[\s-]/g, "");

    if (cleanOctal.length % 3 !== 0) {
        throw new Error("Octal string length must be a multiple of 3");
    }

    const bytes = new Uint8Array(cleanOctal.length / 3);
    for (let i = 0; i < cleanOctal.length; i += 3) {
        bytes[i / 3] = parseInt(cleanOctal.substring(i, i + 3), 8);
    }

    return bytes;
}

/**
 * Convert a number to octal string
 * @param num - The number to convert
 * @returns Octal string representation
 */
export function numberToOctal(num: number): string {
    return num.toString(8);
}

/**
 * Convert an octal string to a number
 * @param octal - The octal string to convert
 * @returns Number representation
 */
export function octalToNumber(octal: string): number {
    return parseInt(octal, 8);
}

// =============================================================================
// STRING ENCODING UTILITIES
// =============================================================================

/**
 * Convert a string to a buffer using UTF-8 encoding
 * @param str - The string to convert
 * @returns Uint8Array representation
 */
export function stringToBuffer(str: string): Uint8Array {
    if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(str);
    } else {
        // Fallback for environments without TextEncoder
        const utf8 = unescape(encodeURIComponent(str));
        const bytes = new Uint8Array(utf8.length);
        for (let i = 0; i < utf8.length; i++) {
            bytes[i] = utf8.charCodeAt(i);
        }
        return bytes;
    }
}

/**
 * Convert a string directly to hexadecimal representation
 * @param str - The string to convert
 * @param uppercase - Whether to use uppercase letters (default: false)
 * @param separator - Optional separator between bytes
 * @returns Hexadecimal string representation
 */
export function stringToHex(
    str: string,
    uppercase: boolean = false,
    separator?: string
): string {
    const buffer = stringToBuffer(str);
    return bufferToHex(buffer, uppercase, separator);
}

/**
 * Convert a hexadecimal string back to a string
 * @param hex - The hexadecimal string to convert
 * @returns String representation
 */
export function hexToString(hex: string): string {
    const buffer = hexToBuffer(hex);
    return bufferToString(buffer);
}

/**
 * Convert a string directly to Base64 encoding
 * @param str - The string to encode
 * @param urlSafe - Whether to use URL-safe Base64 (default: false)
 * @returns Base64 encoded string
 */
export function stringToBase64(str: string, urlSafe: boolean = false): string {
    const buffer = stringToBuffer(str);
    return bufferToBase64(buffer, urlSafe);
}

/**
 * Convert a Base64 encoded string back to string
 * @param base64 - The Base64 encoded string
 * @param urlSafe - Whether the input is URL-safe Base64 (default: false)
 * @returns Decoded string
 */
export function base64ToString(
    base64: string,
    urlSafe: boolean = false
): string {
    const buffer = base64ToBuffer(base64, urlSafe);
    return bufferToString(buffer);
}

/**
 * Convert a buffer to a string using UTF-8 decoding
 * @param buffer - The buffer to convert
 * @returns String representation
 */
export function bufferToString(buffer: Uint8Array): string {
    if (typeof TextDecoder !== "undefined") {
        return new TextDecoder().decode(buffer);
    } else {
        // Fallback for environments without TextDecoder
        const binary = Array.from(buffer)
            .map((b) => String.fromCharCode(b))
            .join("");
        return decodeURIComponent(escape(binary));
    }
}

/**
 * Convert a string to ASCII bytes
 * @param str - The string to convert
 * @returns Uint8Array with ASCII codes
 */
export function stringToAscii(str: string): Uint8Array {
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code > 127) {
            throw new Error(`Non-ASCII character at position ${i}: ${str[i]}`);
        }
        bytes[i] = code;
    }
    return bytes;
}

/**
 * Convert ASCII bytes to a string
 * @param buffer - The buffer with ASCII codes
 * @returns String representation
 */
export function asciiToString(buffer: Uint8Array): string {
    return Array.from(buffer)
        .map((b) => String.fromCharCode(b))
        .join("");
}

// =============================================================================
// BASE64URL UTILITIES
// =============================================================================

/**
 * Convert a string to Base64URL encoding
 * @param str - The string to encode
 * @returns Base64URL encoded string
 */
export function stringToBase64Url(str: string): string {
    const buffer = stringToBuffer(str);
    return bufferToBase64(buffer, true);
}

/**
 * Convert a Base64URL encoded string back to string
 * @param base64url - The Base64URL encoded string
 * @returns Decoded string
 */
export function base64UrlToString(base64url: string): string {
    const buffer = base64ToBuffer(base64url, true);
    return bufferToString(buffer);
}

/**
 * Convert regular Base64 to Base64URL
 * @param base64 - The regular Base64 string
 * @returns Base64URL string
 */
export function base64ToBase64Url(base64: string): string {
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Convert Base64URL to regular Base64
 * @param base64url - The Base64URL string
 * @returns Regular Base64 string
 */
export function base64UrlToBase64(base64url: string): string {
    let str = base64url.replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if needed
    while (str.length % 4) {
        str += "=";
    }
    return str;
}

/**
 * Convert a buffer to Base64URL encoding
 * @param buffer - The buffer to convert
 * @returns Base64URL encoded string
 */
export function bufferToBase64Url(buffer: Uint8Array): string {
    return bufferToBase64(buffer, true);
}

/**
 * Convert a Base64URL string to a buffer
 * @param base64url - The Base64URL string to convert
 * @returns Uint8Array representation
 */
export function base64UrlToBuffer(base64url: string): Uint8Array {
    return base64ToBuffer(base64url, true);
}

// =============================================================================
// URL ENCODING UTILITIES
// =============================================================================

/**
 * URL encode a string
 * @param str - The string to encode
 * @returns URL encoded string
 */
export function urlEncode(str: string): string {
    return encodeURIComponent(str);
}

/**
 * URL decode a string
 * @param str - The URL encoded string to decode
 * @returns Decoded string
 */
export function urlDecode(str: string): string {
    return decodeURIComponent(str);
}

/**
 * Convert a buffer to URL encoded string
 * @param buffer - The buffer to convert
 * @returns URL encoded string
 */
export function bufferToUrlEncoded(buffer: Uint8Array): string {
    return Array.from(buffer)
        .map((b) => "%" + b.toString(16).padStart(2, "0").toUpperCase())
        .join("");
}

// =============================================================================
// NUMERIC CONVERSION UTILITIES
// =============================================================================

/**
 * Convert a number to any base (2-36)
 * @param num - The number to convert
 * @param base - The target base (2-36)
 * @returns String representation in the specified base
 */
export function numberToBase(num: number, base: number): string {
    if (base < 2 || base > 36) {
        throw new Error("Base must be between 2 and 36");
    }
    return num.toString(base);
}

/**
 * Convert a string from any base (2-36) to a number
 * @param str - The string to convert
 * @param base - The base of the input string (2-36)
 * @returns Number representation
 */
export function baseToNumber(str: string, base: number): number {
    if (base < 2 || base > 36) {
        throw new Error("Base must be between 2 and 36");
    }
    return parseInt(str, base);
}

/**
 * Convert between different number bases
 * @param str - The input string
 * @param fromBase - The base of the input string
 * @param toBase - The target base
 * @returns String representation in the target base
 */
export function convertBase(
    str: string,
    fromBase: number,
    toBase: number
): string {
    const num = baseToNumber(str, fromBase);
    return numberToBase(num, toBase);
}

// =============================================================================
// ENDIANNESS UTILITIES
// =============================================================================

/**
 * Convert a 16-bit number to bytes (little-endian)
 * @param num - The 16-bit number
 * @returns Uint8Array with 2 bytes
 */
export function uint16ToBytes(num: number): Uint8Array {
    const buffer = new Uint8Array(2);
    buffer[0] = num & 0xff;
    buffer[1] = (num >> 8) & 0xff;
    return buffer;
}

/**
 * Convert bytes to a 16-bit number (little-endian)
 * @param buffer - The buffer with 2 bytes
 * @returns 16-bit number
 */
export function bytesToUint16(buffer: Uint8Array): number {
    if (buffer.length < 2) {
        throw new Error("Buffer must have at least 2 bytes");
    }
    return buffer[0] | (buffer[1] << 8);
}

/**
 * Convert a 32-bit number to bytes (little-endian)
 * @param num - The 32-bit number
 * @returns Uint8Array with 4 bytes
 */
export function uint32ToBytes(num: number): Uint8Array {
    const buffer = new Uint8Array(4);
    buffer[0] = num & 0xff;
    buffer[1] = (num >> 8) & 0xff;
    buffer[2] = (num >> 16) & 0xff;
    buffer[3] = (num >> 24) & 0xff;
    return buffer;
}

/**
 * Convert bytes to a 32-bit number (little-endian)
 * @param buffer - The buffer with 4 bytes
 * @returns 32-bit number
 */
export function bytesToUint32(buffer: Uint8Array): number {
    if (buffer.length < 4) {
        throw new Error("Buffer must have at least 4 bytes");
    }
    return (
        (buffer[0] |
            (buffer[1] << 8) |
            (buffer[2] << 16) |
            (buffer[3] << 24)) >>>
        0
    );
}

/**
 * Reverse byte order (swap endianness)
 * @param buffer - The buffer to reverse
 * @returns New buffer with reversed byte order
 */
export function reverseBytes(buffer: Uint8Array): Uint8Array {
    return new Uint8Array(Array.from(buffer).reverse());
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Compare two buffers for equality
 * @param a - First buffer
 * @param b - Second buffer
 * @returns True if buffers are equal
 */
export function buffersEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * Concatenate multiple buffers
 * @param buffers - Array of buffers to concatenate
 * @returns New buffer containing all input buffers
 */
export function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const buffer of buffers) {
        result.set(buffer, offset);
        offset += buffer.length;
    }

    return result;
}

/**
 * XOR two buffers
 * @param a - First buffer
 * @param b - Second buffer
 * @returns New buffer with XOR result
 */
export function xorBuffers(a: Uint8Array, b: Uint8Array): Uint8Array {
    const length = Math.min(a.length, b.length);
    const result = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
        result[i] = a[i] ^ b[i];
    }

    return result;
}

/**
 * Generate a random buffer
 * @param length - The length of the buffer
 * @returns Random buffer
 */
export function randomBuffer(length: number): Uint8Array {
    const buffer = new Uint8Array(length);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
        crypto.getRandomValues(buffer);
    } else {
        // Fallback for environments without crypto
        for (let i = 0; i < length; i++) {
            buffer[i] = Math.floor(Math.random() * 256);
        }
    }
    return buffer;
}

/**
 * Pad a buffer to a specific length
 * @param buffer - The buffer to pad
 * @param length - The target length
 * @param value - The padding value (default: 0)
 * @param left - Whether to pad on the left (default: false)
 * @returns Padded buffer
 */
export function padBuffer(
    buffer: Uint8Array,
    length: number,
    value: number = 0,
    left: boolean = false
): Uint8Array {
    if (buffer.length >= length) {
        return buffer;
    }

    const padded = new Uint8Array(length);
    padded.fill(value);

    if (left) {
        padded.set(buffer, length - buffer.length);
    } else {
        padded.set(buffer, 0);
    }

    return padded;
}

/**
 * Calculate checksum of a buffer (simple XOR checksum)
 * @param buffer - The buffer to checksum
 * @returns Checksum value
 */
export function simpleChecksum(buffer: Uint8Array): number {
    let checksum = 0;
    for (let i = 0; i < buffer.length; i++) {
        checksum ^= buffer[i];
    }
    return checksum;
}

/**
 * Split a buffer into chunks
 * @param buffer - The buffer to split
 * @param chunkSize - The size of each chunk
 * @returns Array of buffer chunks
 */
export function chunkBuffer(
    buffer: Uint8Array,
    chunkSize: number
): Uint8Array[] {
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < buffer.length; i += chunkSize) {
        chunks.push(buffer.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Format bytes as human-readable string
 * @param bytes - The number of bytes
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string (e.g., "1.23 KB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Auto-detect encoding format of a string
 * @param str - The string to analyze
 * @returns Detected format or 'unknown'
 */
export function detectEncoding(str: string): string {
    // Remove whitespace for testing
    const clean = str.replace(/\s/g, "");

    // Test for hex (even length, only hex chars)
    if (/^[0-9A-Fa-f]+$/.test(clean) && clean.length % 2 === 0) {
        return "hex";
    }

    // Test for binary (only 0s and 1s, multiple of 8)
    if (/^[01]+$/.test(clean) && clean.length % 8 === 0) {
        return "binary";
    }

    // Test for Base64 (standard or URL-safe)
    if (
        /^[A-Za-z0-9+/]*={0,2}$/.test(clean) ||
        /^[A-Za-z0-9_-]*$/.test(clean)
    ) {
        return "base64";
    }

    // Test for Base58
    if (
        /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(
            clean
        )
    ) {
        return "base58";
    }

    // Test for Base32
    if (/^[A-Z2-7]+=*$/.test(clean.toUpperCase())) {
        return "base32";
    }

    // Test for octal
    if (/^[0-7]+$/.test(clean) && clean.length % 3 === 0) {
        return "octal";
    }

    return "unknown";
}

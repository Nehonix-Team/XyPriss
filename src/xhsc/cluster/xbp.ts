/**
 * @file XBP.ts
 * @description 
 *
 * @copyright Copyright © 2025–2026 NEHONIX. All Rights Reserved.
 * @license NEHONIX Open Source License v2.0 (NOSL v2)
 *          https://dll.nehonix.com/licenses/NOSL/v2
 *
 * This file is part of a NEHONIX open source project.
 * You may use, modify, and redistribute it freely — including for commercial
 * purposes — provided that NEHONIX is always credited as the original author.
 *
 * @author NEHONIX
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeaderValue {
    Single: string;
}

export interface XbpRequest {
    id: string;
    method: string;
    url: string;
    remote_addr: string;
    local_addr: string;
    headers: Record<string, HeaderValue>;
    query: Record<string, string>;
    params: Record<string, string>;
    body: Buffer | null;
}

export interface XbpResponse {
    id: string;
    status: number;
    headers: Record<string, HeaderValue>;
    body: Buffer | null;
}

// ─── Reader ───────────────────────────────────────────────────────────────────

class XbpReader {
    private offset = 0;

    constructor(private readonly buf: Buffer) {}

    get position(): number {
        return this.offset;
    }

    private ensure(n: number, context: string): void {
        if (this.offset + n > this.buf.length) {
            throw new Error(
                `xbp: unexpected EOF reading ${context} (need ${n} bytes at offset ${this.offset}, have ${this.buf.length - this.offset})`,
            );
        }
    }

    readU8(context: string): number {
        this.ensure(1, context);
        return this.buf[this.offset++];
    }

    readU16(context: string): number {
        this.ensure(2, context);
        const v = this.buf.readUInt16BE(this.offset);
        this.offset += 2;
        return v;
    }

    readU32(context: string): number {
        this.ensure(4, context);
        const v = this.buf.readUInt32BE(this.offset);
        this.offset += 4;
        return v;
    }

    readStr16(context: string): string {
        const len = this.readU16(`${context} length`);
        this.ensure(len, context);
        const s = this.buf.toString("utf8", this.offset, this.offset + len);
        this.offset += len;
        return s;
    }

    readBytes(n: number, context: string): Buffer {
        this.ensure(n, context);
        const slice = this.buf.subarray(this.offset, this.offset + n);
        this.offset += n;
        return slice;
    }

    readStrMap16(context: string): Record<string, string> {
        const count = this.readU16(`${context} count`);
        const map: Record<string, string> = {};
        for (let i = 0; i < count; i++) {
            const key = this.readStr16(`${context}[${i}] key`);
            const val = this.readStr16(`${context}[${i}] value`);
            map[key] = val;
        }
        return map;
    }
}

/**
 * **XBP Binary Frame Writer — Zero-Allocation Strategy**
 *
 * Encodes XBP (XyPriss Binary Protocol) frames into a single contiguous buffer.
 *
 * ### Performance Design
 * The previous implementation pushed a new `Buffer.allocUnsafe(n)` for **every**
 * primitive written (each u8, u16, u32, and string), then called `Buffer.concat()`
 * at the very end. For a typical HTTP response with ~15 headers, this could result
 * in 50+ micro-allocations per request, creating significant GC pressure on V8.
 *
 * This implementation instead pre-allocates a single working buffer (default 8KB)
 * and writes all data at successive offsets — similar to how a C encoder works.
 * When the buffer is full, it is doubled in size (exponential growth), which
 * amortizes re-allocation cost over the life of large responses.
 *
 * ### Memory Lifecycle
 * The final `toBuffer()` call returns a **zero-copy view** (`Buffer.subarray`) of
 * the internal buffer, avoiding a final copy. The caller is responsible for
 * consuming or copying the slice before this writer is reused or garbage collected.
 */
class XbpWriter {
    private buf: Buffer;
    private offset: number = 0;

    /**
     * @param initialSize - Initial buffer capacity in bytes.
     * Default is 8192 (8KB), which is sufficient for the vast majority of HTTP
     * responses and avoids any re-allocation for typical workloads.
     */
    constructor(initialSize = 8192) {
        this.buf = Buffer.allocUnsafe(initialSize);
    }

    /** Returns the number of bytes written so far. */
    get size(): number {
        return this.offset;
    }

    /**
     * Ensures the internal buffer has at least `n` free bytes available.
     * If not, the buffer is doubled (or more) until it fits, and existing
     * data is copied to the new allocation.
     * @param n - Number of bytes to reserve.
     */
    private ensure(n: number) {
        if (this.offset + n > this.buf.length) {
            let newSize = this.buf.length * 2;
            while (this.offset + n > newSize) {
                newSize *= 2;
            }
            const newBuf = Buffer.allocUnsafe(newSize);
            this.buf.copy(newBuf, 0, 0, this.offset);
            this.buf = newBuf;
        }
    }

    /**
     * Writes an unsigned 8-bit integer (1 byte, big-endian).
     * @param v - Value between 0 and 255.
     */
    writeU8(v: number): this {
        this.ensure(1);
        this.buf[this.offset++] = v;
        return this;
    }

    /**
     * Writes an unsigned 16-bit integer (2 bytes, big-endian).
     * Used for length-prefixes on strings and header counts.
     * @param v - Value between 0 and 65535.
     */
    writeU16(v: number): this {
        this.ensure(2);
        this.buf.writeUInt16BE(v, this.offset);
        this.offset += 2;
        return this;
    }

    /**
     * Writes an unsigned 32-bit integer (4 bytes, big-endian).
     * Used for length-prefixes on body payloads.
     * @param v - Value between 0 and 2^32-1.
     */
    writeU32(v: number): this {
        this.ensure(4);
        this.buf.writeUInt32BE(v, this.offset);
        this.offset += 4;
        return this;
    }

    /**
     * Writes a UTF-8 string prefixed by its byte length as a u16.
     * Handles null/undefined gracefully by writing a zero-length prefix.
     *
     * ### Optimization Note
     * Uses `Buffer.byteLength()` to compute the UTF-8 byte count before writing,
     * then writes directly into the internal buffer with `buf.write()`. This avoids
     * creating an intermediate `Buffer.from(s, 'utf8')` allocation that the old
     * implementation performed for every single string field.
     *
     * @param s - The string to encode.
     */
    writeStr16(s: string | undefined | null): this {
        if (!s) {
            this.writeU16(0);
            return this;
        }
        const len = Buffer.byteLength(s, "utf8");
        this.writeU16(len);
        this.ensure(len);
        this.buf.write(s, this.offset, len, "utf8");
        this.offset += len;
        return this;
    }

    /**
     * Writes a raw byte buffer prefixed by its length as a u32.
     * Used for the request/response body payload.
     * Writes a zero-length prefix if the buffer is null or empty.
     *
     * ### Optimization Note
     * Uses `Buffer.copy()` to write the body directly into the internal buffer
     * without creating an intermediate concatenated buffer.
     *
     * @param b - The buffer to encode, or null for an empty body.
     */
    writeBytes32(b: Buffer | null): this {
        const len = b?.length ?? 0;
        this.writeU32(len);
        if (b && len > 0) {
            this.ensure(len);
            b.copy(this.buf, this.offset, 0, len);
            this.offset += len;
        }
        return this;
    }

    /**
     * Writes a string map (Record) as a flat list of u16-prefixed key-value pairs.
     * Expands multi-value headers (string arrays) into separate key-value entries.
     *
     * The format is: [u16: total pair count] [str16: key] [str16: value] ...
     *
     * @param map - The header/query map to encode.
     */
    writeStrMap16(map: Record<string, string | string[] | undefined>): this {
        const keys = Object.keys(map).filter(k => map[k] !== undefined && map[k] !== null);
        let totalPairs = 0;
        for (const key of keys) {
            if (Array.isArray(map[key])) {
                totalPairs += (map[key] as string[]).length;
            } else {
                totalPairs++;
            }
        }
        
        this.writeU16(totalPairs);
        for (const key of keys) {
            const val = map[key];
            if (Array.isArray(val)) {
                for (const v of val) {
                    this.writeStr16(key);
                    this.writeStr16(v);
                }
            } else {
                this.writeStr16(key);
                this.writeStr16(val as string);
            }
        }
        return this;
    }

    /**
     * Returns a zero-copy view of the written bytes.
     *
     * The returned `Buffer` is a `subarray` slice of the internal allocation,
     * meaning no data is copied. The caller must not hold a reference to the
     * returned buffer beyond the current event loop tick if this writer is reused.
     */
    toBuffer(): Buffer {
        return this.buf.subarray(0, this.offset);
    }
}

// ─── XBP constants ────────────────────────────────────────────────────────────

const XBP_TYPE_REQUEST = 0x01;
const XBP_TYPE_RESPONSE = 0x02;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Decodes a full XBP binary request frame into a structured `XbpRequest` object.
 *
 * The frame layout is:
 * ```
 * [u8: type=0x01] [str16: id] [str16: method] [str16: url]
 * [str16: remote_addr] [str16: local_addr]
 * [u16: header_count] ([u8: value_type] [str16: key] [str16: value])*
 * [strmap16: query] [strmap16: params]
 * [u32: body_len] [bytes: body]
 * ```
 *
 * Header keys are lowercased during decoding so that upstream code (e.g.
 * `XHSCRequest`) never needs to perform a secondary `toLowerCase()` pass.
 *
 * @param buffer - The raw binary buffer received over the IPC socket,
 *   starting with the `0x01` type byte.
 * @throws {Error} If the leading type byte is not `0x01`.
 */
export function decodeXbpRequest(buffer: Buffer): XbpRequest {
    const r = new XbpReader(buffer);

    const type = r.readU8("message type");
    if (type !== XBP_TYPE_REQUEST) {
        throw new Error(
            `xbp: expected request type 0x01, got 0x${type.toString(16)}`,
        );
    }

    const id = r.readStr16("id");
    const method = r.readStr16("method"); // uint16 — matches corrected Go encoder
    const url = r.readStr16("url");
    const remoteAddr = r.readStr16("remote_addr");
    const localAddr = r.readStr16("local_addr");

    // Headers: key → { Single: value }
    const headersCount = r.readU16("headers count");
    const headers: Record<string, HeaderValue> = {};
    for (let i = 0; i < headersCount; i++) {
        const key = r.readStr16(`header[${i}] key`).toLowerCase();
        r.readU8(`header[${i}] value type`); // consume value-type byte (0 = Single)
        const val = r.readStr16(`header[${i}] value`);
        headers[key] = { Single: val };
    }

    const query = r.readStrMap16("query");
    const params = r.readStrMap16("params");

    const bodyLen = r.readU32("body length");
    const body = bodyLen > 0 ? r.readBytes(bodyLen, "body") : null;

    return {
        id,
        method,
        url,
        remote_addr: remoteAddr,
        local_addr: localAddr,
        headers,
        query,
        params,
        body,
    };
}

/**
 * Encodes a Node.js response into a full XBP binary response frame.
 *
 * The frame layout is:
 * ```
 * [u8: type=0x02] [str16: id] [u16: status]
 * [strmap16: headers] [u32: body_len] [bytes: body]
 * ```
 *
 * Uses the zero-allocation `XbpWriter` internally, so the entire frame
 * is built in a single contiguous memory block with no intermediate
 * `Buffer.concat()` calls.
 *
 * @param id - The request ID to correlate with the pending request on the Go side.
 * @param status - The HTTP status code (e.g. 200, 404).
 * @param headers - Response headers map. Multi-value headers (arrays) are
 *   expanded into separate key-value pairs in the encoded frame.
 * @param bodyData - The response body as a `Buffer`, `string`, or `null`
 *   for empty bodies (e.g. 204 No Content, redirects).
 * @returns A single contiguous `Buffer` containing the full XBP frame.
 */
export function encodeXbpResponse(
    id: string,
    status: number,
    headers: Record<string, string | string[]> | null | undefined,
    bodyData: Buffer | string | null,
): Buffer {
    const bodyBuf: Buffer | null =
        bodyData == null
            ? null
            : Buffer.isBuffer(bodyData)
              ? bodyData
              : Buffer.from(bodyData, "utf8");

    const safeHeaders = (headers ?? {}) as Record<string, string | string[]>;

    const w = new XbpWriter();
    w.writeU8(XBP_TYPE_RESPONSE);
    w.writeStr16(id);
    w.writeU16(status);
    w.writeStrMap16(safeHeaders);
    w.writeBytes32(bodyBuf);

    return w.toBuffer();
}

/**
 * Decodes a full XBP binary response frame into a structured `XbpResponse` object.
 *
 * The inverse of `encodeXbpResponse`. Used by auxiliary or test clients that
 * connect to XHSC and need to decode responses in TypeScript.
 *
 * @param buffer - The raw binary buffer, starting with the `0x02` type byte.
 * @throws {Error} If the leading type byte is not `0x02`.
 */
export function decodeXbpResponse(buffer: Buffer): XbpResponse {
    const r = new XbpReader(buffer);

    const type = r.readU8("message type");
    if (type !== XBP_TYPE_RESPONSE) {
        throw new Error(
            `xbp: expected response type 0x02, got 0x${type.toString(16)}`,
        );
    }

    const id = r.readStr16("id");
    const status = r.readU16("status");

    const headersCount = r.readU16("headers count");
    const headers: Record<string, HeaderValue> = {};
    for (let i = 0; i < headersCount; i++) {
        const key = r.readStr16(`header[${i}] key`);
        const val = r.readStr16(`header[${i}] value`);
        headers[key] = { Single: val };
    }

    const bodyLen = r.readU32("body length");
    const body = bodyLen > 0 ? r.readBytes(bodyLen, "body") : null;

    return { id, status, headers, body };
}


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

// ─── Writer ───────────────────────────────────────────────────────────────────

class XbpWriter {
    private chunks: Buffer[] = [];
    private _size = 0;

    get size(): number {
        return this._size;
    }

    private push(b: Buffer): void {
        this.chunks.push(b);
        this._size += b.length;
    }

    writeU8(v: number): this {
        const b = Buffer.allocUnsafe(1);
        b[0] = v;
        this.push(b);
        return this;
    }

    writeU16(v: number): this {
        const b = Buffer.allocUnsafe(2);
        b.writeUInt16BE(v, 0);
        this.push(b);
        return this;
    }

    writeU32(v: number): this {
        const b = Buffer.allocUnsafe(4);
        b.writeUInt32BE(v, 0);
        this.push(b);
        return this;
    }

    writeStr16(s: string): this {
        const encoded = Buffer.from(s, "utf8");
        this.writeU16(encoded.length);
        this.push(encoded);
        return this;
    }

    writeBytes32(b: Buffer | null): this {
        const len = b?.length ?? 0;
        this.writeU32(len);
        if (b && len > 0) this.push(b);
        return this;
    }

    writeStrMap16(map: Record<string, string>): this {
        const keys = Object.keys(map);
        this.writeU16(keys.length);
        for (const key of keys) {
            this.writeStr16(key);
            this.writeStr16(map[key]);
        }
        return this;
    }

    toBuffer(): Buffer {
        return Buffer.concat(this.chunks, this._size);
    }
}

// ─── XBP constants ────────────────────────────────────────────────────────────

const XBP_TYPE_REQUEST = 0x01;
const XBP_TYPE_RESPONSE = 0x02;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Decodes a full XBP request frame (including the leading type byte).
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
 * Encodes a full XBP response frame (including the leading type byte).
 */
export function encodeXbpResponse(
    id: string,
    status: number,
    headers: Record<string, string> | null | undefined,
    bodyData: Buffer | string | null,
): Buffer {
    const bodyBuf: Buffer | null =
        bodyData == null
            ? null
            : Buffer.isBuffer(bodyData)
              ? bodyData
              : Buffer.from(bodyData, "utf8");

    const safeHeaders = headers ?? {};

    const w = new XbpWriter();
    w.writeU8(XBP_TYPE_RESPONSE);
    w.writeStr16(id);
    w.writeU16(status);
    w.writeStrMap16(safeHeaders);
    w.writeBytes32(bodyBuf);

    return w.toBuffer();
}

/**
 * Decodes a full XBP response frame (including the leading type byte).
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


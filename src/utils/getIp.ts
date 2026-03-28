/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */



import { XyPrisRequest } from "../types/httpServer.type";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Result enriched with metadata for observability / debugging. */
export interface GetIpResult {
    /** Resolved IP address (IPv4 or IPv6, normalised). */
    ip: string;
    /** Header / source that provided the IP. */
    source: IpSource;
}

export type IpSource =
    | "cf-connecting-ip"
    | "true-client-ip"
    | "x-real-ip"
    | "x-forwarded-for"
    | "forwarded"
    | "x-client-ip"
    | "x-cluster-client-ip"
    | "req.ip"
    | "socket"
    | "fallback";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Regex that validates a raw IPv4 or IPv6 string (no port, no brackets). */
const IPV4_RE =
    /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/;

const IPV6_RE = /^[\da-f:]+$/i;

/** Private / loopback ranges we never want to return as the *real* client IP. */
const PRIVATE_RANGES: RegExp[] = [
    /^127\./, // 127.0.0.0/8  – loopback
    /^10\./, // 10.0.0.0/8   – RFC 1918
    /^172\.(1[6-9]|2\d|3[01])\./, // 172.16.0.0/12 – RFC 1918
    /^192\.168\./, // 192.168.0.0/16 – RFC 1918
    /^169\.254\./, // 169.254.0.0/16 – link-local
    /^::1$/, // IPv6 loopback
    /^fe80:/i, // IPv6 link-local
    /^fc|^fd/i, // IPv6 unique local
];

const FALLBACK_IP = "127.0.0.1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Strips an IPv6-mapped IPv4 prefix ("::ffff:") and surrounding brackets.
 * "::ffff:1.2.3.4" → "1.2.3.4"
 * "[::1]"          → "::1"
 */
function normaliseIp(raw: string): string {
    let ip = raw.trim();
    // Strip brackets used in URLs: [::1]:3000 → ::1
    if (ip.startsWith("[")) {
        ip = ip.replace(/^\[([^\]]+)\].*$/, "$1");
    }
    // Strip port from IPv4: 1.2.3.4:3000 → 1.2.3.4
    const v4WithPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
    if (v4WithPort) ip = v4WithPort[1];
    // Strip IPv6-mapped IPv4 prefix
    if (/^::ffff:/i.test(ip)) ip = ip.slice(7);
    return ip;
}

/** Returns true only for syntactically valid, non-private IPv4 / IPv6. */
function isValidPublicIp(raw: string): boolean {
    const ip = normaliseIp(raw);
    if (!ip) return false;
    const isIpv4 = IPV4_RE.test(ip);
    const isIpv6 = !isIpv4 && IPV6_RE.test(ip);
    if (!isIpv4 && !isIpv6) return false;
    return !PRIVATE_RANGES.some((re) => re.test(ip));
}

/** Safely reads a header value – returns undefined for missing / empty. */
function header(
    headers: Record<string, string | string[] | undefined>,
    name: string,
): string | undefined {
    const val = headers[name.toLowerCase()];
    if (!val) return undefined;
    const str = Array.isArray(val) ? val[0] : val;
    return str?.trim() || undefined;
}

/**
 * Parses the RFC 7239 `Forwarded` header.
 * `Forwarded: for=1.2.3.4;proto=https, for=5.6.7.8`
 * → ["1.2.3.4", "5.6.7.8"]
 */
function parseForwardedHeader(value: string): string[] {
    return value
        .split(",")
        .map((part) => {
            const match = part.match(/for=["[]?([^\]",;]+)/i);
            return match ? normaliseIp(match[1]) : "";
        })
        .filter(Boolean);
}

/**
 * Given a comma-separated (or array) `X-Forwarded-For` header,
 * returns the first *valid public* IP, or the first entry as fallback.
 */
function pickFromXff(raw: string | string[]): string | undefined {
    const entries: string[] = (
        Array.isArray(raw) ? raw.flatMap((v) => v.split(",")) : raw.split(",")
    ).map((s) => normaliseIp(s));

    // Prefer first valid public IP (leftmost = original client in standard chains)
    const pub = entries.find(isValidPublicIp);
    if (pub) return pub;

    // Accept first private IP rather than nothing (intranet / dev env)
    const first = entries[0];
    return first && (IPV4_RE.test(first) || IPV6_RE.test(first))
        ? first
        : undefined;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Robustly extracts the **real** client IP from a request.
 *
 * Resolution order (most-specific / trustworthy first):
 *  1. `CF-Connecting-IP`     – Cloudflare; single, authoritative value
 *  2. `True-Client-IP`       – Akamai / Cloudflare enterprise
 *  3. `X-Real-IP`            – Nginx single-proxy setups
 *  4. `X-Client-IP`          – Some load balancers / Apache mod_remoteip
 *  5. `X-Cluster-Client-IP`  – Rackspace, some Nginx configs
 *  6. `Forwarded`            – RFC 7239 standard header
 *  7. `X-Forwarded-For`      – De-facto standard (picks first public IP)
 *  8. `req.ip`               – XyPrisRequest parsed value
 *  9. `socket.remoteAddress` – Raw TCP socket
 * 10. `"127.0.0.1"`          – Ultimate fallback (never throws)
 *
 * @param req       - The request object (XyPrisRequest-compatible).
 * @param enriched  - When `true`, returns `{ ip, source }` for observability.
 */
export function getIp(req: XyPrisRequest): string;
export function getIp(req: XyPrisRequest, enriched: true): GetIpResult;
export function getIp(
    req: XyPrisRequest,
    enriched?: true,
): string | GetIpResult {
    const headers = (req.headers ?? {}) as Record<
        string,
        string | string[] | undefined
    >;

    const resolve = (ip: string, source: IpSource): string | GetIpResult => {
        const normalised = normaliseIp(ip);
        return enriched ? { ip: normalised, source } : normalised;
    };

    // 1. CF-Connecting-IP
    const cfIp = header(headers, "cf-connecting-ip");
    if (cfIp) return resolve(cfIp, "cf-connecting-ip");

    // 2. True-Client-IP
    const trueClientIp = header(headers, "true-client-ip");
    if (trueClientIp) return resolve(trueClientIp, "true-client-ip");

    // 3. X-Real-IP
    const xRealIp = header(headers, "x-real-ip");
    if (xRealIp) return resolve(xRealIp, "x-real-ip");

    // 4. X-Client-IP
    const xClientIp = header(headers, "x-client-ip");
    if (xClientIp) return resolve(xClientIp, "x-client-ip");

    // 5. X-Cluster-Client-IP
    const xClusterIp = header(headers, "x-cluster-client-ip");
    if (xClusterIp) return resolve(xClusterIp, "x-cluster-client-ip");

    // 6. Forwarded (RFC 7239)
    const forwarded = header(headers, "forwarded");
    if (forwarded) {
        const [first] = parseForwardedHeader(forwarded);
        if (first) return resolve(first, "forwarded");
    }

    // 7. X-Forwarded-For
    const xForwardedFor = headers["x-forwarded-for"];
    if (xForwardedFor) {
        const picked = pickFromXff(xForwardedFor);
        if (picked) return resolve(picked, "x-forwarded-for");
    }

    // 8. req.ip (framework-level, e.g. XyPrisRequest with trust proxy)
    if (req.ip) return resolve(req.ip, "req.ip");

    // 9. Raw socket
    const socketAddr = (req.socket as any)?.remoteAddress;
    if (socketAddr) return resolve(socketAddr as string, "socket");

    // 10. Last-resort fallback
    return resolve(FALLBACK_IP, "fallback");
}

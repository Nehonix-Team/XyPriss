/**
 * Advanced Trust Proxy Implementation for XyPriss
 *
 * Supports Express-like trust proxy configurations including:
 * - Boolean values (true/false)
 * - String values ('loopback', 'linklocal', 'uniquelocal')
 * - CIDR notation ('192.168.0.0/16')
 * - IP addresses ('127.0.0.1')
 * - Arrays of the above
 * - Custom functions
 */

import { IncomingMessage } from "http";
import { isIP } from "net";

export type TrustProxyValue =
    | boolean
    | string
    | string[]
    | number
    | ((ip: string, hopIndex: number) => boolean);

/**
 * Predefined network ranges
 */
const PREDEFINED_RANGES = {
    loopback: ["127.0.0.0/8", "::1/128"],
    linklocal: ["169.254.0.0/16", "fe80::/10"],
    uniquelocal: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7"],
} as const;

export class TrustProxy {
    private trustProxyFn: (ip: string, hopIndex: number) => boolean;

    constructor(config: TrustProxyValue) {
        this.trustProxyFn = this.createTrustProxyFunction(config);
    }

    /**
     * Validate and normalize IP address string
     */
    private normalizeIP(ip: string): string | null {
        if (!ip || typeof ip !== "string") return null;

        const trimmed = ip.trim();
        if (!trimmed) return null;

        // Handle IPv4-mapped IPv6 addresses (::ffff:192.168.1.1)
        if (trimmed.startsWith("::ffff:") && trimmed.includes(".")) {
            const ipv4Part = trimmed.substring(7);
            if (isIP(ipv4Part) === 4) {
                return ipv4Part;
            }
        }

        // Validate it's a proper IP
        const ipVersion = isIP(trimmed);
        if (ipVersion === 0) return null;

        return trimmed;
    }

    /**
     * Convert IPv4 address to number for comparison
     */
    private ipv4ToNumber(ip: string): number | null {
        try {
            const parts = ip.split(".");
            if (parts.length !== 4) return null;

            const nums = parts.map((p) => {
                const num = parseInt(p, 10);
                if (isNaN(num) || num < 0 || num > 255)
                    throw new Error("Invalid octet");
                return num;
            });

            return (nums[0] << 24) + (nums[1] << 16) + (nums[2] << 8) + nums[3];
        } catch {
            return null;
        }
    }

    /**
     * Check if IPv4 address is in CIDR range
     */
    private isIPv4InCIDR(ip: string, cidr: string): boolean {
        try {
            const parts = cidr.split("/");
            if (parts.length !== 2) return false;

            const [network, prefixLength] = parts;
            const prefixLen = parseInt(prefixLength, 10);

            if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32)
                return false;

            const ipNum = this.ipv4ToNumber(ip);
            const networkNum = this.ipv4ToNumber(network);

            if (ipNum === null || networkNum === null) return false;

            // Handle edge cases
            if (prefixLen === 0) return true; // 0.0.0.0/0 matches everything
            if (prefixLen === 32) return ipNum === networkNum; // Exact match

            const mask = (0xffffffff << (32 - prefixLen)) >>> 0;

            return (ipNum & mask) === (networkNum & mask);
        } catch {
            return false;
        }
    }

    /**
     * Expand IPv6 address to full form
     */
    private expandIPv6(ip: string): string | null {
        try {
            if (!ip.includes(":")) return null;

            // Handle :: compression
            if (ip.includes("::")) {
                const parts = ip.split("::");
                if (parts.length > 2) return null; // Invalid: multiple ::

                const left = parts[0] ? parts[0].split(":") : [];
                const right = parts[1] ? parts[1].split(":") : [];
                const missing = 8 - left.length - right.length;

                if (missing < 0) return null; // Too many parts

                const middle = Array(missing).fill("0000");
                const allParts = [...left, ...middle, ...right];

                // Pad each part to 4 hex digits
                return allParts.map((p) => p.padStart(4, "0")).join(":");
            }

            // No compression
            const parts = ip.split(":");
            if (parts.length !== 8) return null;

            return parts.map((p) => p.padStart(4, "0")).join(":");
        } catch {
            return null;
        }
    }

    /**
     * Convert IPv6 address to BigInt for comparison
     */
    private ipv6ToBigInt(ip: string): bigint | null {
        try {
            const expanded = this.expandIPv6(ip);
            if (!expanded) return null;

            const parts = expanded.split(":");
            if (parts.length !== 8) return null;

            let result = 0n;

            for (let i = 0; i < 8; i++) {
                const val = parseInt(parts[i], 16);
                if (isNaN(val) || val < 0 || val > 0xffff) return null;
                result = (result << 16n) + BigInt(val);
            }

            return result;
        } catch {
            return null;
        }
    }

    /**
     * Check if IPv6 address is in CIDR range
     */
    private isIPv6InCIDR(ip: string, cidr: string): boolean {
        try {
            const parts = cidr.split("/");
            if (parts.length !== 2) return false;

            const [network, prefixLength] = parts;
            const prefixLen = parseInt(prefixLength, 10);

            if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 128)
                return false;

            const ipNum = this.ipv6ToBigInt(ip);
            const networkNum = this.ipv6ToBigInt(network);

            if (ipNum === null || networkNum === null) return false;

            // Handle edge cases
            if (prefixLen === 0) return true; // ::/0 matches everything
            if (prefixLen === 128) return ipNum === networkNum; // Exact match

            const mask =
                (BigInt(2) ** BigInt(128) - BigInt(1)) <<
                BigInt(128 - prefixLen);

            return (ipNum & mask) === (networkNum & mask);
        } catch {
            return false;
        }
    }

    /**
     * Check if IP address is in CIDR range
     */
    private isIPInCIDR(ip: string, cidr: string): boolean {
        if (!ip || !cidr) return false;

        const ipVersion = isIP(ip);
        if (ipVersion === 0) return false;

        // Determine CIDR type
        const isCIDRv4 = cidr.includes(".") && cidr.includes("/");
        const isCIDRv6 = cidr.includes(":") && cidr.includes("/");

        if (ipVersion === 4 && isCIDRv4) {
            return this.isIPv4InCIDR(ip, cidr);
        } else if (ipVersion === 6 && isCIDRv6) {
            return this.isIPv6InCIDR(ip, cidr);
        }

        return false;
    }

    /**
     * Check if IP matches a single trust proxy rule
     */
    private matchesTrustRule(ip: string, rule: string): boolean {
        if (!ip || !rule) return false;

        try {
            // Handle predefined ranges
            if (rule in PREDEFINED_RANGES) {
                const ranges =
                    PREDEFINED_RANGES[rule as keyof typeof PREDEFINED_RANGES];
                return ranges.some((range) => this.isIPInCIDR(ip, range));
            }

            // Handle CIDR notation
            if (rule.includes("/")) {
                return this.isIPInCIDR(ip, rule);
            }

            // Handle exact IP match (normalize both for comparison)
            const normalizedIP = this.normalizeIP(ip);
            const normalizedRule = this.normalizeIP(rule);

            if (!normalizedIP || !normalizedRule) return false;

            return normalizedIP === normalizedRule;
        } catch {
            return false;
        }
    }

    /**
     * Create a trust proxy function from configuration
     */
    private createTrustProxyFunction(
        config: TrustProxyValue
    ): (ip: string, hopIndex: number) => boolean {
        // Handle boolean values
        if (typeof config === "boolean") {
            return () => config;
        }

        // Handle number values (trust first N hops)
        if (typeof config === "number") {
            if (!Number.isInteger(config) || config < 0) {
                throw new Error(
                    "Trust proxy number must be a non-negative integer"
                );
            }
            return (_ip: string, hopIndex: number) => hopIndex < config;
        }

        // Handle function values
        if (typeof config === "function") {
            return (ip: string, hopIndex: number) => {
                try {
                    return Boolean(config(ip, hopIndex));
                } catch {
                    return false; // Safe default on function error
                }
            };
        }

        // Handle string values
        if (typeof config === "string") {
            const trimmed = config.trim();
            if (!trimmed) return () => false;
            return (ip: string) => this.matchesTrustRule(ip, trimmed);
        }

        // Handle array values
        if (Array.isArray(config)) {
            const validRules = config.filter(
                (rule) => typeof rule === "string" && rule.trim()
            );
            if (validRules.length === 0) return () => false;

            return (ip: string) =>
                validRules.some((rule) => this.matchesTrustRule(ip, rule));
        }

        // Default: don't trust
        return () => false;
    }

    /**
     * Safely parse X-Forwarded-For header
     */
    private parseForwardedFor(header: string | string[] | undefined): string[] {
        if (!header) return [];

        // Handle array form (shouldn't happen but be defensive)
        const headerStr = Array.isArray(header) ? header.join(",") : header;

        if (typeof headerStr !== "string") return [];

        return headerStr
            .split(",")
            .map((ip) => this.normalizeIP(ip))
            .filter((ip): ip is string => ip !== null);
    }

    /**
     * Get remote address with fallback
     */
    private getRemoteAddress(req: IncomingMessage): string {
        const remoteAddr = req.socket?.remoteAddress;
        if (!remoteAddr) return "127.0.0.1";

        const normalized = this.normalizeIP(remoteAddr);
        return normalized || "127.0.0.1";
    }

    /**
     * Extract client IP considering trust proxy configuration
     */
    public extractClientIP(req: IncomingMessage): string {
        try {
            const forwardedFor = req.headers["x-forwarded-for"];
            const ips = this.parseForwardedFor(forwardedFor);

            if (ips.length === 0) {
                // No forwarded headers, return direct connection IP
                return this.getRemoteAddress(req);
            }

            // Start from the rightmost IP (closest to server) and work backwards
            const directIP = this.getRemoteAddress(req);
            let trustedIP = directIP;

            // Process IPs from right to left (closest to server first)
            for (let i = ips.length - 1; i >= 0; i--) {
                const hopIndex = ips.length - 1 - i;
                const currentIP = ips[i];

                // Check if we trust this hop
                if (this.trustProxyFn(trustedIP, hopIndex)) {
                    trustedIP = currentIP;
                } else {
                    // Stop at first untrusted hop
                    break;
                }
            }

            return trustedIP;
        } catch {
            // On any error, return the direct connection IP as safe default
            return this.getRemoteAddress(req);
        }
    }

    /**
     * Extract all IPs in the proxy chain
     */
    public extractProxyChain(req: IncomingMessage): string[] {
        try {
            const forwardedFor = req.headers["x-forwarded-for"];
            const ips = this.parseForwardedFor(forwardedFor);
            const directIP = this.getRemoteAddress(req);

            if (ips.length === 0) {
                return [directIP];
            }

            const trustedIPs: string[] = [directIP];

            // Process IPs from right to left
            for (let i = ips.length - 1; i >= 0; i--) {
                const hopIndex = ips.length - 1 - i;
                const currentIP = ips[i];
                const previousIP = trustedIPs[trustedIPs.length - 1];

                if (this.trustProxyFn(previousIP, hopIndex)) {
                    trustedIPs.push(currentIP);
                } else {
                    break;
                }
            }

            return trustedIPs.reverse(); // Return in client -> server order
        } catch {
            return [this.getRemoteAddress(req)];
        }
    }

    /**
     * Determine if connection is secure based on trust proxy
     */
    public isSecureConnection(req: IncomingMessage): boolean {
        try {
            // Check if we have a direct TLS connection
            const socket = req.socket as any;
            if (socket?.encrypted === true) {
                return true;
            }

            // Check X-Forwarded-Proto header if we trust the proxy
            const forwardedProto = req.headers["x-forwarded-proto"];
            if (!forwardedProto) return false;

            const directIP = this.getRemoteAddress(req);
            if (!this.trustProxyFn(directIP, 0)) return false;

            // Handle both string and array forms
            const protoStr = Array.isArray(forwardedProto)
                ? forwardedProto[0]
                : forwardedProto;
            if (typeof protoStr !== "string") return false;

            // Take first value if comma-separated
            const proto = protoStr.split(",")[0].trim().toLowerCase();
            return proto === "https";
        } catch {
            return false;
        }
    }

    /**
     * Get protocol considering trust proxy
     */
    public getProtocol(req: IncomingMessage): string {
        return this.isSecureConnection(req) ? "https" : "http";
    }

    /**
     * Get hostname considering trust proxy
     */
    public getHostname(req: IncomingMessage): string {
        try {
            const directIP = this.getRemoteAddress(req);

            // Check X-Forwarded-Host if we trust the proxy
            const forwardedHost = req.headers["x-forwarded-host"];
            if (forwardedHost && this.trustProxyFn(directIP, 0)) {
                const hostStr = Array.isArray(forwardedHost)
                    ? forwardedHost[0]
                    : forwardedHost;
                if (typeof hostStr === "string" && hostStr.trim()) {
                    // Take first host if comma-separated, remove port
                    const hostname = hostStr.split(",")[0].trim().split(":")[0];
                    if (hostname) return hostname;
                }
            }

            // Fallback to Host header
            const host = req.headers.host;
            if (host && typeof host === "string") {
                const hostname = host.split(":")[0];
                if (hostname) return hostname;
            }

            return "localhost";
        } catch {
            return "localhost";
        }
    }

    /**
     * Validate trust proxy configuration
     */
    public static validate(config: TrustProxyValue): boolean {
        try {
            new TrustProxy(config);
            return true;
        } catch {
            return false;
        }
    }
}

// Convenience function exports for backwards compatibility
export function createTrustProxyFunction(
    config: TrustProxyValue
): (ip: string, hopIndex: number) => boolean {
    const trustProxy = new TrustProxy(config);
    return (ip: string, hopIndex: number) =>
        trustProxy["trustProxyFn"](ip, hopIndex);
}

export function extractClientIP(
    req: IncomingMessage,
    trustProxyFn: (ip: string, hopIndex: number) => boolean
): string {
    const trustProxy = new TrustProxy(trustProxyFn);
    return trustProxy.extractClientIP(req);
}

export function extractProxyChain(
    req: IncomingMessage,
    trustProxyFn: (ip: string, hopIndex: number) => boolean
): string[] {
    const trustProxy = new TrustProxy(trustProxyFn);
    return trustProxy.extractProxyChain(req);
}

export function isSecureConnection(
    req: IncomingMessage,
    trustProxyFn: (ip: string, hopIndex: number) => boolean
): boolean {
    const trustProxy = new TrustProxy(trustProxyFn);
    return trustProxy.isSecureConnection(req);
}

export function getProtocol(
    req: IncomingMessage,
    trustProxyFn: (ip: string, hopIndex: number) => boolean
): string {
    const trustProxy = new TrustProxy(trustProxyFn);
    return trustProxy.getProtocol(req);
}

export function getHostname(
    req: IncomingMessage,
    trustProxyFn: (ip: string, hopIndex: number) => boolean
): string {
    const trustProxy = new TrustProxy(trustProxyFn);
    return trustProxy.getHostname(req);
}

export function validateTrustProxyConfig(config: TrustProxyValue): boolean {
    return TrustProxy.validate(config);
}


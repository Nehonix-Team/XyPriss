/***************************************************************************
 * XyPriss - Fast And Secure
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

import type { IncomingMessage } from "http";
import { isIP } from "net";

export type TrustProxyValue =
    | boolean
    | string
    | string[]
    | number
    | ((ip: string, hopIndex: number) => boolean);

const PREDEFINED_RANGES = {
    loopback: ["127.0.0.0/8", "::1/128"],
    linklocal: ["169.254.0.0/16", "fe80::/10"],
    uniquelocal: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7"],
} as const;

/**
 * Cache entry structure for performance optimization.
 */
interface CacheEntry<T> {
    value: T;
    timestamp: number;
}

export class TrustProxy {
    private trustProxyFn: (ip: string, hopIndex: number) => boolean;

    // LRU Caches for performance improvement
    private readonly ipNormalizationCache = new Map<string, string | null>();
    private readonly cidrMatchCache = new Map<string, boolean>();
    private readonly ipv4NumberCache = new Map<string, number | null>();
    private readonly ipv6BigIntCache = new Map<string, bigint | null>();

    // Cache Configuration
    private readonly MAX_CACHE_SIZE = 1000;
    private readonly CACHE_TTL = 300000; // 5 minutes

    // Rule pre-compilation for performance
    private readonly compiledRules: Array<{
        type: "exact" | "cidr" | "predefined";
        value: string;
        normalized?: string;
        cidrs?: readonly string[];
    }> = [];

    constructor(config: TrustProxyValue) {
        this.trustProxyFn = this.createTrustProxyFunction(config);
        this.precompileRules(config);
    }

    /**
     * Pre-compiles trust proxy rules to optimize repeated checks.
     *
     * This method processes the initial configuration and stores it in a
     * more efficient format for runtime matching.
     *
     * @param config - The trust proxy configuration value.
     */
    private precompileRules(config: TrustProxyValue): void {
        if (typeof config === "string") {
            this.compiledRules.push(this.compileRule(config));
        } else if (Array.isArray(config)) {
            config.forEach((rule) => {
                if (typeof rule === "string" && rule.trim()) {
                    this.compiledRules.push(this.compileRule(rule));
                }
            });
        }
    }

    /**
     * Compiles an individual trust proxy rule.
     *
     * Categorizes the rule as an exact IP, a CIDR range, or a predefined network range.
     *
     * @param rule - The rule string to compile.
     * @returns A compiled rule object.
     */
    private compileRule(rule: string): {
        type: "exact" | "cidr" | "predefined";
        value: string;
        normalized?: string;
        cidrs?: readonly string[];
    } {
        const trimmed = rule.trim();

        if (trimmed in PREDEFINED_RANGES) {
            return {
                type: "predefined",
                value: trimmed,
                cidrs: PREDEFINED_RANGES[
                    trimmed as keyof typeof PREDEFINED_RANGES
                ],
            };
        }

        if (trimmed.includes("/")) {
            return { type: "cidr", value: trimmed };
        }

        const normalized = this.normalizeIP(trimmed);
        return {
            type: "exact",
            value: trimmed,
            normalized: normalized || undefined,
        };
    }

    /**
     * Maintains the cache size using a basic LRU (Least Recently Used) strategy.
     *
     * If the cache exceeds the maximum size, it removes the oldest 20% of entries.
     *
     * @param cache - The Map object acting as a cache.
     */
    private maintainCache<T>(cache: Map<string, T>): void {
        if (cache.size > this.MAX_CACHE_SIZE) {
            const keysToDelete = Array.from(cache.keys()).slice(
                0,
                Math.floor(this.MAX_CACHE_SIZE * 0.2),
            );
            keysToDelete.forEach((key) => cache.delete(key));
        }
    }

    /**
     * Performs a fast initial validation of an IP address string.
     *
     * This method uses basic string checks and regex to quickly filter out
     * obviously invalid IP formats before more expensive processing.
     *
     * @param ip - The IP address string to validate.
     * @returns True if the IP format is plausible, false otherwise.
     */
    private fastIPValidation(ip: string): boolean {
        if (!ip || ip.length === 0 || ip.length > 45) return false;

        const firstChar = ip.charCodeAt(0);

        // IPv4: starts with a digit
        if (firstChar >= 48 && firstChar <= 57) {
            return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip);
        }

        // IPv6: starts with : or a hexadecimal character
        if (
            firstChar === 58 ||
            (firstChar >= 97 && firstChar <= 102) ||
            (firstChar >= 65 && firstChar <= 70) ||
            (firstChar >= 48 && firstChar <= 57)
        ) {
            return ip.includes(":");
        }

        return false;
    }

    /**
     * Optimally normalizes an IP address with caching.
     *
     * Handles trimming, fast validation, and conversion of IPv4-mapped IPv6 addresses.
     *
     * @param ip - The raw IP address string.
     * @returns The normalized IP string or null if invalid.
     */
    private normalizeIP(ip: string): string | null {
        if (!ip || typeof ip !== "string") return null;

        // Cache check
        const cached = this.ipNormalizationCache.get(ip);
        if (cached !== undefined) return cached;

        const trimmed = ip.trim();
        if (!trimmed || !this.fastIPValidation(trimmed)) {
            this.ipNormalizationCache.set(ip, null);
            this.maintainCache(this.ipNormalizationCache);
            return null;
        }

        // IPv4-mapped IPv6
        if (trimmed.startsWith("::ffff:")) {
            const ipv4Part = trimmed.substring(7);
            if (isIP(ipv4Part) === 4) {
                this.ipNormalizationCache.set(ip, ipv4Part);
                this.maintainCache(this.ipNormalizationCache);
                return ipv4Part;
            }
        }

        const ipVersion = isIP(trimmed);
        const result = ipVersion === 0 ? null : trimmed;

        this.ipNormalizationCache.set(ip, result);
        this.maintainCache(this.ipNormalizationCache);

        return result;
    }

    /**
     * Optimally converts an IPv4 address to its numeric representation with caching.
     *
     * @param ip - The IPv4 address string.
     * @returns The numeric value or null if invalid.
     */
    private ipv4ToNumber(ip: string): number | null {
        const cached = this.ipv4NumberCache.get(ip);
        if (cached !== undefined) return cached;

        try {
            const parts = ip.split(".");
            if (parts.length !== 4) {
                this.ipv4NumberCache.set(ip, null);
                return null;
            }

            let result = 0;
            for (let i = 0; i < 4; i++) {
                const num = parseInt(parts[i], 10);
                if (isNaN(num) || num < 0 || num > 255) {
                    this.ipv4NumberCache.set(ip, null);
                    return null;
                }
                result = (result << 8) | num;
            }

            result = result >>> 0; // Conversion en unsigned 32-bit
            this.ipv4NumberCache.set(ip, result);
            this.maintainCache(this.ipv4NumberCache);
            return result;
        } catch {
            this.ipv4NumberCache.set(ip, null);
            return null;
        }
    }

    /**
     * Performs an ultra-optimized check if an IPv4 address is within a CIDR range.
     *
     * Uses bitwise operations and caching for maximum performance.
     *
     * @param ip - The IPv4 address to check.
     * @param cidr - The CIDR range string.
     * @returns True if the IP is in the range, false otherwise.
     */
    private isIPv4InCIDR(ip: string, cidr: string): boolean {
        const cacheKey = `${ip}:${cidr}`;
        const cached = this.cidrMatchCache.get(cacheKey);
        if (cached !== undefined) return cached;

        try {
            const slashIndex = cidr.indexOf("/");
            if (slashIndex === -1) {
                this.cidrMatchCache.set(cacheKey, false);
                return false;
            }

            const network = cidr.substring(0, slashIndex);
            const prefixLen = parseInt(cidr.substring(slashIndex + 1), 10);

            if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) {
                this.cidrMatchCache.set(cacheKey, false);
                return false;
            }

            const ipNum = this.ipv4ToNumber(ip);
            const networkNum = this.ipv4ToNumber(network);

            if (ipNum === null || networkNum === null) {
                this.cidrMatchCache.set(cacheKey, false);
                return false;
            }

            let result: boolean;
            if (prefixLen === 0) {
                result = true;
            } else if (prefixLen === 32) {
                result = ipNum === networkNum;
            } else {
                const mask = (0xffffffff << (32 - prefixLen)) >>> 0;
                result = (ipNum & mask) === (networkNum & mask);
            }

            this.cidrMatchCache.set(cacheKey, result);
            this.maintainCache(this.cidrMatchCache);
            return result;
        } catch {
            this.cidrMatchCache.set(cacheKey, false);
            return false;
        }
    }

    /**
     * Optimally expands a compressed IPv6 address to its full form.
     *
     * @param ip - The IPv6 address string.
     * @returns The expanded IPv6 string or null if invalid.
     */
    private expandIPv6(ip: string): string | null {
        if (!ip || !ip.includes(":")) return null;

        try {
            const doubleColonIndex = ip.indexOf("::");

            if (doubleColonIndex !== -1) {
                // Fast check for multiple ::
                if (ip.indexOf("::", doubleColonIndex + 2) !== -1) return null;

                const left =
                    doubleColonIndex > 0
                        ? ip.substring(0, doubleColonIndex).split(":")
                        : [];
                const right =
                    doubleColonIndex < ip.length - 2
                        ? ip.substring(doubleColonIndex + 2).split(":")
                        : [];

                const missing = 8 - left.length - right.length;
                if (missing < 0) return null;

                const allParts = [
                    ...left,
                    ...Array(missing).fill("0"),
                    ...right,
                ];
                return allParts.map((p) => p.padStart(4, "0")).join(":");
            }

            const parts = ip.split(":");
            if (parts.length !== 8) return null;

            return parts.map((p) => p.padStart(4, "0")).join(":");
        } catch {
            return null;
        }
    }

    /**
     * Optimally converts an IPv6 address to a BigInt representation with caching.
     *
     * @param ip - The IPv6 address string.
     * @returns The BigInt value or null if invalid.
     */
    private ipv6ToBigInt(ip: string): bigint | null {
        const cached = this.ipv6BigIntCache.get(ip);
        if (cached !== undefined) return cached;

        try {
            const expanded = this.expandIPv6(ip);
            if (!expanded) {
                this.ipv6BigIntCache.set(ip, null);
                return null;
            }

            const parts = expanded.split(":");
            if (parts.length !== 8) {
                this.ipv6BigIntCache.set(ip, null);
                return null;
            }

            let result = 0n;
            for (let i = 0; i < 8; i++) {
                const val = parseInt(parts[i], 16);
                if (isNaN(val) || val < 0 || val > 0xffff) {
                    this.ipv6BigIntCache.set(ip, null);
                    return null;
                }
                result = (result << 16n) + BigInt(val);
            }

            this.ipv6BigIntCache.set(ip, result);
            this.maintainCache(this.ipv6BigIntCache);
            return result;
        } catch {
            this.ipv6BigIntCache.set(ip, null);
            return null;
        }
    }

    /**
     * Performs an optimized check if an IPv6 address is within a CIDR range.
     *
     * Uses BigInt arithmetic and caching for performance.
     *
     * @param ip - The IPv6 address to check.
     * @param cidr - The CIDR range string.
     * @returns True if the IP is in the range, false otherwise.
     */
    private isIPv6InCIDR(ip: string, cidr: string): boolean {
        const cacheKey = `${ip}:${cidr}`;
        const cached = this.cidrMatchCache.get(cacheKey);
        if (cached !== undefined) return cached;

        try {
            const slashIndex = cidr.indexOf("/");
            if (slashIndex === -1) {
                this.cidrMatchCache.set(cacheKey, false);
                return false;
            }

            const network = cidr.substring(0, slashIndex);
            const prefixLen = parseInt(cidr.substring(slashIndex + 1), 10);

            if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 128) {
                this.cidrMatchCache.set(cacheKey, false);
                return false;
            }

            const ipNum = this.ipv6ToBigInt(ip);
            const networkNum = this.ipv6ToBigInt(network);

            if (ipNum === null || networkNum === null) {
                this.cidrMatchCache.set(cacheKey, false);
                return false;
            }

            let result: boolean;
            if (prefixLen === 0) {
                result = true;
            } else if (prefixLen === 128) {
                result = ipNum === networkNum;
            } else {
                const mask =
                    (BigInt(2) ** BigInt(128) - BigInt(1)) <<
                    BigInt(128 - prefixLen);
                result = (ipNum & mask) === (networkNum & mask);
            }

            this.cidrMatchCache.set(cacheKey, result);
            this.maintainCache(this.cidrMatchCache);
            return result;
        } catch {
            this.cidrMatchCache.set(cacheKey, false);
            return false;
        }
    }

    /**
     * Unified and optimized CIDR check for both IPv4 and IPv6.
     *
     * @param ip - The IP address to check.
     * @param cidr - The CIDR range string.
     * @returns True if the IP is in the range, false otherwise.
     */
    private isIPInCIDR(ip: string, cidr: string): boolean {
        if (!ip || !cidr) return false;

        const ipVersion = isIP(ip);
        if (ipVersion === 0) return false;

        const hasDot = cidr.includes(".");
        const hasColon = cidr.includes(":");
        const hasSlash = cidr.includes("/");

        if (!hasSlash) return false;

        if (ipVersion === 4 && hasDot) {
            return this.isIPv4InCIDR(ip, cidr);
        } else if (ipVersion === 6 && hasColon) {
            return this.isIPv6InCIDR(ip, cidr);
        }

        return false;
    }

    /**
     * Optimized rule matching using pre-compiled rules.
     *
     * This method is the core of the trust proxy matching logic,
     * leveraging pre-compiled rules and caches.
     *
     * @param ip - The IP address to check.
     * @param rule - The rule string to match against.
     * @returns True if the IP matches the rule, false otherwise.
     */
    private matchesTrustRule(ip: string, rule: string): boolean {
        if (!ip || !rule) return false;

        try {
            // Use pre-compiled rules if available
            const compiled = this.compiledRules.find((r) => r.value === rule);

            if (compiled) {
                switch (compiled.type) {
                    case "predefined":
                        return compiled.cidrs!.some((range) =>
                            this.isIPInCIDR(ip, range),
                        );

                    case "cidr":
                        return this.isIPInCIDR(ip, rule);

                    case "exact":
                        if (compiled.normalized) {
                            const normalizedIP = this.normalizeIP(ip);
                            return normalizedIP === compiled.normalized;
                        }
                        return false;
                }
            }

            // Fallback for non-pre-compiled rules
            if (rule in PREDEFINED_RANGES) {
                const ranges =
                    PREDEFINED_RANGES[rule as keyof typeof PREDEFINED_RANGES];
                return ranges.some((range) => this.isIPInCIDR(ip, range));
            }

            if (rule.includes("/")) {
                return this.isIPInCIDR(ip, rule);
            }

            const normalizedIP = this.normalizeIP(ip);
            const normalizedRule = this.normalizeIP(rule);

            return !!(
                normalizedIP &&
                normalizedRule &&
                normalizedIP === normalizedRule
            );
        } catch {
            return false;
        }
    }

    /**
     * Performs strict validation of numeric trust proxy configurations.
     *
     * @param config - The numeric configuration value.
     * @throws Error if the configuration is invalid.
     */
    private validateNumericConfig(config: number): void {
        if (!Number.isInteger(config) || config < 0 || config > 1000000) {
            throw new Error(
                "Trust proxy number must be a non-negative integer between 0 and 1000000",
            );
        }
    }

    /**
     * Optimally creates the trust proxy evaluation function based on configuration.
     *
     * @param config - The trust proxy configuration value.
     * @returns A function that takes an IP and hop index and returns a boolean.
     */
    private createTrustProxyFunction(
        config: TrustProxyValue,
    ): (ip: string, hopIndex: number) => boolean {
        if (typeof config === "boolean") {
            return () => config;
        }

        if (typeof config === "number") {
            this.validateNumericConfig(config);
            const maxHops = config;
            return (_ip: string, hopIndex: number) => hopIndex < maxHops;
        }

        if (typeof config === "function") {
            return (ip: string, hopIndex: number) => {
                try {
                    return Boolean(config(ip, hopIndex));
                } catch {
                    return false;
                }
            };
        }

        if (typeof config === "string") {
            const trimmed = config.trim();
            if (!trimmed) return () => false;
            return (ip: string) => this.matchesTrustRule(ip, trimmed);
        }

        if (Array.isArray(config)) {
            const validRules = config.filter(
                (rule) => typeof rule === "string" && rule.trim(),
            );
            if (validRules.length === 0) return () => false;

            return (ip: string) =>
                validRules.some((rule) => this.matchesTrustRule(ip, rule));
        }

        return () => false;
    }

    /**
     * Optimally parses the `X-Forwarded-For` header string.
     *
     * This method is designed for high performance, avoiding unnecessary
     * array allocations and string manipulations.
     *
     * @param header - The raw header value.
     * @returns An array of normalized IP addresses.
     */
    private parseForwardedFor(header: string | string[] | undefined): string[] {
        if (!header) return [];

        const headerStr = Array.isArray(header) ? header.join(",") : header;
        if (typeof headerStr !== "string" || headerStr.length === 0) return [];

        const result: string[] = [];
        let current = "";

        for (let i = 0; i < headerStr.length; i++) {
            const char = headerStr[i];
            if (char === ",") {
                const normalized = this.normalizeIP(current.trim());
                if (normalized) result.push(normalized);
                current = "";
            } else {
                current += char;
            }
        }

        if (current) {
            const normalized = this.normalizeIP(current.trim());
            if (normalized) result.push(normalized);
        }

        return result;
    }

    /**
     * Safely extracts the remote address from the request socket.
     *
     * @param req - The incoming HTTP request.
     * @returns The normalized remote IP address.
     */
    private getRemoteAddress(req: IncomingMessage): string {
        try {
            const socket = req.socket;
            if (!socket?.remoteAddress) return "127.0.0.1";

            const normalized = this.normalizeIP(socket.remoteAddress);
            return normalized || "127.0.0.1";
        } catch {
            return "127.0.0.1";
        }
    }

    /**
     * Validates if a protocol string is supported.
     *
     * @param proto - The protocol string.
     * @returns True if valid, false otherwise.
     */
    private isValidProtocol(proto: string): boolean {
        return (
            proto === "https" ||
            proto === "http" ||
            proto === "wss" ||
            proto === "ws"
        );
    }

    /**
     * Safely extracts the first value from a potentially comma-separated header.
     *
     * @param header - The raw header value.
     * @returns The first value or null.
     */
    private getFirstHeaderValue(
        header: string | string[] | undefined,
    ): string | null {
        if (!header) return null;

        const value = Array.isArray(header) ? header[0] : header;
        if (typeof value !== "string" || value.length === 0) return null;

        const commaIndex = value.indexOf(",");
        return commaIndex === -1
            ? value.trim()
            : value.substring(0, commaIndex).trim();
    }

    // ==================== PUBLIC METHODS ====================

    /**
     * Extracts the client's real IP address from the request, taking into account
     * the trust proxy configuration.
     *
     * It traverses the `X-Forwarded-For` chain from right to left, stopping at
     * the first untrusted hop.
     *
     * @param req - The incoming HTTP request.
     * @returns The determined client IP address.
     */
    public extractClientIP(req: IncomingMessage): string {
        try {
            const forwardedFor = req.headers["x-forwarded-for"];
            const ips = this.parseForwardedFor(forwardedFor);

            if (ips.length === 0) {
                return this.getRemoteAddress(req);
            }

            const directIP = this.getRemoteAddress(req);
            let trustedIP = directIP;

            for (let i = ips.length - 1; i >= 0; i--) {
                const hopIndex = ips.length - 1 - i;
                const currentIP = ips[i];

                if (this.trustProxyFn(trustedIP, hopIndex)) {
                    trustedIP = currentIP;
                } else {
                    break;
                }
            }

            return trustedIP;
        } catch {
            return this.getRemoteAddress(req);
        }
    }

    /**
     * Extracts the full chain of trusted proxy IP addresses.
     *
     * Returns an array of IPs starting from the client and ending with the
     * last trusted proxy.
     *
     * @param req - The incoming HTTP request.
     * @returns An array of trusted IP addresses in the proxy chain.
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

            return trustedIPs.reverse();
        } catch {
            return [this.getRemoteAddress(req)];
        }
    }

    /**
     * Determines if the connection is secure (HTTPS/WSS) based on the
     * trust proxy configuration and relevant headers.
     *
     * @param req - The incoming HTTP request.
     * @returns True if the connection is considered secure, false otherwise.
     */
    public isSecureConnection(req: IncomingMessage): boolean {
        try {
            const socket = req.socket as any;
            if (socket?.encrypted === true) {
                return true;
            }

            const directIP = this.getRemoteAddress(req);
            if (!this.trustProxyFn(directIP, 0)) return false;

            const proto = this.getFirstHeaderValue(
                req.headers["x-forwarded-proto"],
            );
            if (!proto) return false;

            const normalized = proto.toLowerCase();
            return normalized === "https" || normalized === "wss";
        } catch {
            return false;
        }
    }

    /**
     * Retrieves the protocol (http or https) for the current request.
     *
     * @param req - The incoming HTTP request.
     * @returns The protocol string.
     */
    public getProtocol(req: IncomingMessage): string {
        return this.isSecureConnection(req) ? "https" : "http";
    }

    /**
     * Retrieves the hostname for the current request, considering trust proxy
     * headers like `X-Forwarded-Host`.
     *
     * @param req - The incoming HTTP request.
     * @returns The determined hostname.
     */
    public getHostname(req: IncomingMessage): string {
        try {
            const directIP = this.getRemoteAddress(req);

            if (this.trustProxyFn(directIP, 0)) {
                const forwardedHost = this.getFirstHeaderValue(
                    req.headers["x-forwarded-host"],
                );
                if (forwardedHost) {
                    const colonIndex = forwardedHost.indexOf(":");
                    const hostname =
                        colonIndex === -1
                            ? forwardedHost
                            : forwardedHost.substring(0, colonIndex);
                    if (hostname && hostname.length > 0) return hostname;
                }
            }

            const host = req.headers.host;
            if (host && typeof host === "string") {
                const colonIndex = host.indexOf(":");
                const hostname =
                    colonIndex === -1 ? host : host.substring(0, colonIndex);
                if (hostname && hostname.length > 0) return hostname;
            }

            return "localhost";
        } catch {
            return "localhost";
        }
    }

    /**
     * Validates a trust proxy configuration value without creating an instance.
     *
     * @param config - The configuration value to validate.
     * @returns True if the configuration is valid, false otherwise.
     */
    public static validate(config: TrustProxyValue): boolean {
        try {
            new TrustProxy(config);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Clears all internal caches.
     *
     * Useful for testing or freeing up memory in long-running processes.
     */
    public clearCaches(): void {
        this.ipNormalizationCache.clear();
        this.cidrMatchCache.clear();
        this.ipv4NumberCache.clear();
        this.ipv6BigIntCache.clear();
    }

    /**
     * Returns statistics about the internal caches.
     *
     * @returns An object containing the size of each cache.
     */
    public getCacheStats(): {
        ipNormalization: number;
        cidrMatch: number;
        ipv4Number: number;
        ipv6BigInt: number;
    } {
        return {
            ipNormalization: this.ipNormalizationCache.size,
            cidrMatch: this.cidrMatchCache.size,
            ipv4Number: this.ipv4NumberCache.size,
            ipv6BigInt: this.ipv6BigIntCache.size,
        };
    }
}

// Backwards compatibility functions
/**
 * Convenience function to create a trust proxy evaluation function.
 *
 * @param config - The trust proxy configuration.
 * @returns A function that evaluates trust for a given IP and hop index.
 */
export function createTrustProxyFunction(
    config: TrustProxyValue,
): (ip: string, hopIndex: number) => boolean {
    const trustProxy = new TrustProxy(config);
    return (ip: string, hopIndex: number) =>
        trustProxy["trustProxyFn"](ip, hopIndex);
}

/**
 * Extracts the client IP using a provided trust proxy function.
 *
 * @param req - The incoming HTTP request.
 * @param trustProxyFn - The function to determine if a proxy is trusted.
 * @returns The client IP address.
 */
export function extractClientIP(
    req: IncomingMessage,
    trustProxyFn: (ip: string, hopIndex: number) => boolean,
): string {
    const trustProxy = new TrustProxy(trustProxyFn);
    return trustProxy.extractClientIP(req);
}

/**
 * Extracts the proxy chain using a provided trust proxy function.
 *
 * @param req - The incoming HTTP request.
 * @param trustProxyFn - The function to determine if a proxy is trusted.
 * @returns An array of IP addresses in the proxy chain.
 */
export function extractProxyChain(
    req: IncomingMessage,
    trustProxyFn: (ip: string, hopIndex: number) => boolean,
): string[] {
    const trustProxy = new TrustProxy(trustProxyFn);
    return trustProxy.extractProxyChain(req);
}

/**
 * Checks if the connection is secure using a provided trust proxy function.
 *
 * @param req - The incoming HTTP request.
 * @param trustProxyFn - The function to determine if a proxy is trusted.
 * @returns True if secure, false otherwise.
 */
export function isSecureConnection(
    req: IncomingMessage,
    trustProxyFn: (ip: string, hopIndex: number) => boolean,
): boolean {
    const trustProxy = new TrustProxy(trustProxyFn);
    return trustProxy.isSecureConnection(req);
}

/**
 * Gets the protocol using a provided trust proxy function.
 *
 * @param req - The incoming HTTP request.
 * @param trustProxyFn - The function to determine if a proxy is trusted.
 * @returns The protocol string.
 */
export function getProtocol(
    req: IncomingMessage,
    trustProxyFn: (ip: string, hopIndex: number) => boolean,
): string {
    const trustProxy = new TrustProxy(trustProxyFn);
    return trustProxy.getProtocol(req);
}

/**
 * Gets the hostname using a provided trust proxy function.
 *
 * @param req - The incoming HTTP request.
 * @param trustProxyFn - The function to determine if a proxy is trusted.
 * @returns The hostname.
 */
export function getHostname(
    req: IncomingMessage,
    trustProxyFn: (ip: string, hopIndex: number) => boolean,
): string {
    const trustProxy = new TrustProxy(trustProxyFn);
    return trustProxy.getHostname(req);
}

/**
 * Validates a trust proxy configuration value.
 *
 * @param config - The configuration value to validate.
 * @returns True if valid, false otherwise.
 */
export function validateTrustProxyConfig(config: TrustProxyValue): boolean {
    return TrustProxy.validate(config);
}


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
import { XyPrisRequest } from "../../types/httpServer.type";
import { Logger } from "../../shared/logger/Logger";
import { XyPrisRequestApp } from "./RequestApp";

/**
 * RequestEnhancer - Enhances the standard Node.js IncomingMessage with Express-like properties and methods.
 *
 * This class is responsible for transforming a raw HTTP request into a more
 * feature-rich XyPrisRequest. It handles URL parsing (with fallback mechanisms),
 * client IP extraction via trust proxy settings, cookie parsing, and
 * injection of application-level context.
 */
export class RequestEnhancer {
    private logger: Logger;

    // Cache for performance optimization
    private static readonly DEFAULT_HOST = "localhost";
    private static readonly DEFAULT_PATHNAME = "/";
    private static readonly COOKIE_SEPARATOR = ";";
    private static readonly XMLHTTP_REQUEST = "XMLHttpRequest";

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Enhances a standard Node.js IncomingMessage object by injecting XyPris-specific properties.
     *
     * This method performs several key operations:
     * 1. Parses the request URL to extract the pathname and query parameters.
     * 2. Injects standard Express-like properties such as `params`, `query`, `body`, and `path`.
     * 3. Uses standard headers securely passed by XHSC to extract the client's IP and protocol.
     * 4. Parses cookies from the `Cookie` header.
     * 5. Attaches a proxied `app` object for access to application settings.
     *
     * @param req - The original Node.js IncomingMessage object.
     * @param app - The application instance to be associated with the request.
     * @returns The enhanced XyPrisRequest object.
     */
    public enhance(req: IncomingMessage, app: any): XyPrisRequest {
        const { pathname, query } = this._parseUrlSafely(req);
        const XyPrisReq = this._buildBaseRequest(req, pathname, query);

        this._attachProxyProperties(req, XyPrisReq);
        this._attachExpressLikeProperties(req, XyPrisReq);
        this._attachUtilityMethods(req, XyPrisReq);

        XyPrisReq.app = new XyPrisRequestApp(app, this.logger) as any;

        return XyPrisReq;
    }

    /**
     * Parses the raw `Cookie` header string into a key-value object.
     *
     * This method follows standard cookie parsing rules, splitting by semicolons
     * and decoding URI components for both names and values.
     *
     * @param cookieHeader - The raw string from the `Cookie` HTTP header.
     * @returns A record containing all parsed cookies.
     */
    private parseCookies(cookieHeader: string): Record<string, string> {
        if (!cookieHeader || cookieHeader.length === 0) {
            return {};
        }

        const cookies: Record<string, string> = {};
        const parts = cookieHeader.split(RequestEnhancer.COOKIE_SEPARATOR);

        for (let i = 0; i < parts.length; i++) {
            const cookie = parts[i].trim();
            if (!cookie) continue;

            const eqIdx = cookie.indexOf("=");
            if (eqIdx === -1 || eqIdx === 0) continue;

            const name = cookie.substring(0, eqIdx);
            const value = cookie.substring(eqIdx + 1);

            try {
                cookies[name] = decodeURIComponent(value);
            } catch (e) {
                // If decoding fails, use the raw value as a fallback
                cookies[name] = value;
            }
        }

        return cookies;
    }

    /**
     * Safely parses the request URL using the modern WHATWG URL API.
     *
     * This method prioritizes compliance and performance by using the
     * standard URL constructor. It reconstructs the full URL using
     * trust proxy settings.
     *
     * @private
     * @param req - The incoming HTTP request object.
     * @returns An object containing the parsed pathname and query parameters.
     */
    private _parseUrlSafely(req: IncomingMessage): {
        pathname: string;
        query: Record<string, any>;
    } {
        const url = req.url || "/";

        try {
            const protocol = this.getProtocol(req);
            const host = req.headers.host || RequestEnhancer.DEFAULT_HOST;

            // Reconstruct full URL for parsing
            const fullUrl = new URL(url, `${protocol}://${host}`);

            let pathname = fullUrl.pathname;
            if (pathname.length > 1 && pathname.endsWith("/")) {
                pathname = pathname.slice(0, -1);
            }

            return {
                pathname: pathname,
                query: this._convertSearchParamsToObject(fullUrl.searchParams),
            };
        } catch (error) {
            this.logger.warn(
                "server",
                `URL parsing failed with WHATWG API: ${error}. Falling back to defaults.`,
            );

            // Return defaults if parsing completely fails
            return {
                pathname: url.split("?")[0] || RequestEnhancer.DEFAULT_PATHNAME,
                query: {},
            };
        }
    }

    /**
     * Converts `URLSearchParams` into a plain JavaScript object.
     *
     * This implementation supports multiple values for the same key by
     * automatically converting them into an array, mirroring Express behavior.
     * It is optimized to minimize unnecessary allocations.
     *
     * @private
     * @param searchParams - The search parameters to convert.
     * @returns A record containing all query parameters.
     */
    private _convertSearchParamsToObject(
        searchParams: URLSearchParams,
    ): Record<string, any> {
        const query: Record<string, any> = {};

        for (const [key, value] of searchParams.entries()) {
            const existing = query[key];

            if (existing === undefined) {
                query[key] = value;
            } else if (Array.isArray(existing)) {
                existing.push(value);
            } else {
                query[key] = [existing, value];
            }
        }

        return query;
    }

    /**
     * Constructs the base request object with fundamental properties.
     *
     * Initializes core fields such as `params`, `query`, `body`, `path`,
     * `originalUrl`, and `method`.
     *
     * @private
     * @param req - The incoming HTTP request.
     * @param pathname - The parsed URL pathname.
     * @param query - The parsed query parameters.
     * @returns The base XyPrisRequest object.
     */
    private _buildBaseRequest(
        req: IncomingMessage,
        pathname: string,
        query: Record<string, any>,
    ): XyPrisRequest {
        const XyPrisReq = req as XyPrisRequest;

        XyPrisReq.params = {};
        XyPrisReq.query = query;
        XyPrisReq.body = {};
        XyPrisReq.path = pathname;
        XyPrisReq.originalUrl = req.url || "";
        XyPrisReq.baseUrl = "";
        XyPrisReq.method = req.method || "GET";

        return XyPrisReq;
    }

    /**
     * Attaches proxy-related properties to the request.
     *
     * Relies on the standard headers set by the XHSC Go core
     * `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`, and `X-Forwarded-Host`.
     *
     * @private
     * @param req - The original HTTP request.
     * @param XyPrisReq - The enhanced request object.
     */
    private _attachProxyProperties(
        req: IncomingMessage,
        XyPrisReq: XyPrisRequest,
    ): void {
        const xRealIp = this.getFirstHeaderValue(req.headers["x-real-ip"]);
        const xForwardedFor = req.headers["x-forwarded-for"];
        const xForwardedHost = this.getFirstHeaderValue(
            req.headers["x-forwarded-host"],
        );
        const socketIp = req.socket?.remoteAddress || "127.0.0.1";

        XyPrisReq.ip =
            xRealIp || this.getFirstHeaderValue(xForwardedFor) || socketIp;

        if (xForwardedFor) {
            XyPrisReq.ips = Array.isArray(xForwardedFor)
                ? xForwardedFor
                      .join(",")
                      .split(",")
                      .map((i: string) => i.trim())
                      .filter(Boolean)
                : xForwardedFor
                      .split(",")
                      .map((i: string) => i.trim())
                      .filter(Boolean);
        } else {
            XyPrisReq.ips = [XyPrisReq.ip];
        }

        XyPrisReq.protocol = this.getProtocol(req);
        XyPrisReq.secure = XyPrisReq.protocol === "https";

        XyPrisReq.hostname = xForwardedHost || req.headers.host || "localhost";

        // Clean hostname from port if present
        if (
            XyPrisReq.hostname.includes(":") &&
            !XyPrisReq.hostname.startsWith("[")
        ) {
            XyPrisReq.hostname = XyPrisReq.hostname.split(":")[0];
        } else if (
            XyPrisReq.hostname.startsWith("[") &&
            XyPrisReq.hostname.includes("]:")
        ) {
            XyPrisReq.hostname = XyPrisReq.hostname.substring(
                1,
                XyPrisReq.hostname.indexOf("]"),
            );
        }
    }

    private getProtocol(req: IncomingMessage): string {
        const proto = this.getFirstHeaderValue(
            req.headers["x-forwarded-proto"],
        );
        if (proto) {
            return proto.toLowerCase();
        }
        return (req.socket as any)?.encrypted ? "https" : "http";
    }

    private getFirstHeaderValue(
        header: string | string[] | undefined,
    ): string | undefined {
        if (!header) return undefined;
        const value = Array.isArray(header) ? header[0] : header;
        const commaIndex = value.indexOf(",");
        return commaIndex === -1
            ? value.trim()
            : value.substring(0, commaIndex).trim();
    }

    /**
     * Attaches Express-like properties to the request.
     *
     * Injects properties such as `cookies`, `subdomains`, `fresh`, `stale`,
     * and `xhr` to provide a familiar API for developers.
     *
     * @private
     * @param req - The original HTTP request.
     * @param XyPrisReq - The enhanced request object.
     */
    private _attachExpressLikeProperties(
        req: IncomingMessage,
        XyPrisReq: XyPrisRequest,
    ): void {
        const cookieHeader = req.headers.cookie;
        XyPrisReq.cookies = cookieHeader ? this.parseCookies(cookieHeader) : {};

        XyPrisReq.subdomains = this._extractSubdomains(XyPrisReq.hostname);
        XyPrisReq.fresh = false;
        XyPrisReq.stale = true;
        XyPrisReq.xhr = this._isXmlHttpRequest(req);
    }

    /**
     * Extracts subdomains from a given hostname.
     *
     * This method is optimized to avoid unnecessary allocations for simple
     * domains (e.g., example.com) and correctly handles multi-level subdomains.
     *
     * @private
     * @param hostname - The hostname to analyze.
     * @returns An array of subdomains.
     */
    private _extractSubdomains(hostname: string): string[] {
        if (!hostname) return [];

        const parts = hostname.split(".");

        // If fewer than 3 parts, there are no subdomains (e.g., example.com)
        if (parts.length <= 2) return [];

        // Returns all parts except the last two (TLD + domain)
        return parts.slice(0, -2);
    }

    /**
     * Checks if the request is an AJAX (XMLHttpRequest) request.
     *
     * Inspects the `X-Requested-With` header for the value `XMLHttpRequest`.
     *
     * @private
     * @param req - The HTTP request object.
     * @returns True if it is an XHR request, false otherwise.
     */
    private _isXmlHttpRequest(req: IncomingMessage): boolean {
        const header = req.headers["x-requested-with"];
        return header === RequestEnhancer.XMLHTTP_REQUEST;
    }

    /**
     * Attaches utility methods to the request object.
     *
     * Currently attaches the `get()` method for case-insensitive header retrieval.
     *
     * @private
     * @param req - The original HTTP request.
     * @param XyPrisReq - The enhanced request object.
     */
    private _attachUtilityMethods(
        req: IncomingMessage,
        XyPrisReq: XyPrisRequest,
    ): void {
        XyPrisReq.get = this._createGetHeaderMethod(req);
    }

    /**
     * Creates the `req.get()` method for case-insensitive header retrieval.
     *
     * Uses a closure to capture the request context and optimize repeated
     * header lookups.
     *
     * @private
     * @param req - The original HTTP request.
     * @returns The `get()` function.
     */
    private _createGetHeaderMethod(
        req: IncomingMessage,
    ): (name: string) => string | undefined {
        return (name: string): string | undefined => {
            const headerName = name.toLowerCase();
            const value = req.headers[headerName];

            if (Array.isArray(value)) {
                return value.length > 0 ? value[0] : undefined;
            }

            return value;
        };
    }
}


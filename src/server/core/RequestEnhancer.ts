import { IncomingMessage } from "http";
import { parse as parseUrl } from "url";
import { XyPrisRequest } from "../../types/httpServer.type";
import { Logger } from "../../../shared/logger/Logger";
import { TrustProxy } from "../utils/trustProxy";
import { XyPrisRequestApp } from "./RequestApp";

/**
 * RequestEnhancer - Enhances Node.js IncomingMessage with Express-like properties
 */
export class RequestEnhancer {
    private logger: Logger;
    private trustProxy: TrustProxy;

    constructor(logger: Logger, trustProxy: TrustProxy) {
        this.logger = logger;
        this.trustProxy = trustProxy;
    }

    /**
     * Enhance the request object
     */
    public enhance(req: IncomingMessage, app: any): XyPrisRequest {
        let pathname = "/";
        let query: Record<string, any> = {};

        try {
            // Use modern URL API if possible
            const protocol = this.trustProxy.getProtocol(req);
            const host = req.headers.host || "localhost";
            const fullUrl = new URL(req.url || "", `${protocol}://${host}`);

            pathname = fullUrl.pathname;

            // Convert URLSearchParams to simple object
            for (const [key, value] of fullUrl.searchParams.entries()) {
                if (query[key]) {
                    if (Array.isArray(query[key])) {
                        query[key].push(value);
                    } else {
                        query[key] = [query[key], value];
                    }
                } else {
                    query[key] = value;
                }
            }
        } catch (error) {
            // Fallback to legacy parsing if URL constructor fails
            this.logger.warn(
                "server",
                `URL parsing failed with modern API, falling back to legacy: ${error}`
            );
            try {
                const parsedUrl = parseUrl(req.url || "", true);
                pathname = parsedUrl.pathname || "/";
                query = parsedUrl.query || {};
            } catch (legacyError) {
                this.logger.error(
                    "server",
                    `Both URL parsing methods failed: ${legacyError}`
                );
                pathname = "/";
                query = {};
            }
        }

        const XyPrisReq = req as XyPrisRequest;
        XyPrisReq.params = {};
        XyPrisReq.query = query;
        XyPrisReq.body = {};
        XyPrisReq.path = pathname;
        XyPrisReq.originalUrl = req.url || "";
        XyPrisReq.baseUrl = "";
        XyPrisReq.method = req.method || "GET";

        // Express compatibility properties using trust proxy
        XyPrisReq.ip = this.trustProxy.extractClientIP(req);
        XyPrisReq.ips = this.trustProxy.extractProxyChain(req);
        XyPrisReq.cookies = this.parseCookies(req.headers.cookie || "");
        XyPrisReq.app = new XyPrisRequestApp(app, this.logger) as any;

        // Additional Express-like properties using trust proxy
        XyPrisReq.protocol = this.trustProxy.getProtocol(req);
        XyPrisReq.secure = XyPrisReq.protocol === "https";
        XyPrisReq.hostname = this.trustProxy.getHostname(req);
        XyPrisReq.subdomains = XyPrisReq.hostname.split(".").slice(0, -2);
        XyPrisReq.fresh = false;
        XyPrisReq.stale = true;
        XyPrisReq.xhr = req.headers["x-requested-with"] === "XMLHttpRequest";

        // Express compatibility method - get header
        XyPrisReq.get = (name: string): string | undefined => {
            const headerName = name.toLowerCase();
            const value = req.headers[headerName];
            if (Array.isArray(value)) {
                return value[0];
            }
            return value;
        };

        return XyPrisReq;
    }

    /**
     * Parse cookies from cookie header
     */
    private parseCookies(cookieHeader: string): Record<string, string> {
        const cookies: Record<string, string> = {};

        if (!cookieHeader) {
            return cookies;
        }

        cookieHeader.split(";").forEach((cookie) => {
            const [name, ...rest] = cookie.trim().split("=");
            if (name && rest.length > 0) {
                cookies[name] = decodeURIComponent(rest.join("="));
            }
        });

        return cookies;
    }
}


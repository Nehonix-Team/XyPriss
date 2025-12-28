import { ServerResponse } from "http";
import { XyPrisResponse, XyPrisRequest } from "../../types/httpServer.type";
import { Logger } from "../../../shared/logger/Logger";

/**
 * ResponseEnhancer - Enhances Node.js ServerResponse with Express-like methods
 */
export class ResponseEnhancer {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    /**
     * Enhance the response object
     */
    public enhance(res: ServerResponse, req: XyPrisRequest): XyPrisResponse {
        const XyPrisRes = res as XyPrisResponse;
        XyPrisRes.locals = {};

        // JSON response method
        XyPrisRes.json = (data: any) => {
            if (XyPrisRes.writableEnded) {
                this.logger.error(
                    "server",
                    `[HttpServer] res.json() called after response already finished (${req.method} ${req.path}).`
                );
                return;
            }
            XyPrisRes.setHeader("Content-Type", "application/json");
            XyPrisRes.end(JSON.stringify(data));
        };

        // Send method
        XyPrisRes.send = (data: any) => {
            if (XyPrisRes.writableEnded) {
                this.logger.error(
                    "server",
                    `[HttpServer] res.send() called after response already finished (${req.method} ${req.path}).`
                );
                return;
            }
            if (typeof data === "object") {
                XyPrisRes.json(data);
            } else {
                XyPrisRes.end(String(data));
            }
        };

        // Status method
        XyPrisRes.status = (code: number) => {
            XyPrisRes.statusCode = code;
            return XyPrisRes;
        };

        // Enhanced setHeader that returns this
        const originalSetHeader = XyPrisRes.setHeader.bind(XyPrisRes);
        XyPrisRes.setHeader = (
            name: string,
            value: string | number | readonly string[]
        ) => {
            if (!XyPrisRes.headersSent) {
                originalSetHeader(name, value);
            }
            return XyPrisRes;
        };

        // Set method (Express-compatible)
        XyPrisRes.set = (
            field: string | Record<string, any>,
            value?: string | number | readonly string[]
        ) => {
            if (typeof field === "string" && value !== undefined) {
                XyPrisRes.setHeader(field, value);
            } else if (typeof field === "object") {
                Object.entries(field).forEach(([key, val]) => {
                    XyPrisRes.setHeader(
                        key,
                        val as string | number | readonly string[]
                    );
                });
            }
            return XyPrisRes;
        };

        // Redirect method
        XyPrisRes.redirect = (statusOrUrl: number | string, url?: string) => {
            if (typeof statusOrUrl === "number" && url) {
                XyPrisRes.statusCode = statusOrUrl;
                XyPrisRes.setHeader("Location", url);
            } else {
                XyPrisRes.statusCode = 302;
                XyPrisRes.setHeader("Location", statusOrUrl as string);
            }
            XyPrisRes.end();
        };

        // Cookie methods (robust implementation)
        XyPrisRes.cookie = (name: string, value: string, options: any = {}) => {
            let cookieString = `${name}=${encodeURIComponent(value)}`;

            if (options.maxAge) cookieString += `; Max-Age=${options.maxAge}`;
            if (options.expires)
                cookieString += `; Expires=${options.expires.toUTCString()}`;
            if (options.httpOnly) cookieString += "; HttpOnly";
            if (options.secure) cookieString += "; Secure";
            if (options.path) cookieString += `; Path=${options.path}`;
            else cookieString += "; Path=/";

            if (options.domain) cookieString += `; Domain=${options.domain}`;
            if (options.sameSite) {
                const sameSite =
                    typeof options.sameSite === "string"
                        ? options.sameSite.toLowerCase()
                        : options.sameSite;

                switch (sameSite) {
                    case "lax":
                        cookieString += "; SameSite=Lax";
                        break;
                    case "strict":
                        cookieString += "; SameSite=Strict";
                        break;
                    case "none":
                        cookieString += "; SameSite=None";
                        break;
                    default:
                        cookieString += `; SameSite=${options.sameSite}`;
                }
            }

            const existingCookies =
                (XyPrisRes.getHeader("Set-Cookie") as string[]) || [];
            const cookiesArray = Array.isArray(existingCookies)
                ? existingCookies
                : [existingCookies as any];
            cookiesArray.push(cookieString);
            XyPrisRes.setHeader("Set-Cookie", cookiesArray);
        };

        XyPrisRes.clearCookie = (name: string, options: any = {}) => {
            XyPrisRes.cookie(name, "", {
                ...options,
                maxAge: 0,
                expires: new Date(0),
            });
        };

        // Express compatibility method - get header
        XyPrisRes.get = (
            name: string
        ): string | number | string[] | undefined => {
            return XyPrisRes.getHeader(name);
        };

        return XyPrisRes;
    }
}


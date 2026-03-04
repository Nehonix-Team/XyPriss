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

import { IncomingMessage, ServerResponse } from "http";
import { XemsRunner } from "../plugins/modules";

export interface UFAppReqw {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
    pluginManager?: any;
    xems?: XemsRunner;
    [key: string]: any;
}

/**
 * XyPriss Request interface (Express-compatible)
 */

export interface XyPrisRequest extends IncomingMessage {
    params: Record<string, string>;
    query: Record<string, any>;
    body: any;
    path: string;
    originalUrl: string;
    baseUrl: string;
    route?: any;
    session?: any;
    user?: any;
    headers: IncomingMessage["headers"];
    method: string;
    url: string;

    // Express compatibility properties
    ip: string;
    ips: string[];
    cookies: Record<string, string>;
    app: UFAppReqw;

    // Additional properties
    protocol: string;
    secure: boolean;
    hostname: string;
    subdomains: string[];
    fresh: boolean;
    stale: boolean;
    xhr: boolean;

    // Express compatibility methods
    get: (name: string) => string | undefined;

    /**
     * Redirect the current request to another URL.
     * This is a DX (Developer Experience) convenience alias for `res.redirect()`.
     *
     * **Difference between `req.redirect` and `res.redirect`:**
     * - `res.redirect()`: Standard HTTP way to respond with a redirect.
     * - `req.redirect()`: Utility alias to trigger a redirect when you only have access
     *   to the request object, or for semantic consistency with `req.forward()`.
     *
     * Both methods perform the exact same action: sending a 301/302 response and ending it.
     *
     * @param url - The target URL (relative or absolute).
     * @param status - HTTP status code (default: 302).
     *
     * @example
     * ```typescript
     * // Using req as a controller shortcut
     * if (!user.isAdmin) return req.redirect("/login");
     * ```
     */
    redirect(url: string): void;
    redirect(status: number, url: string): void;

    /**
     * **Server-Side Forward (req.forward)**
     *
     * Asynchronously forwards the current request to another endpoint (internal path or external URL)
     * and returns the response data. This is NOT a browser-side redirect; the operation
     * happens entirely on the server.
     *
     * **Features:**
     * - **Data Continuity**: By default, it inherits method, body, and headers from the original request.
     * - **Auto-resolution**: Paths like `/api/v1` are automatically resolved against `localhost:[current_port]`.
     * - **Auto-parsing**: Automatically parses JSON responses if the `Content-Type` is `application/json`.
     *
     * @param url - Target path (e.g., "/internal-api") or full URL.
     * @param options - Optional overrides (method, headers, body, or any `fetch` option).
     * @returns Promise resolving to the parsed body (Object for JSON, string for text).
     *
     * @example
     * ```typescript
     * app.get("/profile", async (req, res) => {
     *    // Forward request to an internal auth service to get user details
     *    const user = await req.forward("/internal/auth/check");
     *
     *    if (user.isBlocked) return res.status(403).send("Blocked");
     *    res.render("profile", { user });
     * });
     * ```
     */
    forward<T = any>(url: string, options?: any): Promise<T>;
}

/**
 * XyPriss Response interface (Express-compatible)
 */
export interface XyPrisResponse extends ServerResponse {
    json<T>(data: T): void;
    html(htmlString: string): void;
    send<T>(data: T): void;
    status(code: number): XyPrisResponse;
    setHeader(name: string, value: string | number | readonly string[]): this;
    getHeader(name: string): string | number | string[] | undefined;
    removeHeader(name: string): void;
    set(
        field: string | Record<string, any>,
        value?: string | number | readonly string[],
    ): XyPrisResponse;
    redirect(url: string): void;
    redirect(status: number, url: string): void;
    cookie(name: string, value: string, options?: any): void;
    clearCookie(name: string, options?: any): void;
    locals: Record<string, any>;
    headersSent: boolean;

    // Express compatibility methods
    get: (name: string) => string | number | string[] | undefined;

    /**
     * The XJson API is an advanced JSON response handler
     * designed to solve serialization issues and handle
     * large data responses without limitations. It provides
     * enhanced JSON serialization capabilities that overcome
     * common problems with standard JSON responses, particularly
     * for complex data structures and large payloads.
     * @see {@link https://xypriss.nehonix.com/docs/XJSON_API?kw=XJson%20API}
     */

    xJson<T>(data: T): void;
    /**
     * Initializes a secure XEMS session and links it to the response.
     * This automatically generates a token, stores the data in the "XEMS" core,
     * and sets the necessary security headers and cookies.
     * @param data The data to store in the session
     * @param sandbox Optional sandbox name to use (defaults to configuration)
     */
    xLink(data: any, sandbox?: string): Promise<string>;
    xUnlink(): Promise<void>;
}

/**
 * Middleware function type
 */
export type MiddlewareFunction = (
    req: XyPrisRequest,
    res: XyPrisResponse,
    next: NextFunction,
) => void | Promise<void>;

/**
 * Next function type
 */
export type NextFunction = (error?: any) => void;

/**
 * Route handler type
 */
export type RouteHandler = (
    req: XyPrisRequest,
    res: XyPrisResponse,
    next?: NextFunction,
) => void | Promise<void>;

/**
 * Route definition
 */
export interface Route {
    method: string;
    path: string | RegExp;
    handler: RouteHandler;
    middleware: MiddlewareFunction[];
    paramNames?: string[]; // Parameter names for RegExp routes
    target?: string; // "js" | "static" | etc.
    filePath?: string; // Path to static file if target is "static"
}


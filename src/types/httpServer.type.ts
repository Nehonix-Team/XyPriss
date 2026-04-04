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
import { XemsRunner } from "../plugins/builtin/xems/XemsPlugin";

export interface XyAppInternal {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
    pluginManager?: any;
    xems?: XemsRunner;
    [key: string]: any;
}

export interface IFile {
    fieldname: string;
    originalname: string;
    encoding: "7bit" | "8bit" | "binary" | string;
    mimetype: `${string}/${string}`; // ex: application/pdf, image/png
    destination: string;
    filename: string;
    path: string;
    size: number; // en bytes
    [key: string]: any;
}

/**
 * XyPriss Request interface (Express-compatible)
 */

export interface XyPrisRequest extends IncomingMessage {
    params: Record<string, string>;
    query: Record<string, any>;
    body: any;
    files?: IFile[];
    file?: IFile;
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
    app: XyAppInternal;

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

export interface SendFileOptions {
    maxAge?: number;
    headers?: Record<string, string>;
    root?: string;
    /**
     * "inline"     → browser renders the file (default)
     * "attachment" → browser downloads the file
     * string       → treated as custom filename, forces attachment
     */
    disposition?: "inline" | "attachment" | string;
    /** Override or extend the built-in MIME map for this request. */
    mimeOverrides?: Record<string, string>;
}

/**
 * XyPriss Response interface (Express-compatible)
 */
export interface XyPrisResponse extends ServerResponse {
    /**
     * Serializes `data` to JSON and sends it as the response body with
     * `Content-Type: application/json`.
     *
     * @param data - The value to serialize. Must be JSON-serializable.
     *               Use {@link xJson} instead if `data` may contain circular references.
     *
     * @typeParam T - The type of the value being serialized.
     *
     * @example
     * res.json({ id: 1, name: "Alice" });
     */
    json<T>(data: T): void;
    /**
     * Sends an HTML response to the client.
     * @param htmlString - The HTML string to send.
     */
    html(htmlString: string): void;
    /**
     * Sends a response to the client.
     * @param data - The data to send.
     */
    send<T>(data: T): void;
    /**
     * Sends a file to the client.
     * @param filePath - The path to the file to send.
     * @param options - Optional send file options.
     */
    sendFile(filePath: string, options?: SendFileOptions): Promise<void> | void;
    /**
     * Sets the HTTP status code for the response.
     * @param code - The HTTP status code.
     */
    status(code: number): XyPrisResponse;
    /**
     * Sets a response header.
     * @param name - The header name.
     * @param value - The header value.
     */
    setHeader(name: string, value: string | number | readonly string[]): this;
    /**
     * Gets a response header.
     * @param name - The header name.
     * @returns The header value.
     */
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
    xLink<T>(
        data: T,
        options?:
            | { sandbox?: string; attachTo?: string; ttl?: string }
            | string,
    ): Promise<string>;
    xUnlink(
        options?: { sandbox?: string; attachTo?: string } | string,
    ): Promise<void>;
    /**
     * Sends a successful JSON response with a message and optional data.
     * @param message - Success message.
     * @param data - Optional data payload.
     */
    success(message: string, data?: any): void;
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


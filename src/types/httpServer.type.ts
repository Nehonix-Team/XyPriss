import { IncomingMessage, ServerResponse } from "http";

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
    app: {
        get: (key: string) => any;
        set: (key: string, value: any) => void;
        pluginManager?: any;
    };

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
}

/**
 * XyPriss Response interface (Express-compatible)
 */
export interface XyPrisResponse extends ServerResponse {
    json<T>(data: T): void;
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


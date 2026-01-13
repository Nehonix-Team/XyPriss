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
    json(data: any): void;
    send(data: any): void;
    status(code: number): XyPrisResponse;
    setHeader(name: string, value: string | number | readonly string[]): this;
    getHeader(name: string): string | number | string[] | undefined;
    removeHeader(name: string): void;
    set(
        field: string | Record<string, any>,
        value?: string | number | readonly string[]
    ): XyPrisResponse;
    redirect(url: string): void;
    redirect(status: number, url: string): void;
    cookie(name: string, value: string, options?: any): void;
    clearCookie(name: string, options?: any): void;
    locals: Record<string, any>;
    headersSent: boolean;

    // Express compatibility methods
    get: (name: string) => string | number | string[] | undefined;

    // XJson method for handling large data
    xJson(data: any): void;
}

/**
 * Middleware function type
 */
export type MiddlewareFunction = (
    req: XyPrisRequest,
    res: XyPrisResponse,
    next: NextFunction
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
    next?: NextFunction
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


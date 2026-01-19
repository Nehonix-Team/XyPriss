import { MiddlewareFunction, RouteHandler } from "./httpServer.type";

export interface RouteDefinition {
    method: string;
    path: string;
    handler: RouteHandler;
    middleware: MiddlewareEntry[];
    pattern?: RegExp;
    paramNames?: string[];
}

export interface RouterOptions {
    caseSensitive?: boolean;
    mergeParams?: boolean;
    strict?: boolean;
}

export interface RouteMatch {
    matched: boolean;
    params?: Record<string, string>;
}

export interface MiddlewareEntry {
    path?: string;
    handler: MiddlewareFunction;
}


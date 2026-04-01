import {
    RouteHandler as IRouteHandler,
    MiddlewareFunction as IMiddlewareFunction,
    XyPrisRequest as IXyPrisRequest,
    XyPrisResponse as IXyPrisResponse,
} from "../../../types/httpServer.type";
import {
    RouteDefinition,
    RouterOptions,
    MiddlewareEntry,
} from "../../../types/XyPrissRouter.types";

export type RouteHandler = IRouteHandler;
export type MiddlewareFunction = IMiddlewareFunction;
export type XyPrisRequest = IXyPrisRequest;
export type XyPrisResponse = IXyPrisResponse;
export type { XyPrisRequest as XRequest, XyPrisResponse as XResponse };

/** Param type constraint descriptor */
export type ParamType =
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "uuid"
    | "alpha"
    | "alphanumeric"
    | `string(${number},${number})` // min,max length
    | `number(${number},${number})` // min,max value
    | `enum(${string})`; // comma-separated allowed values

/** A declarative guard: returns true to allow, false/string to deny */
export type RouteGuard = (
    req: XyPrisRequest,
    res: XyPrisResponse,
) => boolean | string | Promise<boolean | string>;

/** Named built-in guards for common patterns */
export interface BuiltInGuards {
    authenticated?: boolean;
    roles?: string[];
    permissions?: string[];
    /** Custom guard functions, evaluated after built-in ones */
    custom?: RouteGuard[];
}

/** Per-route rate limit config */
export interface RoutRateLimit {
    /** Max requests allowed in window */
    max: number;
    /** Time window, e.g. "1m", "30s", "1h" */
    window?: string;
    /** Time window in milliseconds (optional, takes precedence over window) */
    windowMs?: number;
    /** Custom error message */
    message?: string;
    /** Key extractor — defaults to IP */
    keyBy?: "ip" | "user" | ((req: XyPrisRequest) => string);
}

/** Declarative cache config */
export type RouteCache =
    | string // shorthand: "5m", "1h", "30s"
    | {
          ttl: number; // seconds
          vary?: string[]; // vary by headers
          key?: (req: XyPrisRequest) => string; // custom cache key
          invalidateOn?: string[]; // event names that bust the cache
      };

/** Lifecycle hooks scoped to a single route */
export interface RouteLifecycle {
    /** Called before the handler chain. Can modify req/res or abort. */
    beforeEnter?: (
        req: XyPrisRequest,
        res: XyPrisResponse,
        next: () => void,
    ) => void | Promise<void>;
    /** Called after a successful response. For metrics / logging. */
    afterLeave?: (
        req: XyPrisRequest,
        res: XyPrisResponse,
        durationMs: number,
    ) => void | Promise<void>;
    /** Route-level error handler */
    onError?: (
        err: unknown,
        req: XyPrisRequest,
        res: XyPrisResponse,
        next: () => void,
    ) => void | Promise<void>;
}

/** Route metadata for docs / OpenAPI / registry */
export interface RouteMeta {
    summary?: string;
    description?: string;
    tags?: string[];
    /** Semver or numeric API version */
    version?: string;
    /** Mark as deprecated with optional sunset date */
    deprecated?:
        | boolean
        | { since?: string; sunset?: string; replacement?: string };
    /** Mark as internal (excluded from public docs) */
    internal?: boolean;
    /** Arbitrary key-value pairs for plugins */
    [key: string]: unknown;
}

/** Condition deciding whether a route is active */
export type RouteCondition =
    | boolean
    | (() => boolean)
    | { env?: string | string[]; feature?: string };

/** Full rich route options */
export interface RichRouteOptions {
    guards?: BuiltInGuards | RouteGuard[];
    lifecycle?: RouteLifecycle;
    rateLimit?: RoutRateLimit;
    cache?: RouteCache;
    meta?: RouteMeta;
    /** Explicit priority (higher = matched first). Default: 0 */
    priority?: number;
    /** Whether this route is active. Default: true */
    active?: RouteCondition;
}

/** Internal extended route definition */
export interface RichRouteDefinition extends RouteDefinition {
    guards?: BuiltInGuards | RouteGuard[];
    lifecycle?: RouteLifecycle;
    rateLimit?: RoutRateLimit;
    cache?: RouteCache;
    meta?: RouteMeta;
    priority: number;
    active: boolean;
    /** Full original path string (before regex compile) */
    originalPath: string;
    /** Typed param constraints extracted from path */
    paramConstraints: Record<string, ParamConstraint>;
    /** API version extracted from meta or path */
    version?: string;
    /** Unique route ID for registry */
    id: string;
}

export interface ParamConstraint {
    name: string;
    type: string;
    options?: unknown;
}

/** Group config passed to router.group() */
export interface RouteGroupOptions {
    prefix?: string;
    middleware?: MiddlewareFunction[];
    guards?: BuiltInGuards | RouteGuard[];
    meta?: Partial<RouteMeta>;
    rateLimit?: RoutRateLimit;
    /** API version prefix, e.g. "v1" → prepends /v1 */
    version?: string;
    active?: RouteCondition;
}

/** Registry entry type (for OpenAPI / docs) */
export interface RouteRegistryEntry {
    id: string;
    method: string;
    path: string;
    version?: string;
    meta?: RouteMeta;
    hasGuards: boolean;
    hasRateLimit: boolean;
    hasCache: boolean;
    paramNames?: string[];
    paramConstraints: Record<string, ParamConstraint>;
}


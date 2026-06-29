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

/**
 * Declarative guard configuration for a route or group.
 *
 * Built-in properties (`authenticated`, `roles`, `permissions`) are resolved
 * automatically by the framework using resolvers registered via `XyGuard.define()`.
 *
 * Custom guards can be declared using any additional string key. The key must
 * correspond to a resolver registered via `XyGuard.define(name, resolver)`.
 * If no resolver is found for a key, it is silently ignored.
 *
 * @example
 * ```typescript
 * // Register a custom guard globally (e.g. in server.ts)
 * XyGuard.define("ipWhitelist", (req) => {
 *     return req.ip === "127.0.0.1" ? true : "Forbidden IP";
 * });
 *
 * // Use it declaratively alongside built-ins
 * router.get("/admin", {
 *     guards: {
 *         authenticated: true,
 *         roles: ["admin"],
 *         ipWhitelist: true,
 *     },
 * }, handler);
 * ```
 *
 * @remarks
 * BREAKING CHANGE (v2): The `custom` property has been removed.
 * Inline guard arrays must now be passed directly as the value of `guards`
 * instead of being nested inside `custom`.
 *
 * @example
 * ```typescript
 * // Before (v1 — no longer supported)
 * guards: { authenticated: true, custom: [myGuardFn] }
 *
 * // After (v2 — use the array form directly)
 * guards: [myGuardFn]
 *
 * // Or register the guard globally and use the declarative key form
 * XyGuard.define("myGuard", myGuardFn);
 * guards: { authenticated: true, myGuard: true }
 * ```
 */
export type BuiltInGuards = {
    /**
     * Requires the request to be authenticated.
     * The resolver must be registered via `XyGuard.define("authenticated", ...)`.
     * Returns `true` to allow, `false` to block with 403, or a `string` to block with 401.
     */
    authenticated?: boolean;

    /**
     * Restricts access to the specified roles.
     * The resolver must be registered via `XyGuard.define("roles", ...)`.
     * The resolver receives the required roles array as a second argument.
     */
    roles?: string[];

    /**
     * Restricts access to the specified permissions.
     * The resolver must be registered via `XyGuard.define("permissions", ...)`.
     * The resolver receives the required permissions array as a second argument.
     */
    permissions?: string[];

    /**
     * @deprecated Removed in v2. The `custom` property no longer exists.
     *
     * Migrate by passing guard functions directly as the `guards` array, or by
     * registering them as named guards via `XyGuard.define()`.
     *
     * @example
     * ```typescript
     * // Before (v1 — triggers a TypeScript error)
     * guards: { authenticated: true, custom: [myGuardFn] }
     *
     * // After — option 1: array form
     * guards: [myGuardFn]
     *
     * // After — option 2: named declarative form
     * XyGuard.define("myGuard", myGuardFn);
     * guards: { authenticated: true, myGuard: true }
     * ```
     */
    custom?: never;
} & CustomGuards & Record<string, any>;

/**
 * Interface for TypeScript Declaration Merging.
 * Developers can augment this interface in their project to get auto-completion
 * for their custom guards.
 *
 * @example
 * ```typescript
 * declare module "xypriss" {
 *     interface CustomGuards {
 *         ipWhitelist?: boolean;
 *         plan?: "free" | "premium";
 *     }
 * }
 * ```
 */
export interface CustomGuards {}
 
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
    /** Explicitly defined responses for documentation */
    responses?: Record<string, { description: string }>;
    /** Arbitrary key-value pairs for plugins */
    [key: string]: unknown;
}

/** Condition deciding whether a route is active */
export type RouteCondition =
    | boolean
    | (() => boolean)
    | { env?: string | string[]; feature?: string };

/** 
 * **Comprehensive route configuration object.**
 * Provides full control over the route's lifecycle, security, caching, and matching behavior.
 */
export interface RichRouteOptions {
    /** 
     * **Declarative Security Guards.**
     * Injects protection layers before the controller execution.
     * Supports built-ins (`authenticated`, `roles`) as well as custom-defined guards.
     * 
     * @example 
     * ```ts
     * guards: { 
     *     authenticated: true, 
     *     roles: ["admin", "super-admin"], 
     *     customIpWhitelist: true 
     * }
     * ```
     */
    guards?: BuiltInGuards | RouteGuard[];
    
    /** 
     * **Lifecycle Hooks.**
     * Attach custom logic to specific stages of the route's execution.
     * Includes `beforeEnter`, `afterLeave` (with execution duration), and `onError`.
     * 
     * @example
     * ```ts
     * lifecycle: {
     *     beforeEnter: (req, res, next) => {
     *         if (req.headers["x-block"]) return res.status(403).send("Blocked");
     *         next();
     *     },
     *     afterLeave: (req, res, durationMs) => {
     *         console.log(`Request completed in ${durationMs}ms`);
     *     },
     *     onError: (err, req, res, next) => {
     *         res.status(500).json({ error: "Custom error handler" });
     *     }
     * }
     * ```
     */
    lifecycle?: RouteLifecycle;
    
    /** 
     * **Route-specific Rate Limiting.**
     * Protect this endpoint from abuse by restricting the maximum number of requests.
     * 
     * @example 
     * ```ts
     * rateLimit: { 
     *     max: 100, 
     *     window: "1m", // or windowMs: 60000
     *     message: "Too many requests, try again later.",
     *     keyBy: (req) => req.headers["x-api-key"] as string // Defaults to "ip"
     * }
     * ```
     */
    rateLimit?: RoutRateLimit;
    
    /** 
     * **Response Caching Strategy.**
     * Declaratively cache the response of this route to improve performance.
     * 
     * @example 
     * ```ts
     * // Shorthand (string):
     * cache: "5m"
     * 
     * // Advanced:
     * cache: { 
     *     ttl: 300, // seconds
     *     vary: ["Authorization", "Accept-Language"], 
     *     key: (req) => `custom_key_${req.query.id}`
     * }
     * ```
     */
    cache?: RouteCache;
    
    /** 
     * **Route Metadata.**
     * Used for OpenAPI generation, tagging, versioning, or attaching custom 
     * payload data accessible by plugins.
     * 
     * @example
     * ```ts
     * meta: {
     *     summary: "Get User Profile",
     *     description: "Fetches the profile details of the authenticated user.",
     *     tags: ["Users", "Profile"],
     *     version: "v2",
     *     deprecated: { since: "2.5", sunset: "2027-01-01", replacement: "/v3/user/profile" },
     *     internal: false
     * }
     * ```
     */
    meta?: RouteMeta;
    
    /** 
     * **Router Resolution Priority.**
     * Determines the evaluation order when multiple routes could match.
     * A higher number means higher priority.
     * 
     * @default 0
     * @example priority: 100
     */
    priority?: number;
    
    /** 
     * **Dynamic Activation (Feature Flagging).**
     * Determines if this route is exposed. If evaluated to `false`, the route 
     * is completely ignored by the engine (returns 404 Not Found).
     * 
     * @default true
     * @example 
     * ```ts
     * // Static boolean
     * active: false 
     * 
     * // Dynamic function (using Environment Security Shield)
     * active: () => __sys__.__env__.get("ENABLE_BETA") === "true"
     * 
     * // Environment/Feature-based config
     * active: { env: ["development", "staging"], feature: "new-admin-panel" }
     * ```
     */
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
    /** Detected or explicitly defined responses */
    responses?: Record<string, { description: string }>;
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
    /** Detected or explicitly defined responses */
    responses?: Record<string, { description: string }>;
}


import { XyPrisRequest, XyPrisResponse } from "./types";

/** Context object passed as second argument to custom guard resolvers */
export interface XyGuardContext {
    res?: XyPrisResponse;
    [key: string]: any;
}

/** Supported built-in guard names */
export type BuiltInGuardName = "authenticated" | "roles" | "permissions";

export type GuardResolver = (
    req: XyPrisRequest,
    ctxOrOptions?: any,
    ctx?: XyGuardContext,
) => boolean | string | Promise<boolean | string>;

/**
 * XyGuard - Global registry for built-in guard resolvers.
 * This allows XyPriss to handle declarative guards like 'authenticated' or 'roles'
 * without being opinionated about the underlying implementation (session, JWT, etc.).
 *
 * @example
 * ```typescript
 * import { XyGuard } from "xypriss";
 *
 * XyGuard.define('authenticated', (req, ctx) => !!req.user);
 * XyGuard.define('roles', (req, required, ctx) => required.includes(req.user?.role));
 * ```
 */
export class XyGuard {
    private static resolvers = new Map<string, GuardResolver>();

    /**
     * Define a resolver for the 'authenticated' guard.
     */
    public static define(
        name: "authenticated",
        resolver: (
            req: XyPrisRequest,
            ctx: XyGuardContext,
        ) => boolean | string | Promise<boolean | string>,
    ): void;

    /**
     * Define a resolver for 'roles' or 'permissions' guards.
     */
    public static define(
        name: "roles" | "permissions",
        resolver: (
            req: XyPrisRequest,
            required: string[],
            ctx: XyGuardContext,
        ) => boolean | string | Promise<boolean | string>,
    ): void;

    /** 
     * Define a resolver for any custom guard.
     */
    public static define(
        name: string & {},
        resolver: (
            req: XyPrisRequest,
            arg2?: any,
            arg3?: any,
        ) => boolean | string | Promise<boolean | string>,
    ): void;

    /**
     * Internal implementation of define.
     */
    public static define(
        name: string,
        resolver: (
            req: XyPrisRequest,
            arg2?: any,
            arg3?: any,
        ) => boolean | string | Promise<boolean | string>,
    ): void {
        if (this.resolvers.has(name)) {
            throw new Error(`[XyGuard] A guard with the name '${name}' is already defined.`);
        }
        this.resolvers.set(name, resolver);
    }

    /**
     * Get an existing resolver by name.
     * @internal
     */
    public static get(name: string): GuardResolver | undefined {
        return this.resolvers.get(name);
    }
}



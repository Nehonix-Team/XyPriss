import { XyPrisRequest } from "./types";

/** Supported built-in guard names */
export type BuiltInGuardName = "authenticated" | "roles" | "permissions";

export type GuardResolver = (
    req: XyPrisRequest,
    options?: any,
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
 * XyGuard.define('authenticated', (req) => !!req.user);
 * XyGuard.define('roles', (req, required) => required.includes(req.user?.role));
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
        ) => boolean | string | Promise<boolean | string>,
    ): void;

    /**
     * Internal implementation of define.
     */
    public static define(name: string, resolver: GuardResolver): void {
        this.resolvers.set(name, resolver);
    }

    /**
     * Get an existing resolver by name.
     * @internal
     */
    public static get(name: BuiltInGuardName): GuardResolver | undefined {
        return this.resolvers.get(name);
    }
}


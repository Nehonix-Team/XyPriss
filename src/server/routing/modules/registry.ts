import type { XyPrissRouter } from "../Router";
import {
    RichRouteDefinition,
    RichRouteOptions,
    RouteMeta,
    ParamConstraint,
    XyPrisRequest,
    XyPrisResponse,
} from "./types";
import {
    normalizePath,
    isValidPath,
    compileRoutePattern,
    joinPaths,
} from "./path";
import {
    resolveCondition,
    nextRouteId,
    createGuardMiddleware,
} from "./helpers";
import { XyGuard } from "./XyGuard";
import {
    createRateLimitMiddleware,
    createCacheMiddleware,
    wrapWithLifecycle,
} from "./middleware";
import {
    MiddlewareFunction,
    RouteHandler,
} from "../../../types/httpServer.type";
import { MiddlewareEntry } from "../../../types/XyPrissRouter.types";

/** Minimal interface for router instance to avoid circular imports */
export interface IRouterInternal {
    getAllRoutes(): RichRouteDefinition[];
    getRoutes(): RichRouteDefinition[];
}

/**
 * Internal helper to add a rich route to a router instance.
 */
export function addRichRoute(
    router: XyPrissRouter,
    method: string,
    path: string,
    args: any[],
    internalState: {
        routes: RichRouteDefinition[];
        middleware: MiddlewareEntry[];
        logger: any;
        options: any;
        featureResolver: ((flag: string) => boolean) | null;
    },
): void {
    if (!method || typeof method !== "string") {
        throw new Error("HTTP method must be a non-empty string");
    }
    if (!path || typeof path !== "string") {
        throw new Error("Route path must be a non-empty string");
    }
    if (!Array.isArray(args) || args.length === 0) {
        throw new Error(
            `Route ${method} ${path} must have at least one handler`,
        );
    }

    let richOptions: RichRouteOptions | undefined;
    let handlers: (MiddlewareFunction | RouteHandler)[];

    if (
        args.length >= 1 &&
        typeof args[0] === "object" &&
        args[0] !== null &&
        !Array.isArray(args[0]) &&
        typeof args[0] !== "function"
    ) {
        richOptions = args[0] as RichRouteOptions;
        handlers = args.slice(1);
    } else {
        handlers = args;
    }

    if (handlers.length === 0) {
        throw new Error(
            `Route ${method} ${path} must have at least one handler function`,
        );
    }

    const normalizedPath = normalizePath(path);

    if (!isValidPath(normalizedPath)) {
        throw new Error(`Invalid path format: ${path}`);
    }

    const active = resolveCondition(
        richOptions?.active,
        internalState.featureResolver,
    );
    const middleware = handlers.slice(0, -1) as MiddlewareFunction[];
    const handler = handlers[handlers.length - 1] as RouteHandler;

    if (typeof handler !== "function") {
        throw new Error(
            `Final handler must be a function for route ${method} ${path}`,
        );
    }

    // -- Guard Execution Injection --
    const routeGuards = richOptions?.guards;
    let guardMiddleware: MiddlewareFunction | undefined;

    if (routeGuards) {
        guardMiddleware = createGuardMiddleware(
            routeGuards,
            internalState.logger,
        );
    }

    const { pattern, paramNames, paramConstraints } = compileRoutePattern(
        normalizedPath,
        internalState.options,
    );

    const inputMiddlewareEntries: MiddlewareEntry[] = middleware.map((m) => ({
        handler: m,
    }));

    if (guardMiddleware) {
        inputMiddlewareEntries.unshift({ handler: guardMiddleware });
    }

    // -- Rich Feature Injection (Rate Limit, Cache) --
    if (richOptions?.rateLimit) {
        inputMiddlewareEntries.unshift({
            handler: createRateLimitMiddleware(richOptions.rateLimit),
        });
    }

    if (richOptions?.cache) {
        inputMiddlewareEntries.unshift({
            handler: createCacheMiddleware(richOptions.cache),
        });
    }

    let finalHandler = handler;
    if (richOptions?.lifecycle) {
        finalHandler = wrapWithLifecycle(handler, richOptions.lifecycle) as any;
    }

    const combinedMiddleware = [
        ...internalState.middleware,
        ...inputMiddlewareEntries,
    ];

    const versionFromPath = normalizedPath.match(/^\/v(\d+(?:\.\d+)?)\//)?.[1];
    const version =
        (richOptions?.meta?.version as string | undefined) ?? versionFromPath;

    const route: RichRouteDefinition = {
        id: nextRouteId(),
        method: method.toUpperCase(),
        path: normalizedPath,
        originalPath: normalizedPath,
        handler: finalHandler,
        middleware: combinedMiddleware,
        pattern,
        paramNames,
        paramConstraints,
        guards: richOptions?.guards,
        lifecycle: richOptions?.lifecycle,
        rateLimit: richOptions?.rateLimit,
        cache: richOptions?.cache,
        meta: richOptions?.meta,
        priority: richOptions?.priority ?? 0,
        active,
        version,
    };

    const insertIndex = internalState.routes.findIndex(
        (r) => r.priority < route.priority,
    );
    if (insertIndex === -1) {
        internalState.routes.push(route);
    } else {
        internalState.routes.splice(insertIndex, 0, route);
    }

    internalState.logger.debug(
        "router",
        `Added route [${route.id}]: ${method} ${normalizedPath}` +
            (version ? ` (v${version})` : "") +
            (active ? "" : " [INACTIVE]"),
    );
}

/**
 * Internal helper to mount a sub-router.
 */
export function mountRouter(
    mountPath: string,
    subRouter: IRouterInternal,
    internalState: {
        routes: RichRouteDefinition[];
        middleware: MiddlewareEntry[];
        logger: any;
        options: any;
        featureResolver: ((flag: string) => boolean) | null;
    },
): void {
    if (!subRouter || typeof subRouter.getAllRoutes !== "function") {
        throw new Error("Invalid router instance provided");
    }

    const normalizedMountPath = normalizePath(mountPath);

    subRouter.getAllRoutes().forEach((route) => {
        try {
            const fullPath = joinPaths(normalizedMountPath, route.originalPath);
            const { pattern, paramNames, paramConstraints } =
                compileRoutePattern(fullPath, internalState.options);

            const mountedMiddleware = route.middleware.map((entry) => {
                if (entry.path) {
                    return {
                        path: joinPaths(normalizedMountPath, entry.path),
                        handler: entry.handler,
                    };
                }
                return {
                    path: normalizedMountPath,
                    handler: entry.handler,
                };
            });

            const combinedMiddleware = [
                ...internalState.middleware,
                ...mountedMiddleware,
            ];

            const mountedRoute: RichRouteDefinition = {
                ...route,
                path: fullPath,
                originalPath: fullPath,
                pattern,
                paramNames,
                paramConstraints,
                middleware: combinedMiddleware,
            };

            internalState.routes.push(mountedRoute);
        } catch (error) {
            internalState.logger.error(
                "router",
                `Failed to mount route ${route.method} ${route.path}: ${error}`,
            );
            throw error;
        }
    });
}


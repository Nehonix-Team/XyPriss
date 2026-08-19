import type { XyPrissRouter } from "../Router";
import {
    RichRouteDefinition,
    RouteGroupOptions,
    RouteMeta,
    XyPrisRequest,
    XyPrisResponse,
} from "./types";
import { normalizePath, compileRoutePattern, joinPaths } from "./path";
import { resolveCondition, createGuardMiddleware } from "./helpers";
import { createRateLimitMiddleware } from "./middleware";
import { MiddlewareEntry } from "../../../types/XyPrissRouter.types";
import { MiddlewareFunction } from "../../../types/httpServer.type";

/**
 * Handles router.group() logic.
 */
export function handleGroup(
    parentRouter: XyPrissRouter,
    childRouter: XyPrissRouter,
    options: RouteGroupOptions,
    callback: (router: XyPrissRouter) => void,
    internalState: {
        routes: RichRouteDefinition[];
        middleware: MiddlewareEntry[];
        logger: any;
        options: any;
        featureResolver: ((flag: string) => boolean) | null;
    },
): void {
    if (options.middleware) {
        options.middleware.forEach((m) => childRouter.use(m));
    }

    callback(childRouter);

    const rawPrefixes: string[] = Array.isArray(options.prefix)
        ? (options.prefix.length > 0 ? options.prefix : [""])
        : [options.prefix ?? ""];

    const computedPrefixes = rawPrefixes.map((p) => {
        let prefix = p ?? "";
        if (options.version) {
            const ver = `v${options.version.replace(/^v/, "")}`;
            prefix = prefix ? joinPaths(prefix, ver) : `/${ver}`;
        }
        return prefix ? normalizePath(prefix) : "/";
    });

    let groupRateLimitMiddleware: MiddlewareFunction | undefined;
    if (options.rateLimit) {
        groupRateLimitMiddleware = createRateLimitMiddleware(options.rateLimit);
    }

    const groupGuards = options.guards;
    let groupGuardMiddleware: MiddlewareFunction | undefined;
    if (groupGuards) {
        groupGuardMiddleware = createGuardMiddleware(
            groupGuards,
            internalState.logger,
        );
    }

    const childRoutes = childRouter.getRoutes();

    for (const prefix of computedPrefixes) {
        childRoutes.forEach((route) => {
            const fullPath = joinPaths(prefix, route.originalPath);
            const { pattern, paramNames, paramConstraints } = compileRoutePattern(
                fullPath,
                internalState.options,
            );

            const mergedMeta: RouteMeta = {
                ...(options.meta ?? {}),
                ...(route.meta ?? {}),
                version: route.meta?.version ?? options.version,
            };

            const rateLimit = route.rateLimit ?? options.rateLimit;
            const active =
                resolveCondition(options.active, internalState.featureResolver) &&
                route.active;

            const routeMiddleware = [...route.middleware];
            if (groupGuardMiddleware) {
                routeMiddleware.unshift({ handler: groupGuardMiddleware });
            }
            if (!route.rateLimit && groupRateLimitMiddleware) {
                routeMiddleware.unshift({ handler: groupRateLimitMiddleware });
            }

            const mounted: RichRouteDefinition = {
                ...route,
                path: fullPath,
                originalPath: fullPath,
                pattern,
                paramNames,
                paramConstraints,
                serverId: route.serverId ?? options.serverId,
                meta: Object.keys(mergedMeta).length ? mergedMeta : undefined,
                guards: groupGuards ?? route.guards,
                rateLimit,
                groupPrefix: prefix,
                groupRateLimit: options.rateLimit,
                active,
                version: mergedMeta.version as string | undefined,
                middleware: [...internalState.middleware, ...routeMiddleware],
            };

            internalState.routes.push(mounted);
            internalState.logger.debug(
                "router",
                `Group mounted: ${route.method} ${fullPath}`,
            );
        });
    }
}


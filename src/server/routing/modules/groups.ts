import type { XyPrissRouter } from "../Router";
import {
    RichRouteDefinition,
    RouteGroupOptions,
    RouteMeta,
    XyPrisRequest,
    XyPrisResponse,
} from "./types";
import { normalizePath, compileRoutePattern, joinPaths } from "./path";
import { resolveCondition } from "./helpers";
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

    let prefix = options.prefix ?? "";
    if (options.version) {
        const ver = `v${options.version.replace(/^v/, "")}`;
        prefix = prefix ? joinPaths(prefix, ver) : `/${ver}`;
    }
    prefix = prefix ? normalizePath(prefix) : "/";

    childRouter.getRoutes().forEach((route) => {
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

        const groupGuards = options.guards;
        let groupGuardMiddleware: MiddlewareFunction | undefined;

        if (groupGuards) {
            groupGuardMiddleware = async (
                req: XyPrisRequest,
                res: XyPrisResponse,
                next: any,
            ) => {
                const guards = Array.isArray(groupGuards)
                    ? groupGuards
                    : groupGuards.custom || [];
                for (const guard of guards) {
                    try {
                        const result = await guard(req, res);
                        if (result === false)
                            return res.status(403).json({
                                success: false,
                                error: "Forbidden: Group guard rejection",
                            });
                        if (typeof result === "string")
                            return res
                                .status(401)
                                .json({ success: false, error: result });
                    } catch (err) {
                        internalState.logger.error(
                            "router",
                            `Group guard execution error: ${err}`,
                        );
                        return res.status(500).json({
                            success: false,
                            error: "Internal Server Error during group guard check",
                        });
                    }
                }
                next?.();
            };
        }

        const rateLimit = route.rateLimit ?? options.rateLimit;
        const active =
            resolveCondition(options.active, internalState.featureResolver) &&
            route.active;

        const routeMiddleware = [...route.middleware];
        if (groupGuardMiddleware) {
            routeMiddleware.unshift({ handler: groupGuardMiddleware });
        }

        const mounted: RichRouteDefinition = {
            ...route,
            path: fullPath,
            originalPath: fullPath,
            pattern,
            paramNames,
            paramConstraints,
            meta: Object.keys(mergedMeta).length ? mergedMeta : undefined,
            guards: groupGuards ?? route.guards,
            rateLimit,
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


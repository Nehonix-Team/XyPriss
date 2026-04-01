/**
 * XyPriss Router System Exports
 */

export { XyPrissRouter, Router } from "./Router";
export type {
    RouteDefinition,
    RouterOptions,
    RouteMatch,
} from "../../types/XyPrissRouter.types";
export type {
    RichRouteOptions,
    RouteGuard,
    RouteGroupOptions,
    RouteMeta,
    RouteLifecycle,
    RouteCache,
    RoutRateLimit,
    XyPrisRequest,
    XyPrisResponse,
} from "./modules/types";

// Default export for convenience (Express-like)
export { Router as default } from "./Router";


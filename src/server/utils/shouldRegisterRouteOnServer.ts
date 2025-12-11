import { MultiServerConfig } from "../ServerFactory";

/**
 * Check if a route should be registered on a specific server
 */
export function shouldRegisterRouteOnServer(
    routePath: string,
    serverConfig: MultiServerConfig
): boolean {
    // If no route filtering is configured, allow all routes
    if (!serverConfig.allowedRoutes && !serverConfig.routePrefix) {
        return true;
    }

    // Check route prefix
    if (
        serverConfig.routePrefix &&
        routePath.startsWith(serverConfig.routePrefix)
    ) {
        return true;
    }

    // Check allowed routes patterns
    if (serverConfig.allowedRoutes) {
        return serverConfig.allowedRoutes.some((pattern) => {
            if (pattern.endsWith("/*")) {
                // Wildcard pattern
                const prefix = pattern.slice(0, -2);
                return routePath.startsWith(prefix);
            } else {
                // Exact match
                return routePath === pattern;
            }
        });
    }

    return false;
}


import { ServerOptions } from "../ServerFactory";

export const proxyConfig = (cf: ServerOptions["network"]) => {
    return {
        enabled: cf?.proxy?.enabled ?? true,
        upstreams: cf?.proxy?.upstreams || [],
        loadBalancing: cf?.proxy?.loadBalancing ?? "round-robin",
        healthCheck: {
            enabled: cf?.proxy?.healthCheck?.enabled ?? true,
            interval: cf?.proxy?.healthCheck?.interval ?? 30000,
            timeout: cf?.proxy?.healthCheck?.timeout ?? 5000,
            path: cf?.proxy?.healthCheck?.path ?? "/health",
            unhealthyThreshold: cf?.proxy?.healthCheck?.unhealthyThreshold ?? 3,
            healthyThreshold: cf?.proxy?.healthCheck?.healthyThreshold ?? 2,
        },
        timeout: cf?.proxy?.timeout ?? 30000,
        logging: cf?.proxy?.logging ?? false,
        onError: cf?.proxy?.onError,
    };
};


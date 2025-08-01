import { ServerOptions } from "../ServerFactory";

export const netConfig = (cf: ServerOptions["network"]) => {
    return {
        http2: {
            enabled: cf?.connection?.http2?.enabled ?? true,
            maxConcurrentStreams:
                cf?.connection?.http2?.maxConcurrentStreams ?? 100,
            initialWindowSize:
                cf?.connection?.http2?.initialWindowSize ?? 65536,
            serverPush: cf?.connection?.http2?.serverPush ?? true,
        },
        keepAlive: {
            enabled: cf?.connection?.keepAlive?.enabled ?? true,
            timeout: cf?.connection?.keepAlive?.timeout ?? 30000,
            maxRequests: cf?.connection?.keepAlive?.maxRequests ?? 100,
        },
        connectionPool: {
            maxConnections:
                cf?.connection?.connectionPool?.maxConnections ?? 1000,
            timeout: cf?.connection?.connectionPool?.timeout ?? 5000,
            idleTimeout: cf?.connection?.connectionPool?.idleTimeout ?? 60000,
        },
    };
};


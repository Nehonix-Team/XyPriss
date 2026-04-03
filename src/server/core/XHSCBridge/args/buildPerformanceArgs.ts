export function buildPerformanceArgs(
    perfConf: any,
    networkConf: any,
): string[] {
    if (!perfConf) return [];

    const args: string[] = [];
    const comp = networkConf?.compression;

    if (comp) {
        if (comp.enabled !== undefined)
            args.push(`--perf-compression=${comp.enabled}`);
        if (comp.algorithms)
            args.push("--perf-compression-algs", comp.algorithms.join(","));
        if (comp.level !== undefined)
            args.push("--compression-level", comp.level.toString());
        if (comp.threshold !== undefined)
            args.push("--compression-threshold", comp.threshold.toString());
        if (comp.contentTypes?.length > 0)
            args.push("--compression-types", comp.contentTypes.join(","));
    }

    if (perfConf.batchSize !== undefined)
        args.push("--perf-batch-size", perfConf.batchSize.toString());
    if (perfConf.connectionPooling !== undefined)
        args.push(`--perf-connection-pooling=${perfConf.connectionPooling}`);
    if (perfConf.intelligence) args.push("--intelligence");
    if (perfConf.preAllocate) args.push("--pre-allocate");

    const conn = networkConf?.connection;
    if (conn) {
        if (conn.http2?.maxConcurrentStreams !== undefined)
            args.push(
                "--http2-max-streams",
                conn.http2.maxConcurrentStreams.toString(),
            );
        if (conn.keepAlive?.timeout !== undefined)
            args.push("--keepalive-timeout", conn.keepAlive.timeout.toString());
        if (conn.keepAlive?.maxRequests !== undefined)
            args.push(
                "--keepalive-requests",
                conn.keepAlive.maxRequests.toString(),
            );
        if (conn.connectionPool?.timeout !== undefined)
            args.push("--pool-timeout", conn.connectionPool.timeout.toString());
        if (conn.connectionPool?.idleTimeout !== undefined)
            args.push(
                "--pool-idle-timeout",
                conn.connectionPool.idleTimeout.toString(),
            );
    }

    return args;
}

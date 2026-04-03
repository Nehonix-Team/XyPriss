export function buildRequestArgs(rmconf: any): string[] {
    const args: string[] = [];

    // Concurrency
    const conc = rmconf?.concurrency;
    if (conc) {
        if (conc.maxConcurrentRequests !== undefined)
            args.push(
                "--max-concurrent-requests",
                conc.maxConcurrentRequests.toString(),
            );
        if (conc.maxPerIP !== undefined)
            args.push("--max-per-ip", conc.maxPerIP.toString());
        if (conc.maxQueueSize !== undefined)
            args.push("--max-queue-size", conc.maxQueueSize.toString());
        if (conc.queueTimeout !== undefined)
            args.push("--queue-timeout", conc.queueTimeout.toString());
    }

    // Payload
    if (rmconf?.payload?.maxUrlLength)
        args.push("--max-url-length", rmconf.payload.maxUrlLength.toString());

    // Network quality
    const nq = rmconf?.networkQuality;
    if (nq?.enabled) {
        args.push("--quality-enabled");
        if (nq.rejectOnPoorConnection) args.push("--quality-reject-poor");
        if (nq.minBandwidth)
            args.push("--quality-min-bw", nq.minBandwidth.toString());
        if (nq.maxLatency)
            args.push("--quality-max-lat", nq.maxLatency.toString());
    }

    return args;
}

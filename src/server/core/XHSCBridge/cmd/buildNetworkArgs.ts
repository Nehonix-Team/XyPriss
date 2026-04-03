export function buildNetworkArgs(networkConf: any, app: any): string[] {
    const args: string[] = [];

    // Firewall
    const firewall = networkConf?.firewall;
    if (firewall?.enabled) {
        args.push("--firewall-enabled");
        if (firewall.autoOpen) args.push("--firewall-auto-open");
        if (
            Array.isArray(firewall.allowedIPs) &&
            firewall.allowedIPs.length > 0
        )
            args.push("--firewall-allowed-ips", firewall.allowedIPs.join(","));
    }

    // Proxy
    const proxy = networkConf?.proxy;
    if (
        proxy?.enabled &&
        Array.isArray(proxy.upstreams) &&
        proxy.upstreams.length > 0
    ) {
        const upstreams = proxy.upstreams
            .map((u: any) => `http://${u.host}:${u.port || 80}`)
            .join(",");
        args.push("--proxy-upstreams", upstreams);
        args.push("--proxy-strategy", proxy.loadBalancing || "round-robin");

        if (proxy.healthCheck?.enabled) {
            args.push("--proxy-hc-enabled");
            if (proxy.healthCheck.interval)
                args.push(
                    "--proxy-hc-interval",
                    proxy.healthCheck.interval.toString(),
                );
            if (proxy.healthCheck.timeout)
                args.push(
                    "--proxy-hc-timeout",
                    proxy.healthCheck.timeout.toString(),
                );
            if (proxy.healthCheck.path)
                args.push("--proxy-hc-path", proxy.healthCheck.path);
            if (proxy.healthCheck.unhealthyThreshold)
                args.push(
                    "--proxy-hc-unhealthy",
                    proxy.healthCheck.unhealthyThreshold.toString(),
                );
            if (proxy.healthCheck.healthyThreshold)
                args.push(
                    "--proxy-hc-healthy",
                    proxy.healthCheck.healthyThreshold.toString(),
                );
        }
    }

    // Trust proxy
    const trustProxy = (app as any).settings?.["trust proxy"];
    if (trustProxy) {
        if (typeof trustProxy === "boolean")
            args.push("--trust-proxy", "loopback");
        else if (typeof trustProxy === "string")
            args.push("--trust-proxy", trustProxy);
        else if (Array.isArray(trustProxy))
            args.push("--trust-proxy", trustProxy.join(","));
    }

    return args;
}

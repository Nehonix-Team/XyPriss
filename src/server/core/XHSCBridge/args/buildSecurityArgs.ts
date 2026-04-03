export function buildSecurityArgs(securityConf: any, rmconf: any): string[] {
    const args: string[] = [];

    // Rate limiting
    const rl = securityConf?.rateLimit;
    if (rl) {
        args.push("--rate-limit");
        if (typeof rl === "object") {
            if (rl.max !== undefined)
                args.push("--rate-limit-max", rl.max.toString());
            if (rl.windowMs !== undefined)
                args.push("--rate-limit-window", rl.windowMs.toString());
            if (rl.message)
                args.push(
                    "--rate-limit-message",
                    typeof rl.message === "string"
                        ? rl.message
                        : JSON.stringify(rl.message),
                );
            if (rl.standardHeaders) args.push("--rate-limit-headers");
            if (rl.legacyHeaders) args.push("--rate-limit-legacy-headers");
            if (Array.isArray(rl.excludePaths) && rl.excludePaths.length > 0) {
                const strExcludes = rl.excludePaths
                    .map((p: any) =>
                        p instanceof RegExp ? `RE:${p.source}` : p,
                    )
                    .join(",");
                if (strExcludes) args.push("--rate-limit-exclude", strExcludes);
            }
        }
    }

    // Circuit breaker
    const cb = rmconf?.resilience?.circuitBreaker;
    if (cb) {
        if (cb.enabled) args.push("--breaker-enabled");
        if (cb.failureThreshold)
            args.push("--breaker-threshold", cb.failureThreshold.toString());
        if (cb.resetTimeout)
            args.push(
                "--breaker-timeout",
                Math.ceil(cb.resetTimeout / 1000).toString(),
            );
    }

    // Retry
    if (rmconf?.resilience?.retryEnabled) {
        args.push(
            "--retry-max",
            (rmconf.resilience.maxRetries || 3).toString(),
        );
        args.push(
            "--retry-delay",
            (rmconf.resilience.retryDelay || 100).toString(),
        );
    }

    return args;
}


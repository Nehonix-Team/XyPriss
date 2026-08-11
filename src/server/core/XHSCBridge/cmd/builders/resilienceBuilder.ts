export function buildResilienceArgs(rmconf: any, args: string[]): void {
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
}

import { isFeatureEnabled } from "./isFeatureEnabled";

export function buildResilienceArgs(rmconf: any, args: string[]): void {
    // Circuit breaker
    const cb = rmconf?.resilience?.circuitBreaker;
    if (isFeatureEnabled(cb)) {
        args.push("--breaker-enabled");
        if (cb.failureThreshold)
            args.push("--breaker-threshold", cb.failureThreshold.toString());
        if (cb.resetTimeout)
            args.push(
                "--breaker-timeout",
                Math.ceil(cb.resetTimeout / 1000).toString(),
            );
    }

    // Retry
    const retryConf = rmconf?.resilience?.retry;
    const retryEnabled =
        rmconf?.resilience?.retryEnabled || isFeatureEnabled(retryConf);
    if (retryEnabled) {
        args.push(
            "--retry-max",
            (rmconf?.resilience?.maxRetries || retryConf?.maxRetries || 3).toString(),
        );
        args.push(
            "--retry-delay",
            (rmconf?.resilience?.retryDelay || retryConf?.retryDelay || 100).toString(),
        );
    }
}

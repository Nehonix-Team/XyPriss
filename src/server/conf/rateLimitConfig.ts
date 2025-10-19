import { ServerOptions } from "../ServerFactory";

export const rateLimitConfig = (
    cf: ServerOptions["network"],
    securityConfig?: ServerOptions["security"]
) => {
    // Use security.rateLimit as fallback if network.rateLimit is not configured
    const securityRateLimit =
        typeof securityConfig?.rateLimit === "object"
            ? securityConfig.rateLimit
            : undefined;

    // Convert security.rateLimit format (windowMs, max) to network format (requests, window)
    const fallbackPerIP = securityRateLimit
        ? {
              requests: securityRateLimit.max ?? 100,
              window:
                  securityRateLimit.windowMs
                      ? `${Math.floor(securityRateLimit.windowMs / 1000)}s`
                      : "15m",
          }
        : undefined;

    return {
        enabled: cf?.rateLimit?.enabled ?? securityConfig?.rateLimit !== false,
        strategy: cf?.rateLimit?.strategy ?? "sliding-window",
        global: {
            requests: cf?.rateLimit?.global?.requests ?? 1000,
            window: cf?.rateLimit?.global?.window ?? "1h",
        },
        perIP: {
            requests:
                cf?.rateLimit?.perIP?.requests ??
                fallbackPerIP?.requests ??
                100,
            window:
                cf?.rateLimit?.perIP?.window ?? fallbackPerIP?.window ?? "1m",
        },
        perUser: cf?.rateLimit?.perUser
            ? {
                  requests: cf?.rateLimit.perUser.requests ?? 50,
                  window: cf?.rateLimit.perUser.window ?? "1m",
              }
            : undefined,
        headers: cf?.rateLimit?.headers,
        redis: cf?.rateLimit?.redis
            ? {
                  host: cf?.rateLimit.redis.host ?? "localhost",
                  port: cf?.rateLimit.redis.port ?? 6379,
                  password: cf?.rateLimit.redis.password,
                  db: cf?.rateLimit.redis.db ?? 0,
                  keyPrefix:
                      cf?.rateLimit.redis.keyPrefix ?? "xypriss:ratelimit:",
              }
            : undefined,
    };
};

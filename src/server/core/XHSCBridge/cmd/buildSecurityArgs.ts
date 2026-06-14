import { Configs } from "../../../..";
import { SecurityConfig,  } from "../../../../types";

function normalizeRouteConfig(routes: (string | RoutePattern)[] | undefined): any[] | undefined {
    if (!routes || !Array.isArray(routes)) return undefined;
    return routes.map((r: any) => {
        if (typeof r === "string") return { path: r };
        if (r instanceof RegExp) return { path: r.source, isRegex: true };
        if (r && r.path) {
            if (r.path instanceof RegExp) {
                return { path: r.path.source, isRegex: true, methods: r.methods };
            }
            return { path: r.path, methods: r.methods };
        }
        return r;
    }).filter(Boolean);
}

const IrmC = Configs.get("requestManagement");
export function buildSecurityArgs(
    securityConf:
        | (SecurityConfig & {
              enabled?: boolean;
          })
        | undefined,
    rmconf: typeof IrmC,
): string[] {
    const args: string[] = [];

    // Rate limiting
    const rl = securityConf?.rateLimit;
    if (rl && securityConf?.enabled !== false) {
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

    // Helmet
    if (securityConf?.helmet !== false && securityConf?.enabled !== false) {
        const defaultHelmetOpts = {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:"],
                    fontSrc: ["'self'"],
                },
            },
            crossOriginEmbedderPolicy: true,
            crossOriginOpenerPolicy: true,
            crossOriginResourcePolicy: { policy: "same-origin" },
            dnsPrefetchControl: { allow: false },
            frameguard: { action: "deny" },
            hidePoweredBy: true,
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: false,
            },
            ieNoOpen: true,
            noSniff: true,
            originAgentCluster: true,
            permittedCrossDomainPolicies: false,
            referrerPolicy: { policy: "strict-origin-when-cross-origin" },
            xssFilter: true,
        };

        let userHelmetOpts =
            typeof securityConf?.helmet === "object" ? securityConf.helmet : {};
        let finalHelmetOpts: any = { ...defaultHelmetOpts };

        if (userHelmetOpts.contentSecurityPolicy !== undefined) {
            if (userHelmetOpts.contentSecurityPolicy === false) {
                finalHelmetOpts.contentSecurityPolicy = false;
            } else if (
                typeof userHelmetOpts.contentSecurityPolicy === "object" &&
                userHelmetOpts.contentSecurityPolicy !== null
            ) {
                finalHelmetOpts.contentSecurityPolicy = {
                    ...defaultHelmetOpts.contentSecurityPolicy,
                    ...userHelmetOpts.contentSecurityPolicy,
                };
                if (userHelmetOpts.contentSecurityPolicy.directives) {
                    const normalizedUserDirectives: any = {};
                    for (const [key, value] of Object.entries(
                        userHelmetOpts.contentSecurityPolicy.directives,
                    )) {
                        const camelKey = key.replace(/-([a-z])/g, (_, letter) =>
                            (letter as string).toUpperCase(),
                        );
                        normalizedUserDirectives[camelKey] = value;
                    }
                    finalHelmetOpts.contentSecurityPolicy.directives = {
                        ...(defaultHelmetOpts.contentSecurityPolicy as any)
                            .directives,
                        ...normalizedUserDirectives,
                    };
                }
            }
        }

        const { contentSecurityPolicy, ...otherOpts } = userHelmetOpts;
        finalHelmetOpts = { ...finalHelmetOpts, ...otherOpts };

        args.push(
            "--helmet-config-json",
            Buffer.from(JSON.stringify(finalHelmetOpts)).toString("base64"),
        );
    }

    // CSRF
    if (securityConf?.csrf && securityConf?.enabled !== false) {
        const defaultCsrfOpts = {
            cookieName: "__Host-psifi.x-csrf-token",
            cookieOptions: {
                httpOnly: true,
                sameSite: "strict",
                secure: process.env.NODE_ENV === "production",
                maxAge: 3600000, // 1 hour
            },
            ignoredMethods: ["GET", "HEAD", "OPTIONS"],
            enabled: true,
        };

        let userCsrfOpts =
            typeof securityConf.csrf === "object" ? securityConf.csrf : {};
        let finalCsrfOpts = { 
            ...defaultCsrfOpts, 
            ...userCsrfOpts,
            cookieOptions: {
                ...defaultCsrfOpts.cookieOptions,
                ...(userCsrfOpts.cookieOptions || {})
            }
        };

        // Deep merge cookieOptions
        if (userCsrfOpts.cookieOptions) {
            finalCsrfOpts.cookieOptions = {
                ...defaultCsrfOpts.cookieOptions,
                ...userCsrfOpts.cookieOptions,
            };
        }

        args.push(
            "--csrf-config-json",
            Buffer.from(JSON.stringify(finalCsrfOpts)).toString("base64"),
        );
    }

    // XSS
    if (securityConf?.xss && securityConf?.enabled !== false) {
        const defaultXssOpts = {
            enabled: true,
            blockOnDetection: true,
            whiteList: {
                a: ["href", "title"],
                b: [],
                i: [],
                strong: [],
                em: [],
            },
            message: "Forbidden - XSS Attack Detected",
            statusCode: 403,
        };

        let userXssOpts =
            typeof securityConf.xss === "object" ? securityConf.xss : {};
        let finalXssOpts: any = { ...defaultXssOpts, ...userXssOpts };
        if (securityConf?.routeConfig?.xss) {
            finalXssOpts.routeConfig = {
                excludeRoutes: normalizeRouteConfig(securityConf.routeConfig.xss.excludeRoutes),
                includeRoutes: normalizeRouteConfig(securityConf.routeConfig.xss.includeRoutes)
            };
        }

        args.push(
            "--xss-config-json",
            Buffer.from(JSON.stringify(finalXssOpts)).toString("base64"),
        );
    }

    // HPP
    if (securityConf?.hpp && securityConf?.enabled !== false) {
        const defaultHppOpts = {
            checkQuery: true,
            checkBody: true,
            checkHeaders: false,
            whitelist: [],
        };
        let userHppOpts =
            typeof securityConf.hpp === "object" ? securityConf.hpp : {};
        let finalHppOpts = { ...defaultHppOpts, ...userHppOpts };
        args.push(
            "--hpp-config-json",
            Buffer.from(JSON.stringify(finalHppOpts)).toString("base64"),
        );
    }

    // XXE
    if (securityConf?.xxe && securityConf?.enabled !== false) {
        const defaultXxeOpts = {
            enabled: true,
            blockOnDetection: true,
            message: "Forbidden - XXE Attack Detected",
            statusCode: 403,
        };
        let userXxeOpts =
            typeof securityConf.xxe === "object" ? securityConf.xxe : {};
        let finalXxeOpts: any = { ...defaultXxeOpts, ...userXxeOpts };
        if (securityConf?.routeConfig?.xxe) {
            finalXxeOpts.routeConfig = {
                excludeRoutes: normalizeRouteConfig(securityConf.routeConfig.xxe.excludeRoutes),
                includeRoutes: normalizeRouteConfig(securityConf.routeConfig.xxe.includeRoutes)
            };
        }
        args.push(
            "--xxe-config-json",
            Buffer.from(JSON.stringify(finalXxeOpts)).toString("base64"),
        );
    }

    // SlowDown
    if (securityConf?.slowDown && securityConf?.enabled !== false) {
        const defaultSlowDownOpts = {
            windowMs: 60000,
            delayAfter: 1,
            delayMs: 500,
            maxDelayMs: 20000,
        };
        let userSlowDownOpts =
            typeof securityConf.slowDown === "object"
                ? securityConf.slowDown
                : {};
        let finalSlowDownOpts = { ...defaultSlowDownOpts, ...userSlowDownOpts };
        args.push(
            "--slowdown-config-json",
            Buffer.from(JSON.stringify(finalSlowDownOpts)).toString("base64"),
        );
    }

    // SQL Injection
    if (securityConf?.sqlInjection && securityConf?.enabled !== false) {
        const defaultSqliOpts = {
            enabled: true,
            blockOnDetection: true,
            strictMode: false,
            message: "Forbidden - SQL Injection Detected",
            statusCode: 403,
        };
        let userSqliOpts = typeof securityConf.sqlInjection === "object" ? securityConf.sqlInjection : {};
        let finalSqliOpts: any = { ...defaultSqliOpts, ...userSqliOpts };
        if (securityConf?.routeConfig?.sqlInjection) {
            finalSqliOpts.routeConfig = {
                excludeRoutes: normalizeRouteConfig(securityConf.routeConfig.sqlInjection.excludeRoutes),
                includeRoutes: normalizeRouteConfig(securityConf.routeConfig.sqlInjection.includeRoutes)
            };
        }
        args.push(
            "--sqli-config-json",
            Buffer.from(JSON.stringify(finalSqliOpts)).toString("base64"),
        );
    }

    // Command Injection
    if (securityConf?.commandInjection && securityConf?.enabled !== false) {
        const defaultCmdInjectOpts = {
            enabled: true,
            blockOnDetection: true,
            message: "Forbidden - Command Injection Detected",
            statusCode: 403,
        };
        let userCmdInjectOpts = typeof securityConf.commandInjection === "object" ? securityConf.commandInjection : {};
        let finalCmdInjectOpts: any = { ...defaultCmdInjectOpts, ...userCmdInjectOpts };
        if (securityConf?.routeConfig?.commandInjection) {
            finalCmdInjectOpts.routeConfig = {
                excludeRoutes: normalizeRouteConfig(securityConf.routeConfig.commandInjection.excludeRoutes),
                includeRoutes: normalizeRouteConfig(securityConf.routeConfig.commandInjection.includeRoutes)
            };
        }
        console.log("[XHSC-BRIDGE] finalCmdInjectOpts:", JSON.stringify(finalCmdInjectOpts));
        args.push(
            "--cmd-inject-config-json",
            Buffer.from(JSON.stringify(finalCmdInjectOpts)).toString("base64"),
        );
    }

    // Path Traversal
    if (securityConf?.pathTraversal && securityConf?.enabled !== false) {
        const defaultPathTraversalOpts = {
            enabled: true,
            blockOnDetection: true,
            message: "Forbidden - Path Traversal Detected",
            statusCode: 403,
        };
        let userPathTraversalOpts = typeof securityConf.pathTraversal === "object" ? securityConf.pathTraversal : {};
        let finalPathTraversalOpts: any = { ...defaultPathTraversalOpts, ...userPathTraversalOpts };
        if (securityConf?.routeConfig?.pathTraversal) {
            finalPathTraversalOpts.routeConfig = {
                excludeRoutes: normalizeRouteConfig(securityConf.routeConfig.pathTraversal.excludeRoutes),
                includeRoutes: normalizeRouteConfig(securityConf.routeConfig.pathTraversal.includeRoutes)
            };
        }
        args.push(
            "--path-traversal-config-json",
            Buffer.from(JSON.stringify(finalPathTraversalOpts)).toString("base64"),
        );
    }

    // LDAP Injection
    if (securityConf?.ldapInjection && securityConf?.enabled !== false) {
        const defaultLdapInjectOpts = {
            enabled: true,
            blockOnDetection: true,
            message: "Forbidden - LDAP Injection Detected",
            statusCode: 403,
        };
        let userLdapInjectOpts = typeof securityConf.ldapInjection === "object" ? securityConf.ldapInjection : {};
        let finalLdapInjectOpts: any = { ...defaultLdapInjectOpts, ...userLdapInjectOpts };
        if (securityConf?.routeConfig?.ldapInjection) {
            finalLdapInjectOpts.routeConfig = {
                excludeRoutes: normalizeRouteConfig(securityConf.routeConfig.ldapInjection.excludeRoutes),
                includeRoutes: normalizeRouteConfig(securityConf.routeConfig.ldapInjection.includeRoutes)
            };
        }
        args.push(
            "--ldap-inject-config-json",
            Buffer.from(JSON.stringify(finalLdapInjectOpts)).toString("base64"),
        );
    }

    // console.log("XHSC ARGS:", args.filter(a => a.startsWith("--rate-limit")));
    return args;
}


import { XStringify } from "xypriss-security";

export function buildHelmetArgs(securityConf: any, args: string[]): void {
    if (securityConf?.helmet !== false) {
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
            Buffer.from(XStringify(finalHelmetOpts)).toString("base64"),
        );
    }
}

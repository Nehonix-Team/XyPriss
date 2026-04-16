import { mergeWithDefaults } from "../../../utils/mergeWithDefaults";

export interface XyPrissCorsOptions {
    origin?:
        | boolean
        | string
        | RegExp
        | (string | RegExp)[]
        | ((
              origin: string | undefined,
              callback: (err: Error | null, allow?: boolean | string) => void,
          ) => void);
    methods?: string | string[];
    allowedHeaders?: string | string[];
    exposedHeaders?: string | string[];
    credentials?: boolean;
    maxAge?: number;
    optionsSuccessStatus?: number;
    preflightContinue?: boolean;
}

export function xyprissCors(options: XyPrissCorsOptions = {}) {
    const defaultOptions = {
        origin: true,
        methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
        preflightContinue: false,
        optionsSuccessStatus: 204,
    };

    const config: XyPrissCorsOptions = Object.assign(
        {},
        defaultOptions,
        options,
    );

    return function corsMiddleware(req: any, res: any, next: any) {
        const currentOrigin = req.headers ? req.headers.origin : undefined;

        const appendVary = (headerStr: string, field: string) => {
            if (headerStr === "*") return headerStr;
            const parts = headerStr.split(",").map((s) => s.trim());
            if (!parts.includes(field)) {
                parts.push(field);
            }
            return parts.join(", ");
        };

        const applyHeaders = (originAllowed: string | boolean) => {
            if (originAllowed === true || originAllowed === "*") {
                res.setHeader("Access-Control-Allow-Origin", "*");
            } else if (typeof originAllowed === "string") {
                res.setHeader("Access-Control-Allow-Origin", originAllowed);
                const vary = res.getHeader("Vary") || "";
                res.setHeader("Vary", appendVary(String(vary), "Origin"));
            }

            if (config.credentials) {
                res.setHeader("Access-Control-Allow-Credentials", "true");
            }
            if (config.exposedHeaders) {
                const eh = Array.isArray(config.exposedHeaders)
                    ? config.exposedHeaders.join(",")
                    : config.exposedHeaders;
                res.setHeader("Access-Control-Expose-Headers", eh);
            }

            if (req.method === "OPTIONS") {
                if (config.methods) {
                    const m = Array.isArray(config.methods)
                        ? config.methods.join(",")
                        : config.methods;
                    res.setHeader("Access-Control-Allow-Methods", m);
                }

                if (config.allowedHeaders) {
                    const ah = Array.isArray(config.allowedHeaders)
                        ? config.allowedHeaders.join(",")
                        : config.allowedHeaders;
                    res.setHeader("Access-Control-Allow-Headers", ah);
                } else if (
                    req.headers &&
                    req.headers["access-control-request-headers"]
                ) {
                    res.setHeader(
                        "Access-Control-Allow-Headers",
                        req.headers["access-control-request-headers"],
                    );
                    const vary = res.getHeader("Vary") || "";
                    res.setHeader(
                        "Vary",
                        appendVary(
                            String(vary),
                            "Access-Control-Request-Headers",
                        ),
                    );
                }

                if (config.maxAge !== undefined && config.maxAge !== null) {
                    res.setHeader(
                        "Access-Control-Max-Age",
                        String(config.maxAge),
                    );
                }

                if (!config.preflightContinue) {
                    res.statusCode = config.optionsSuccessStatus || 204;
                    // For typical frameworks setting Content-Length to 0 is cleanly handled
                    res.setHeader("Content-Length", "0");
                    res.end();
                    return;
                }
            }
            next();
        };

        if (typeof config.origin === "function") {
            const originFn = config.origin as Function;
            originFn(
                currentOrigin,
                (err: Error | null, allow?: string | boolean) => {
                    if (err) return next(err);
                    if (allow) {
                        applyHeaders(allow);
                    } else {
                        next();
                    }
                },
            );
        } else if (config.origin === true || config.origin === "*") {
            applyHeaders("*");
        } else if (typeof config.origin === "string") {
            applyHeaders(config.origin as string);
        } else {
            next();
        }
    };
}


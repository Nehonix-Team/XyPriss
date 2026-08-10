import { XStringify } from "xypriss-security";
import { getSysApi } from "../../../../../plugins/const/getSysApi";

export function buildCsrfArgs(securityConf: any, args: string[]): void {
    if (
        securityConf?.csrf === true ||
        (typeof securityConf?.csrf === "object" && securityConf.csrf.enabled !== false)
    ) {
        const defaultCsrfOpts = {
            cookieName: "__Host-psifi.x-csrf-token",
            cookieOptions: {
                httpOnly: true,
                sameSite: "strict",
                secure: getSysApi().__env__.isProduction(),
                maxAge: 3600000, // 1 hour
            },
            ignoredMethods: ["GET", "HEAD", "OPTIONS"],
            trustedOrigins: [],
            enabled: true,
        };

        let userCsrfOpts =
            typeof securityConf.csrf === "object" ? securityConf.csrf : {};
        let finalCsrfOpts = {
            ...defaultCsrfOpts,
            ...userCsrfOpts,
            cookieOptions: {
                ...defaultCsrfOpts.cookieOptions,
                ...(userCsrfOpts.cookieOptions || {}),
            },
        };

        if (userCsrfOpts.cookieOptions) {
            finalCsrfOpts.cookieOptions = {
                ...defaultCsrfOpts.cookieOptions,
                ...userCsrfOpts.cookieOptions,
            };
        }

        if (userCsrfOpts.trustedOrigins) {
            const origins = Array.isArray(userCsrfOpts.trustedOrigins)
                ? userCsrfOpts.trustedOrigins
                : [userCsrfOpts.trustedOrigins];

            finalCsrfOpts.trustedOrigins = origins.map((o: any) => {
                if (o instanceof RegExp) {
                    return o.toString();
                }
                return String(o);
            });
        }

        let dscConfig: any = {
            enabled: true,
            cookieName: "XSRF-TOKEN",
            path: "/",
        };

        if (userCsrfOpts.doubleSubmitCookie !== undefined) {
            if (typeof userCsrfOpts.doubleSubmitCookie === "object") {
                dscConfig = {
                    ...dscConfig,
                    ...userCsrfOpts.doubleSubmitCookie,
                };
            } else if (userCsrfOpts.doubleSubmitCookie === false) {
                dscConfig.enabled = false;
            }
        }
        finalCsrfOpts.doubleSubmitCookie = dscConfig;

        args.push(
            "--csrf-config-json",
            Buffer.from(XStringify(finalCsrfOpts)).toString("base64"),
        );
    }
}

import { XStringify } from "xypriss-security";
import { Configs } from "../../../../..";
import { isFeatureEnabled } from "./isFeatureEnabled";
import { normalizeRouteConfig } from "./normalizeRouteConfig";

export function buildXssArgs(securityConf: any, args: string[]): void {
    if (isFeatureEnabled(securityConf?.xss)) {
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
                excludeRoutes: normalizeRouteConfig(
                    securityConf.routeConfig.xss.excludeRoutes,
                ),
                includeRoutes: normalizeRouteConfig(
                    securityConf.routeConfig.xss.includeRoutes,
                ),
            };
        }

        args.push(
            "--xss-config-json",
            Buffer.from(XStringify(finalXssOpts)).toString("base64"),
        );
    }
}

export function buildResponseManipulationArgs(rootConf: any, args: string[]): void {
    const responseManipulation: any =
        rootConf?.responseManipulation || Configs.get("responseManipulation");
    if (isFeatureEnabled(responseManipulation)) {
        args.push(
            "--response-manipulation-config-json",
            Buffer.from(XStringify(responseManipulation)).toString("base64"),
        );
    }
}

export function buildHppArgs(securityConf: any, args: string[]): void {
    if (isFeatureEnabled(securityConf?.hpp)) {
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
            Buffer.from(XStringify(finalHppOpts)).toString("base64"),
        );
    }
}

export function buildXxeArgs(securityConf: any, args: string[]): void {
    if (isFeatureEnabled(securityConf?.xxe)) {
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
                excludeRoutes: normalizeRouteConfig(
                    securityConf.routeConfig.xxe.excludeRoutes,
                ),
                includeRoutes: normalizeRouteConfig(
                    securityConf.routeConfig.xxe.includeRoutes,
                ),
            };
        }
        args.push(
            "--xxe-config-json",
            Buffer.from(XStringify(finalXxeOpts)).toString("base64"),
        );
    }
}

export function buildSlowDownArgs(securityConf: any, args: string[]): void {
    if (isFeatureEnabled(securityConf?.slowDown)) {
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
            Buffer.from(XStringify(finalSlowDownOpts)).toString("base64"),
        );
    }
}

export function buildSqliArgs(securityConf: any, args: string[]): void {
    if (isFeatureEnabled(securityConf?.sqlInjection)) {
        const defaultSqliOpts = {
            enabled: true,
            blockOnDetection: true,
            strictMode: false,
            message: "Forbidden - SQL Injection Detected",
            statusCode: 403,
        };
        let userSqliOpts =
            typeof securityConf.sqlInjection === "object"
                ? securityConf.sqlInjection
                : {};
        let finalSqliOpts: any = { ...defaultSqliOpts, ...userSqliOpts };
        if (securityConf?.routeConfig?.sqlInjection) {
            finalSqliOpts.routeConfig = {
                excludeRoutes: normalizeRouteConfig(
                    securityConf.routeConfig.sqlInjection.excludeRoutes,
                ),
                includeRoutes: normalizeRouteConfig(
                    securityConf.routeConfig.sqlInjection.includeRoutes,
                ),
            };
        }
        args.push(
            "--sqli-config-json",
            Buffer.from(XStringify(finalSqliOpts)).toString("base64"),
        );
    }
}

export function buildCmdInjectArgs(securityConf: any, args: string[]): void {
    if (isFeatureEnabled(securityConf?.commandInjection)) {
        const defaultCmdInjectOpts = {
            enabled: true,
            blockOnDetection: true,
            message: "Forbidden - Command Injection Detected",
            statusCode: 403,
        };
        let userCmdInjectOpts =
            typeof securityConf.commandInjection === "object"
                ? securityConf.commandInjection
                : {};
        let finalCmdInjectOpts: any = {
            ...defaultCmdInjectOpts,
            ...userCmdInjectOpts,
        };
        if (securityConf?.routeConfig?.commandInjection) {
            finalCmdInjectOpts.routeConfig = {
                excludeRoutes: normalizeRouteConfig(
                    securityConf.routeConfig.commandInjection.excludeRoutes,
                ),
                includeRoutes: normalizeRouteConfig(
                    securityConf.routeConfig.commandInjection.includeRoutes,
                ),
            };
        }
        args.push(
            "--cmd-inject-config-json",
            Buffer.from(XStringify(finalCmdInjectOpts)).toString("base64"),
        );
    }
}

export function buildPathTraversalArgs(securityConf: any, args: string[]): void {
    if (isFeatureEnabled(securityConf?.pathTraversal)) {
        const defaultPathTraversalOpts = {
            enabled: true,
            blockOnDetection: true,
            message: "Forbidden - Path Traversal Detected",
            statusCode: 403,
        };
        let userPathTraversalOpts =
            typeof securityConf.pathTraversal === "object"
                ? securityConf.pathTraversal
                : {};
        let finalPathTraversalOpts: any = {
            ...defaultPathTraversalOpts,
            ...userPathTraversalOpts,
        };
        if (securityConf?.routeConfig?.pathTraversal) {
            finalPathTraversalOpts.routeConfig = {
                excludeRoutes: normalizeRouteConfig(
                    securityConf.routeConfig.pathTraversal.excludeRoutes,
                ),
                includeRoutes: normalizeRouteConfig(
                    securityConf.routeConfig.pathTraversal.includeRoutes,
                ),
            };
        }
        args.push(
            "--path-traversal-config-json",
            Buffer.from(XStringify(finalPathTraversalOpts)).toString("base64"),
        );
    }
}

export function buildLdapInjectArgs(securityConf: any, args: string[]): void {
    if (isFeatureEnabled(securityConf?.ldapInjection)) {
        const defaultLdapInjectOpts = {
            enabled: true,
            blockOnDetection: true,
            message: "Forbidden - LDAP Injection Detected",
            statusCode: 403,
        };
        let userLdapInjectOpts =
            typeof securityConf.ldapInjection === "object"
                ? securityConf.ldapInjection
                : {};
        let finalLdapInjectOpts: any = {
            ...defaultLdapInjectOpts,
            ...userLdapInjectOpts,
        };
        if (securityConf?.routeConfig?.ldapInjection) {
            finalLdapInjectOpts.routeConfig = {
                excludeRoutes: normalizeRouteConfig(
                    securityConf.routeConfig.ldapInjection.excludeRoutes,
                ),
                includeRoutes: normalizeRouteConfig(
                    securityConf.routeConfig.ldapInjection.includeRoutes,
                ),
            };
        }
        args.push(
            "--ldap-inject-config-json",
            Buffer.from(XStringify(finalLdapInjectOpts)).toString("base64"),
        );
    }
}

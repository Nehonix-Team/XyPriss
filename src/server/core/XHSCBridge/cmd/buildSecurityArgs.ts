import fs from "node:fs";
import path from "node:path";
import { getRandomBytes } from "xypriss-security";
import { getSysApi } from "../../../../plugins/const/getSysApi";
import { Configs } from "../../../..";
import { SecurityConfig } from "../../../../types";
import { buildCorsArgs } from "./builders/corsBuilder";
import { buildRateLimitArgs } from "./builders/rateLimitBuilder";
import { buildResilienceArgs } from "./builders/resilienceBuilder";
import { buildHelmetArgs } from "./builders/helmetBuilder";
import { buildCsrfArgs } from "./builders/csrfBuilder";
import {
    buildXssArgs,
    buildResponseManipulationArgs,
    buildHppArgs,
    buildXxeArgs,
    buildSlowDownArgs,
    buildSqliArgs,
    buildCmdInjectArgs,
    buildPathTraversalArgs,
    buildLdapInjectArgs,
} from "./builders/injectionBuilders";

type XSec = SecurityConfig & {
    enabled?: boolean;
};

const IrmC = Configs.get("requestManagement");

const JSON_CONFIG_MAP: Record<string, string> = {
    "--helmet-config-json": "helmet",
    "--csrf-config-json": "csrf",
    "--cors-config-json": "cors",
    "--xss-config-json": "xss",
    "--hpp-config-json": "hpp",
    "--xxe-config-json": "xxe",
    "--slowdown-config-json": "slowdown",
    "--sqli-config-json": "sqli",
    "--cmd-inject-config-json": "cmdInject",
    "--path-traversal-config-json": "pathTraversal",
    "--ldap-inject-config-json": "ldapInject",
    "--rate-limit-config": "rateLimit",
    "--response-manipulation-config-json": "responseManipulation",
};

export function buildSecurityArgs(
    securityConf: XSec | undefined,
    rmconf: typeof IrmC,
    rootConf?: any,
    app?: any,
): string[] {
    const rawArgs: string[] = [];

    buildRateLimitArgs(securityConf, rawArgs, app);

    if (securityConf && securityConf.enabled === false) {
        return rawArgs;
    }

    buildResilienceArgs(rmconf, rawArgs);
    buildHelmetArgs(securityConf, rawArgs);
    buildCorsArgs(securityConf, rawArgs);
    buildCsrfArgs(securityConf, rawArgs);
    buildXssArgs(securityConf, rawArgs);
    buildResponseManipulationArgs(rootConf, rawArgs);
    buildHppArgs(securityConf, rawArgs);
    buildXxeArgs(securityConf, rawArgs);
    buildSlowDownArgs(securityConf, rawArgs);
    buildSqliArgs(securityConf, rawArgs);
    buildCmdInjectArgs(securityConf, rawArgs);
    buildPathTraversalArgs(securityConf, rawArgs);
    buildLdapInjectArgs(securityConf, rawArgs);

    // Zero-Trust: Extract all sensitive JSON configs into an ephemeral 0600 file
    // instead of leaking Base64 secrets into process.argv (ps aux / /proc/<PID>/cmdline)
    const secConfigMap: Record<string, string> = {};
    const filteredArgs: string[] = [];

    for (let i = 0; i < rawArgs.length; i++) {
        const flag = rawArgs[i];
        if (JSON_CONFIG_MAP[flag] && i + 1 < rawArgs.length) {
            secConfigMap[JSON_CONFIG_MAP[flag]] = rawArgs[i + 1];
            i++; // Skip the payload value
        } else {
            filteredArgs.push(flag);
        }
    }

    if (Object.keys(secConfigMap).length > 0) {
        try {
            const sys = getSysApi();
            const tmpDir = sys?.path?.tmpUserDir || process.env.XYPRISS_USER_TMP || "/tmp";
            const configPath = path.join(
                tmpDir,
                `.xhsc-sec-${getRandomBytes(8).toString("hex")}.json`,
            );
            fs.writeFileSync(configPath, JSON.stringify(secConfigMap), {
                mode: 0o600,
            });
            filteredArgs.push("--config-file", configPath);
        } catch (e) {
            // Fallback to raw args if writing temp file fails
            return rawArgs;
        }
    }

    return filteredArgs;
}


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

export function buildSecurityArgs(
    securityConf: XSec | undefined,
    rmconf: typeof IrmC,
    rootConf?: any,
    app?: any,
): string[] {
    const args: string[] = [];

    buildRateLimitArgs(securityConf, args, app);

    if (securityConf && securityConf.enabled === false) {
        return args;
    }
    buildResilienceArgs(rmconf, args);
    buildHelmetArgs(securityConf, args);
    buildCsrfArgs(securityConf, args);
    buildXssArgs(securityConf, args);
    buildResponseManipulationArgs(rootConf, args);
    buildHppArgs(securityConf, args);
    buildXxeArgs(securityConf, args);
    buildSlowDownArgs(securityConf, args);
    buildSqliArgs(securityConf, args);
    buildCmdInjectArgs(securityConf, args);
    buildPathTraversalArgs(securityConf, args);
    buildLdapInjectArgs(securityConf, args);

    return args;
}

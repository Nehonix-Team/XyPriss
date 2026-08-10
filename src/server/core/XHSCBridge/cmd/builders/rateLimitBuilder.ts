import { XStringify } from "xypriss-security";
import { normalizeXtrsRules } from "../../../../../utils/xtrsParser";

export function buildRateLimitArgs(securityConf: any, args: string[]): void {
    const rl = securityConf?.rateLimit;
    if (rl) {
        args.push("--rate-limit");
        if (typeof rl === "object") {
            const xtrsRules = normalizeXtrsRules(rl);
            if (xtrsRules.length > 0) {
                const primaryRule = xtrsRules[0];
                const effectiveWindowMs = primaryRule.blockDurationMs ?? primaryRule.windowMs;
                args.push("--rate-limit-max", primaryRule.max.toString());
                args.push("--rate-limit-window", effectiveWindowMs.toString());
            } else {
                if (rl.max !== undefined)
                    args.push("--rate-limit-max", rl.max.toString());
                if (rl.windowMs !== undefined)
                    args.push("--rate-limit-window", rl.windowMs.toString());
            }
            const primaryRule = xtrsRules.length > 0 ? xtrsRules[0] : undefined;
            const effectiveMessage =
                primaryRule?.message ??
                (typeof rl.xtrs === "object" ? rl.xtrs?.message : undefined) ??
                rl.message;
            if (effectiveMessage)
                args.push(
                    "--rate-limit-message",
                    typeof effectiveMessage === "string"
                        ? effectiveMessage
                        : XStringify(effectiveMessage),
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
}

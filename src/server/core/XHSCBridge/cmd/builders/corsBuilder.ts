import { XStringify } from "xypriss-security";
import { isFeatureEnabled } from "./isFeatureEnabled";

export function buildCorsArgs(securityConf: any, args: string[]): void {
    if (isFeatureEnabled(securityConf?.cors)) {
        let userCorsOpts: any =
            typeof securityConf?.cors === "object" ? securityConf.cors : {};

        let finalCorsOpts: any = { ...userCorsOpts };

        if (finalCorsOpts.origin) {
            if (Array.isArray(finalCorsOpts.origin)) {
                finalCorsOpts.origin = finalCorsOpts.origin.map((o: any) =>
                    o instanceof RegExp ? o.toString() : String(o),
                );
            } else if (finalCorsOpts.origin instanceof RegExp) {
                finalCorsOpts.origin = finalCorsOpts.origin.toString();
            }
        }

        args.push(
            "--cors-config-json",
            Buffer.from(XStringify(finalCorsOpts)).toString("base64"),
        );
    }
}

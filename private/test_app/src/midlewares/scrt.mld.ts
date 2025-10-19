import type { UltraFastApp, Response, Request } from "../../../../src";
import { NehoID as ID } from "nehoid";

export function securityMdlw(app: UltraFastApp, max = 50) {
    // en mode multiserve, ce n'est pas disponible
    const mdlw = app?.middleware();
    mdlw?.security({
        csrf: {},
        cors: {
            origin: "*",
            methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
            credentials: true,
        },
        helmet: {},
        rateLimit: {
            max: 300,
            handler(req: Request, res: Response, next) {
                // req.setHeaders({ "ratelimit-limit": 3 });
                const headers = new Map([["x-powered-by", "NEHONIX"]]);
                res.setHeaders(headers);
                res.status(429).json({ ...req.headers });
            },
        },
    });

    mdlw?.enable(ID.generate({ prefix: "mdlw" }));
}


export interface XyPrissHPPOptions {
    checkQuery?: boolean;
    checkBody?: boolean;
    whitelist?: string[];
}

export function xyprissHPP(options: XyPrissHPPOptions = {}) {
    const checkQuery = options.checkQuery !== false;
    const checkBody = options.checkBody !== false;
    const whitelist = Array.isArray(options.whitelist)
        ? options.whitelist.filter((w) => typeof w === "string")
        : [];

    function putAside(req: any, keyReqPart: string, keyPolluted: string) {
        const reqPart = req[keyReqPart];
        if (!reqPart || typeof reqPart !== "object") return;

        let reqPolluted = req[keyPolluted];

        if (reqPolluted === undefined) {
            reqPolluted = req[keyPolluted] = {};

            const parameters = Object.keys(reqPart);
            for (let i = 0; i < parameters.length; i++) {
                const paramKey = parameters[i];
                const paramValue = reqPart[paramKey];

                if (!Array.isArray(paramValue)) {
                    continue;
                }

                reqPolluted[paramKey] = paramValue;
                // Prends le dernier élément du tableau pour éviter la pollution de variables multiples
                reqPart[paramKey] = paramValue[paramValue.length - 1];
            }
        }

        if (whitelist.length > 0) {
            for (let k = 0; k < whitelist.length; k++) {
                const whitelistedParam = whitelist[k];
                if (reqPolluted[whitelistedParam]) {
                    reqPart[whitelistedParam] = reqPolluted[whitelistedParam];
                    delete reqPolluted[whitelistedParam];
                }
            }
        }
    }

    return function hppMiddleware(req: any, res: any, next: any) {
        if (checkQuery && req.query) {
            putAside(req, "query", "queryPolluted");
        }

        if (checkBody && req.body) {
            // Optionnellement, vérifier le header Content-Type pour url-encoded ou autres formats
            // mais ici on s'aligne globalement sur ce qui a déjà été parsé.
            putAside(req, "body", "bodyPolluted");
        }

        next();
    };
}


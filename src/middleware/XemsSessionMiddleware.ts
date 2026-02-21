import { xems } from "../plugins/modules/xems/XemsPlugin";
import {
    XyPrisRequest,
    XyPrisResponse,
    NextFunction,
} from "../types/httpServer.type";
import { XemsTypes } from "../types/xems.type";

/**
 * XEMS Session Middleware
 * Implements the "Moving Target Defense" for sessions by rotating tokens on every request.
 */
export function xemsSession(options: XemsTypes) {
    // const op;
    const sandbox = options.sandbox || "auth-session";
    const cookieName = options.cookieName || "xems_token";
    const headerName = options.headerName || "x-xypriss-token";
    const ttl = options.ttl || "15m";
    const attachTo = options.attachTo || "session";
    const autoRotation = options.autoRotation !== false;

    const cookieOptions = options.cookieOptions;

    return async (
        req: XyPrisRequest,
        res: XyPrisResponse,
        next: NextFunction,
    ) => {
        // 1. Extract token from Cookie or Header
        let token =
            req.cookies[cookieName] || (req.headers[headerName] as string);

        console.log({
            cookies: req.cookies[cookieName],
            headers: req.headers[headerName] as string,
        });

        // 2. Add a helper to initialize a session (xLink)
        res.xLink = async (data: any) => {
            const newToken = await xems.createSession(sandbox, data, { ttl });
            (res as any)._xemsNewToken = newToken;

            // Apply immediately to current response
            res.cookie(cookieName, newToken, cookieOptions);
            console.log("data: ", data);
            res.setHeader(headerName, newToken);

            (req as any)[attachTo] = data;

            return newToken;
        };

        if (token) {
            try {
                // 3. Read session data and perform rotation
                const session = await xems.resolveSession(token, {
                    sandbox,
                    rotate: autoRotation,
                    ttl,
                });

                if (session) {
                    // Attach data to request
                    (req as any)[attachTo] = session.data;

                    if (autoRotation && session.newToken) {
                        // Store new token for response injection
                        (res as any)._xemsNewToken = session.newToken;

                        // Intercept response methods to inject the new token
                        const originalSend = res.send;
                        res.send = function (body: any) {
                            if ((res as any)._xemsNewToken) {
                                res.cookie(
                                    cookieName,
                                    (res as any)._xemsNewToken,
                                    cookieOptions,
                                );
                                res.setHeader(
                                    headerName,
                                    (res as any)._xemsNewToken,
                                );
                            }
                            return originalSend.call(this, body);
                        };

                        // Also intercept json
                        const originalJson = res.json;
                        res.json = function (data: any) {
                            if ((res as any)._xemsNewToken) {
                                res.cookie(
                                    cookieName,
                                    (res as any)._xemsNewToken,
                                    cookieOptions,
                                );
                                res.setHeader(
                                    headerName,
                                    (res as any)._xemsNewToken,
                                );
                            }
                            return originalJson.call(this, data);
                        };
                    }
                }
            } catch (error) {
                // Session might be expired or invalid, we just let it pass
                // The dev can check if req.session exists in their handlers
            }
        }

        next();
    };
}


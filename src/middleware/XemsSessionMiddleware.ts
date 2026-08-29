import { xems } from "../plugins/builtin/xems/XemsPlugin";
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
        // 0. Get the correct XEMS runner (handles persistence from app config)
        const runner = xems.forApp(req.app as any);

        // 1. Extract token from Cookie or Header
        let token =
            req.cookies[cookieName] || (req.headers[headerName] as string);

        // 2. Add a helper to initialize a session (xLink)
        res.xLink = async (
            data: any,
            linkOptions?:
                | { sandbox?: string; attachTo?: string; ttl?: string }
                | string,
        ) => {
            let actualSandbox = sandbox;
            let actualAttachTo = attachTo;
            let actualTtl = ttl;

            if (typeof linkOptions === "string") {
                actualSandbox = linkOptions;
            } else if (linkOptions) {
                if (linkOptions.sandbox) actualSandbox = linkOptions.sandbox;
                if (linkOptions.attachTo) actualAttachTo = linkOptions.attachTo;
                if (linkOptions.ttl) actualTtl = linkOptions.ttl;
            }

            const newToken = await runner.createSession(actualSandbox, data, {
                ttl: actualTtl,
            });
            (res as any)._xemsNewToken = newToken;

            // Apply immediately to current response
            res.cookie(cookieName, newToken, cookieOptions);
            res.setHeader(headerName, newToken);

            (req as any)[actualAttachTo] = data;

            return newToken;
        };

        // 2b. Add a helper to destroy a session (xUnlink)
        res.xUnlink = async (
            unlinkOptions?: { sandbox?: string; attachTo?: string } | string,
        ) => {
            let actualSandbox = sandbox;
            let actualAttachTo = attachTo;

            if (typeof unlinkOptions === "string") {
                actualSandbox = unlinkOptions;
            } else if (unlinkOptions) {
                if (unlinkOptions.sandbox)
                    actualSandbox = unlinkOptions.sandbox;
                if (unlinkOptions.attachTo)
                    actualAttachTo = unlinkOptions.attachTo;
            }

            // Also delete the newly generated rotated token if rotation happened during this request
            const newlyRotatedToken = (res as any)._xemsNewToken;
            if (newlyRotatedToken && newlyRotatedToken !== currentToken) {
                await runner.from(actualSandbox).del(newlyRotatedToken);
            }

            // Invalidate pending token injection on response
            (res as any)._xemsNewToken = null;

            res.clearCookie(cookieName, {
                ...cookieOptions,
                path: cookieOptions.path || "/",
                domain: cookieOptions.domain,
            });
            res.removeHeader(headerName);
            (req as any)[actualAttachTo] = null;
        };

        if (token) {
            try {
                // 3. Read session data and perform rotation
                const session = await runner.resolveSession(token, {
                    sandbox,
                    rotate: autoRotation,
                    ttl,
                    gracePeriod: options.gracePeriod,
                });

                if (session) {
                    // Attach data to request
                    (req as any)[attachTo] = session.data;

                    if (session.newToken) {
                        // Store new token for response injection
                        (res as any)._xemsNewToken = session.newToken;

                        const applySessionToken = () => {
                            const newToken = (res as any)._xemsNewToken;
                            if (newToken && !res.headersSent) {
                                res.cookie(
                                    cookieName,
                                    newToken,
                                    cookieOptions,
                                );
                                res.setHeader(
                                    headerName,
                                    newToken,
                                );
                            }
                        };

                        // Intercept response methods to inject the new token
                        const originalSend = res.send;
                        res.send = function (body: any) {
                            applySessionToken();
                            return originalSend.call(this, body);
                        };

                        // Also intercept json
                        const originalJson = res.json;
                        res.json = function (data: any) {
                            applySessionToken();
                            return originalJson.call(this, data);
                        };

                        // Intercept xJson (used by Send helper)
                        const originalXJson = (res as any).xJson;
                        if (typeof originalXJson === "function") {
                            (res as any).xJson = function (data: any) {
                                applySessionToken();
                                return originalXJson.call(this, data);
                            };
                        }

                        // Intercept end
                        const originalEnd = res.end;
                        res.end = function (...args: any[]) {
                            applySessionToken();
                            return (originalEnd as any).apply(this, args);
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


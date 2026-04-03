/**
 * XEMS Core Built-in Plugin
 *
 * Handles the initialization, validation, and lifecycle of XEMS (XyPriss Entry Management System).
 * Provides the core persistent storage and session management capabilities.
 *
 * Identifier: xypriss::xems.core
 */

import { Configs } from "../../../config";
import type { XyPrissPlugin, PluginServer } from "../../types/PluginTypes";
import type { Request, Response, NextFunction } from "../../../types/types";
import { xems, XemsRunner } from "./XemsPlugin";

export class XemsBuiltinPlugin implements XyPrissPlugin {
    public readonly name = "xypriss::xems.core";
    public readonly version = "1.1.0";
    public readonly type = "security";
    public readonly description =
        "XyPriss Entry Management System (Session & Storage)";

    private runner: XemsRunner;

    private sessionOptions: {
        sandbox: string;
        cookieName: string;
        headerName: string;
        ttl: string;
        autoRotation: boolean;
        attachTo: string;
        gracePeriod: number;
    } = {
        sandbox: "xems.internal-session",
        cookieName: "xems_token",
        headerName: "x-xypriss-token",
        ttl: "15m",
        autoRotation: true,
        attachTo: "session",
        gracePeriod: 1000,
    };

    private hasValidSecret: boolean = false;

    constructor() {
        // Create a dedicated runner for this server instance to allow
        // multiple servers to have isolated XEMS processes.
        this.runner = new XemsRunner();
    }

    /**
     * Initialize XEMS with system configuration
     */
    public async onServerStart(server: PluginServer): Promise<void> {
        const app = server.app as any;
        const logger = (app as any).logger;

        // Use the config from the app instance to avoid race conditions in multi-server mode
        const xemsConfig =
            app.configs?.server?.xems || Configs.get("server")?.xems;

        // Expose this instance's runner on the app object for multi-server support
        app.xems = this.runner;

        if (!xemsConfig?.enable) return;

        logger.info("plugins", "Initializing XEMS Built-in Core Plugin...");

        // 1. Configuration Extraction
        const xemsOptions = xemsConfig;

        // Apply session options from config or defaults
        this.sessionOptions = {
            sandbox: xemsOptions.sandbox || "auth-session",
            cookieName: xemsOptions.cookieName || "xems_token",
            headerName: xemsOptions.headerName || "x-xypriss-token",
            ttl: xemsOptions.ttl || "15m",
            autoRotation: xemsOptions.autoRotation !== false,
            attachTo: xemsOptions.attachTo || "session",
            gracePeriod: xemsOptions.gracePeriod || 1000,
        };

        logger.info(
            "plugins",
            `XEMS Session Sandbox: ${this.sessionOptions.sandbox}`,
        );

        // Check for valid secret (mandatory for any XEMS API usage)
        const secret = xemsOptions.persistence?.secret;
        if (
            secret &&
            typeof secret === "string" &&
            Buffer.byteLength(secret, "utf8") === 32
        ) {
            this.hasValidSecret = true;
        } else if (xemsOptions.persistence?.enabled) {
            logger.error(
                "plugins",
                "XEMS Persistence enabled but no valid 32-byte secret found.",
            );
        }

        // 2. Persistence Initialization
        if (xemsOptions.persistence?.enabled) {
            const { path, secret, resources } = xemsOptions.persistence;

            logger.debug(
                "plugins",
                `Enabling XEMS Persistence: ${path} (Secret: provided, Cache: ${resources?.cacheSize || "default"})`,
            );

            try {
                this.runner.enablePersistence(path!, secret, {
                    cacheSize: resources?.cacheSize,
                });
            } catch (err) {
                logger.error(
                    "plugins",
                    "Failed to enable XEMS persistence",
                    err,
                );
            }
        }

        // 3. Resource & Health Validation (Warmup)
        try {
            const startTime = performance.now();
            const pong = await this.runner.ping();
            const duration = performance.now() - startTime;

            if (pong === "pong" || pong) {
                logger.info(
                    "plugins",
                    `XEMS Core validated successfully (Ping: ${duration.toFixed(3)}ms)`,
                );
            } else {
                logger.warn(
                    "plugins",
                    "XEMS Core returned unexpected ping response",
                );
            }
        } catch (e) {
            logger.error(
                "plugins",
                "XEMS Core health check failed. Binary might be missing or crashed.",
                e,
            );
        }
    }

    /**
     * Native/Fast validation logic (runs on every request)
     */
    public async onRequest(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        const { sandbox, cookieName, headerName, ttl, autoRotation, attachTo } =
            this.sessionOptions;

        // 1. Token Extraction
        const token =
            (req.cookies && req.cookies[cookieName]) ||
            (req.headers[headerName] as string);

        // 2. Inject xLink (Session Initiation)
        (res as any).xLink = async (
            data: any,
            linkOptions?:
                | { sandbox?: string; attachTo?: string; ttl?: string }
                | string,
        ) => {
            if (!this.hasValidSecret) {
                throw new Error(
                    "[XEMS] CRITICAL: Attempted to use XEMS API (xLink) without a valid 32-byte secret key configured. " +
                        "Security policy requires a mandatory encryption key.",
                );
            }

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

            const newToken = await this.runner
                .from(actualSandbox)
                .createSession(data, {
                    ttl: actualTtl,
                });
            (res as any)._xemsNewToken = newToken;

            // Apply immediately
            res.cookie(cookieName, newToken, {
                httpOnly: true,
                secure: true,
                sameSite: "strict",
            });
            res.setHeader(headerName, newToken);

            (req as any)[actualAttachTo] = data;
            return newToken;
        };

        // 2b. Inject xUnlink (Session Termination)
        (res as any).xUnlink = async (
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

            const currentToken =
                (req.cookies && req.cookies[cookieName]) ||
                (req.headers[headerName] as string);

            if (currentToken) {
                await this.runner.from(actualSandbox).del(currentToken);
            }

            res.clearCookie(cookieName);
            res.removeHeader(headerName);
            (req as any)[actualAttachTo] = null;
        };

        // 3. Session Recovery & Rotation
        if (token && this.hasValidSecret) {
            try {
                const session = await this.runner.from(sandbox).rotate(token, {
                    ttl,
                    gracePeriod: this.sessionOptions.gracePeriod,
                });

                if (session) {
                    (req as any)[attachTo] = session.data;

                    if (autoRotation && session.newToken) {
                        (res as any)._xemsNewToken = session.newToken;

                        // Intercept response methods to inject the rotated token
                        const originalSend = res.send;
                        res.send = function (this: any, body: any) {
                            const newToken = (res as any)._xemsNewToken;
                            if (newToken) {
                                res.cookie(cookieName, newToken, {
                                    httpOnly: true,
                                    secure: true,
                                    sameSite: "strict",
                                });
                                res.setHeader(headerName, newToken);
                            }
                            return originalSend.call(this, body);
                        };

                        const originalJson = res.json;
                        res.json = function (this: any, data: any) {
                            const newToken = (res as any)._xemsNewToken;
                            if (newToken) {
                                res.cookie(cookieName, newToken, {
                                    httpOnly: true,
                                    secure: true,
                                    sameSite: "strict",
                                });
                                res.setHeader(headerName, newToken);
                            }
                            return originalJson.call(this, data);
                        } as any;
                    }
                }
            } catch (err) {
                // Ignore session recovery errors (expired/invalid)
            }
        }

        next();
    }

    /**
     * Cleanup resources on server stop
     */
    public async onServerStop(): Promise<void> {
        if (this.runner) {
            this.runner.destroy();
        }
    }
}


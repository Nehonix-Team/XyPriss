/**
 * XEMS Core Built-in Plugin
 *
 * Handles the initialization, validation, and lifecycle of XEMS (XyPriss Entry Management System).
 * Provides the core persistent storage and session management capabilities.
 *
 * Identifier: xypriss::nehonix.xems.core
 */

import { Configs } from "../../../config";
import { XemsTypes } from "../../../types/xems.type";
import {
    BasePlugin,
    PluginType,
    PluginPriority,
    PluginInitializationContext,
    PluginExecutionContext,
    PluginExecutionResult,
} from "../types/PluginTypes";
import { xems, XemsRunner } from "./XemsPlugin";

export class XemsBuiltinPlugin implements BasePlugin {
    public readonly id = "xypriss::nehonix.xems.core";
    public readonly name = "XEMS Core Built-in Plugin";
    public readonly version = "1.1.0";
    public readonly type = PluginType.SECURITY;
    public readonly priority = PluginPriority.CRITICAL;
    public readonly maxExecutionTime = 5; // 5ms for validation and logic
    public readonly isAsync = true;
    public readonly isCacheable = false;

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
        this.runner = xems;
    }

    /**
     * Initialize XEMS with system configuration
     */
    public async initialize(
        context: PluginInitializationContext,
    ): Promise<void> {
        const cfg = Configs.get("server")?.xems;
        if (!cfg?.enable) return;
        const logger = context.logger;
        logger.info("plugins", "Initializing XEMS Built-in Core Plugin...");

        // 1. Configuration Extraction
        // Use the centralized ConfigurationManager (Configs)
        const serverConfig = Configs.get("server");
        const xemsConfig = serverConfig?.xems as XemsTypes;

        // Support both boolean 'true' and configuration object
        if (!xemsConfig) return;
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
                // process.exit(1);
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
    public async execute(
        context: PluginExecutionContext,
    ): Promise<PluginExecutionResult> {
        const { req, res } = context;
        const { sandbox, cookieName, headerName, ttl, autoRotation, attachTo } =
            this.sessionOptions;

        // 1. Token Extraction
        const token =
            (req.cookies && req.cookies[cookieName]) ||
            (req.headers[headerName] as string);

        // 2. Inject xLink (Session Initiation)
        res.xLink = async (data: any, customSandbox?: string) => {
            if (!this.hasValidSecret) {
                throw new Error(
                    "[XEMS] CRITICAL: Attempted to use XEMS API (xLink) without a valid 32-byte secret key configured. " +
                        "Security policy requires a mandatory encryption key.",
                );
            }

            const targetSandbox = customSandbox || sandbox;
            const newToken = await this.runner.createSession(
                targetSandbox,
                data,
                {
                    ttl,
                },
            );
            (res as any)._xemsNewToken = newToken;

            // Apply immediately
            res.cookie(cookieName, newToken, {
                httpOnly: true,
                secure: true,
                sameSite: "strict",
            });
            res.setHeader(headerName, newToken);

            (req as any)[attachTo] = data;
            return newToken;
        };

        // 3. Session Recovery & Rotation
        if (token && this.hasValidSecret) {
            try {
                const session = await this.runner.resolveSession(token, {
                    sandbox,
                    rotate: autoRotation,
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

        return {
            success: true,
            executionTime: 0, // Will be measured by Engine
            shouldContinue: true,
        };
    }

    /**
     * Cleanup resources on server stop
     */
    public async cleanup(): Promise<void> {
        // XEMS runner handles its own lifecycle usually,
        // but we can explicitly kill the process if needed.
        // For now, let it be handled by the OS/Process manager.
    }
}


/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2026 Nehonix. All rights reserved.
 ***************************************************************************** */

import { CompiledMiddlewareItem } from "./XmtgTypes";
import {
    XyPrisRequest as Request,
    XyPrisResponse as Response,
} from "../../../types/httpServer.type";

/**
 * Thrown when an individual middleware exceeds its declared timeoutMs duration.
 */
export class XmtgTimeoutError extends Error {
    constructor(
        public middlewareId: string,
        public timeoutMs: number,
    ) {
        super(
            `[XMTG Timeout] Middleware "${middlewareId}" exceeded max execution duration of ${timeoutMs}ms`,
        );
        this.name = "XmtgTimeoutError";
    }
}

/**
 * XMTG High-Performance Pipeline Executor
 */
export class XmtgExecutor {
    /**
     * Executes a compiled pipeline against an incoming request/response pair.
     *
     * @returns {Promise<boolean>} true if the chain completed and can proceed to the route handler,
     *                             false if a middleware ended the response or aborted.
     */
    public static async execute(
        items: CompiledMiddlewareItem[],
        req: Request,
        res: Response,
    ): Promise<boolean> {
        let currentError: any = null;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // 1. Error Handler segregation
            if (item.isErrorHandler) {
                if (!currentError) {
                    continue; // Skip error handlers during normal execution
                }
            } else {
                if (currentError) {
                    continue; // Skip normal middleware while an unhandled error is propagating
                }
            }

            try {
                if (item.timeoutMs && item.timeoutMs > 0) {
                    await this.executeWithTimeout(item, req, res, currentError);
                } else {
                    await this.executeDirect(item, req, res, currentError);
                }

                if (item.isErrorHandler) {
                    // If an error handler ran successfully, clear the error flag (Express recovery behavior)
                    currentError = null;
                }

                if (res.writableEnded) {
                    return false; // Middleware responded directly: halt chain
                }
            } catch (err) {
                currentError = err;
            }
        }

        if (currentError) {
            // Re-throw unhandled error so outer error boundary or 500 handler catches it
            throw currentError;
        }

        return !res.writableEnded;
    }

    /**
     * Alias for backward and stress-test compatibility.
     */
    public static Exec = XmtgExecutor.execute;

    /**
     * Executes a middleware directly without timer overhead.
     */
    private static executeDirect(
        item: CompiledMiddlewareItem,
        req: Request,
        res: Response,
        error: any,
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let done = false;

            const onFinish = () => {
                if (!done) {
                    done = true;
                    resolve();
                }
            };

            res.once("finish", onFinish);

            const next = (err?: any) => {
                if (done) return;
                done = true;
                res.removeListener("finish", onFinish);
                if (err) reject(err);
                else resolve();
            };

            try {
                const ret = item.isErrorHandler
                    ? (item.handler as any)(error, req, res, next)
                    : item.handler(req, res, next);

                // Handle async handlers that throw or return rejected promises without calling next(err)
                if (ret && typeof (ret as any).catch === "function") {
                    (ret as Promise<any>).catch((asyncErr) => next(asyncErr));
                }

                if (res.writableEnded) {
                    res.removeListener("finish", onFinish);
                    done = true;
                    resolve();
                }
            } catch (syncErr) {
                res.removeListener("finish", onFinish);
                done = true;
                reject(syncErr);
            }
        });
    }

    /**
     * Executes a middleware with strict timeout enforcement.
     */
    private static executeWithTimeout(
        item: CompiledMiddlewareItem,
        req: Request,
        res: Response,
        error: any,
    ): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            let done = false;

            const timer = setTimeout(() => {
                if (!done) {
                    done = true;
                    res.removeListener("finish", onFinish);
                    reject(new XmtgTimeoutError(item.id, item.timeoutMs!));
                }
            }, item.timeoutMs);

            const onFinish = () => {
                if (!done) {
                    done = true;
                    clearTimeout(timer);
                    resolve();
                }
            };

            res.once("finish", onFinish);

            const next = (err?: any) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                res.removeListener("finish", onFinish);
                if (err) reject(err);
                else resolve();
            };

            try {
                const ret = item.isErrorHandler
                    ? (item.handler as any)(error, req, res, next)
                    : item.handler(req, res, next);

                // Handle async handlers that throw or return rejected promises without calling next(err)
                if (ret && typeof (ret as any).catch === "function") {
                    (ret as Promise<any>).catch((asyncErr) => next(asyncErr));
                }

                if (res.writableEnded) {
                    clearTimeout(timer);
                    res.removeListener("finish", onFinish);
                    done = true;
                    resolve();
                }
            } catch (syncErr) {
                clearTimeout(timer);
                res.removeListener("finish", onFinish);
                done = true;
                reject(syncErr);
            }
        });
    }
}


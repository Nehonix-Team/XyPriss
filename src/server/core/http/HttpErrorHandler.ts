import { Logger } from "../../../shared/logger/Logger";
import { NotFoundHandler } from "../../handlers/NotFoundHandler";
import {
    XyPrisRequest,
    XyPrisResponse,
    NextFunction,
} from "../../../types/httpServer.type";
import { ServerOptions } from "../../../types/types";

/**
 * HttpErrorHandler - Handles request errors and 404 responses.
 */
export class HttpErrorHandler {
    private logger: Logger;
    private notFoundHandler: NotFoundHandler;

    constructor(logger: Logger, notFoundHandler: NotFoundHandler) {
        this.logger = logger;
        this.notFoundHandler = notFoundHandler;
    }

    public async send404(
        req: XyPrisRequest,
        res: XyPrisResponse,
        responseControl?: ServerOptions["responseControl"],
    ): Promise<void> {
        if (responseControl?.enabled) {
            try {
                res.statusCode = responseControl.statusCode || 404;
                if (responseControl.headers) res.set(responseControl.headers);
                if (responseControl.contentType)
                    res.setHeader("Content-Type", responseControl.contentType);
                if (responseControl.handler) {
                    await responseControl.handler(req, res);
                    return;
                }
                if (responseControl.content !== undefined) {
                    if (typeof responseControl.content === "object")
                        res.json(responseControl.content);
                    else res.send(responseControl.content);
                    return;
                }
                res.send(`Route not found: ${req.method} ${req.path}`);
            } catch (error) {
                this.notFoundHandler.handler(req as any, res as any);
            }
        } else {
            this.notFoundHandler.handler(req as any, res as any);
        }
    }

    public handleError(
        error: any,
        req: XyPrisRequest,
        res: XyPrisResponse,
        app: any,
        errorHandler?: (
            error: any,
            req: XyPrisRequest,
            res: XyPrisResponse,
            next: NextFunction,
        ) => void,
        send404Callback?: (
            req: XyPrisRequest,
            res: XyPrisResponse,
        ) => Promise<void>,
    ): void {
        this.logger.error("server", `Request error: ${error.message}`, error);

        const pluginManager = app?.pluginManager;
        if (
            pluginManager &&
            typeof pluginManager.triggerRouteError === "function"
        ) {
            pluginManager.triggerRouteError(error, req, res);
        }

        if (errorHandler) {
            errorHandler(error, req, res, () => {
                if (!res.writableEnded)
                    this.sendErrorResponse(res, 500, "Internal Server Error");
            });
        } else {
            this.sendErrorResponse(res, 500, "Internal Server Error");
        }
    }

    public sendErrorResponse(
        res: XyPrisResponse,
        statusCode: number,
        message: string,
    ): void {
        if (!res.headersSent) res.status(statusCode).json({ error: message });
    }

    public setupDefaultErrorHandler(server: any): void {
        server.on("error", (error: any) => {
            this.logger.error("server", `Server error: ${error.message}`);
        });
    }
}


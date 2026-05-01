import { XyPrisRequest, XyPrisResponse } from "../../../types/httpServer.type";
import { ServerOptions } from "../../../types/types";
import { Logger } from "../../../shared/logger/Logger";

/**
 * ResponseControlManager - Logic for custom response control (e.g. custom 404s)
 * Works for both Single Server and Multi-Server (XMS) modes.
 */
export class ResponseControlManager {
    private config?: ServerOptions["responseControl"];

    constructor(private logger: Logger) {}

    /**
     * Update the response control configuration
     */
    public setConfig(config: ServerOptions["responseControl"]): void {
        this.config = config;
    }

    /**
     * Execute the custom response if enabled
     * @returns boolean true if the response was handled, false otherwise
     */
    public async handleCustomResponse(
        req: XyPrisRequest,
        res: XyPrisResponse,
    ): Promise<boolean> {
        if (!this.config?.enabled) {
            return false;
        }

        try {
            const { statusCode, headers, contentType, handler, content } = this.config;

            // 1. Set status code
            res.statusCode = statusCode || 404;

            // 2. Set custom headers
            if (headers) {
                res.set(headers);
            }

            // 3. Set content type
            if (contentType) {
                res.setHeader("Content-Type", contentType);
            }

            // 4. Execute custom handler if provided
            if (handler) {
                await handler(req, res);
                return true;
            }

            // 5. Send custom content if provided
            if (content !== undefined) {
                if (typeof content === "object") {
                    res.json(content);
                } else {
                    res.send(content);
                }
                return true;
            }

            // Default fallback if enabled but no content/handler
            res.send(`Route not found: ${req.method} ${req.path}`);
            return true;
        } catch (error: any) {
            this.logger.error(
                "server",
                `ResponseControlManager: Error executing custom response: ${error.message}`,
            );
            return false; // Fallback to default NotFoundHandler
        }
    }
}

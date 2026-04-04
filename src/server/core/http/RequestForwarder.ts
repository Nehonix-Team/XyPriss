import { Logger } from "../../../shared/logger/Logger";
import { XyPrisRequest } from "../../../types/httpServer.type";

/**
 * RequestForwarder - Handles server-side request forwarding (req.forward).
 */
export class RequestForwarder {
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    public async forward(
        req: any,
        XyPrisReq: XyPrisRequest,
        url: string,
        options: any = {},
    ): Promise<any> {
        const targetUrl = url.startsWith("http")
            ? url
            : `http://localhost:${req.socket.localPort}${url.startsWith("/") ? "" : "/"}${url}`;

        const forwardOptions = {
            method: options.method || XyPrisReq.method,
            headers: {
                ...XyPrisReq.headers,
                ...options.headers,
            },
            body:
                options.body ||
                (XyPrisReq.method !== "GET" && XyPrisReq.method !== "HEAD"
                    ? JSON.stringify(XyPrisReq.body)
                    : undefined),
            ...options,
        };

        // Remove headers that might cause issues with forwarding
        delete forwardOptions.headers["host"];
        delete forwardOptions.headers["content-length"];

        try {
            const response = await fetch(targetUrl, forwardOptions);
            const contentType = response.headers.get("content-type");

            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            }
            return await response.text();
        } catch (error) {
            this.logger.error(
                "server",
                `Forwarding request to ${targetUrl} failed: ${error}`,
            );
            throw error;
        }
    }
}


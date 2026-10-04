import { XJsonResponseHandler } from "../../../middleware/XJsonResponseHandler";
import { XyPrisRequest } from "../../../types/httpServer.type";

/**
 * BodyParser - Handles request body parsing for JSON, URL-encoded, and other formats.
 */
export class BodyParser {
    public static async parse(req: XyPrisRequest): Promise<void> {
        // Fast path: Body already decoded into an object (JSON or parsed Form)
        if (req.body !== undefined && req.body !== null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
            return;
        }

        const contentType = req.headers["content-type"] || "";
        if (contentType.includes("multipart/form-data")) {
            return;
        }

        // If body is already attached as a Buffer or string, parse it directly without stream wait
        if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
            const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body;
            if (contentType.includes("application/json") || (!contentType && (bodyStr.startsWith("{") || bodyStr.startsWith("[")))) {
                try {
                    req.body = bodyStr ? XJsonResponseHandler.parse(bodyStr) : {};
                } catch {
                    req.body = bodyStr;
                }
            } else if (contentType.includes("application/x-www-form-urlencoded")) {
                const params = new URLSearchParams(bodyStr);
                const bodyObj: Record<string, string> = {};
                for (const [key, value] of params.entries()) {
                    bodyObj[key] = value;
                }
                req.body = bodyObj;
            } else {
                req.body = bodyStr;
            }
            return;
        }

        return new Promise((resolve, reject) => {

            let body = "";
            req.on("data", (chunk) => {
                body += chunk.toString();
            }); 
            req.on("end", () => {
                try {
                    if (contentType.includes("application/json")) {
                        req.body = body ? XJsonResponseHandler.parse(body) : {};
                    } else if (
                        contentType.includes(
                            "application/x-www-form-urlencoded",
                        )
                    ) {
                        const params = new URLSearchParams(body);
                        const bodyObj: Record<string, string> = {};
                        for (const [key, value] of params.entries()) {
                            bodyObj[key] = value;
                        }
                        req.body = bodyObj;
                    } else {
                        req.body = body;
                    }
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
            req.on("error", reject);
        });
    }
}


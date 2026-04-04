import { XJsonResponseHandler } from "../../../middleware/XJsonResponseHandler";
import { XyPrisRequest } from "../../../types/httpServer.type";

/**
 * BodyParser - Handles request body parsing for JSON, URL-encoded, and other formats.
 */
export class BodyParser {
    public static async parse(req: XyPrisRequest): Promise<void> {
        return new Promise((resolve, reject) => {
            const contentType = req.headers["content-type"] || "";
            if (contentType.includes("multipart/form-data")) {
                resolve();
                return;
            }

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


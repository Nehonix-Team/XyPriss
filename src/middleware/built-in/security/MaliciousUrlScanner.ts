import { __strl__ } from "strulink";
import { XyPrisRequest, XyPrisResponse, NextFunction } from "../../../types/httpServer.type";
import { RequestHandler } from "../../../types/types";
import { MaliciousUrlScannerConfig } from "../../../types/mod/security";
import { Logger } from "../../../shared/logger/Logger";

export class MaliciousUrlScanner {
    /**
     * Middleware for scanning incoming URLs for malicious payloads (XSS, Path Traversal, etc.)
     * 
     * @param config Configuration for the URL Scanner
     * @param logger Logger instance
     * @returns RequestHandler middleware
     */
    static middleware(
        config: boolean | MaliciousUrlScannerConfig = false,
        logger?: Logger
    ): RequestHandler {
        // Normalize config
        let scannerConfig: MaliciousUrlScannerConfig = {};
        
        if (typeof config === "boolean") {
            if (!config) return (req: XyPrisRequest, res: XyPrisResponse, next?: NextFunction) => next?.();
            scannerConfig = { enabled: true, mode: "block" };
        } else {
            scannerConfig = config;
        }

        if (scannerConfig.enabled === false) {
            return (req: XyPrisRequest, res: XyPrisResponse, next?: NextFunction) => next?.();
        }

        const mode = scannerConfig.mode || "block";
        const options = scannerConfig.options || {
            minScore: 40,
            sensitivity: 1.0,
            advanced: {
                maxEncodingLayers: 3,
                entropyThreshold: 4.8
            }
        };

        return async (req: XyPrisRequest, res: XyPrisResponse, next?: NextFunction) => {
            try {
                // Reconstruct full URL to scan everything including path and query
                const protocol = req.headers["x-forwarded-proto"] || "http";
                const host = req.headers.host || "localhost";
                const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

                const result = await __strl__.scanUrl(fullUrl, options);

                if (result.isMalicious) {
                    const reasons = result.detectedPatterns.map(p => p.type).join(", ");
                    const logMessage = `[MaliciousUrlScanner] Detected malicious URL (Score: ${result.score}). Reasons: ${reasons}. URL: ${req.url}`;
                    
                    if (logger) {
                        logger.warn("security", logMessage);
                    } else {
                        console.warn(logMessage);
                    }

                    if (mode === "block") {
                        res.status(403).json({
                            error: "Forbidden",
                            code: "EMALICIOUSURL",
                            message: "The request was blocked due to suspected malicious payload."
                        });
                        return;
                    }
                }
                
                next?.();
            } catch (err) {
                if (logger) {
                    logger.error("security", "Failed to scan URL for malicious payloads", err as Error);
                }
                // Fail open or fail closed? Usually fail closed for security, but fail open to avoid breaking app if strulink crashes.
                // We'll call next() to fail open.
                next?.();
            }
        };
    }
}

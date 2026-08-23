import { __strl__ } from "strulink";
import { XyPrisRequest, XyPrisResponse, NextFunction } from "../../../types/httpServer.type";
import { RequestHandler } from "../../../types/types";
import { MaliciousUrlScannerConfig } from "../../../types/mod/security";
import { Logger } from "../../../shared/logger/Logger";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH_REGEX = /^[0-9a-f]{16,64}$/i;
const SAFE_PARAM_REGEX = /^[a-zA-Z0-9_\-.~%@,]+$/;

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
        const options = {
            minScore: 70,
            sensitivity: 1.0,
            enableEntropyAnalysis: false, // Disabled by default to prevent false positives on UUIDs and hash IDs
            ...scannerConfig.options,
            advanced: {
                maxEncodingLayers: 3,
                entropyThreshold: 5.5,
                ...(scannerConfig.options as any)?.advanced,
            },
        };

        return async (req: XyPrisRequest, res: XyPrisResponse, next?: NextFunction) => {
            try {
                const reqPath = req.path || (req.url ? req.url.split("?")[0] : "");

                // Check excluded paths
                if (scannerConfig.excludePaths && scannerConfig.excludePaths.length > 0) {
                    for (const pattern of scannerConfig.excludePaths) {
                        if (typeof pattern === "string") {
                            if (pattern.endsWith("/**")) {
                                const prefix = pattern.slice(0, -3);
                                if (reqPath === prefix || reqPath.startsWith(prefix + "/")) {
                                    return next?.();
                                }
                            } else if (pattern.endsWith("/*")) {
                                const prefix = pattern.slice(0, -2);
                                if (reqPath === prefix || reqPath.startsWith(prefix + "/")) {
                                    return next?.();
                                }
                            } else if (reqPath === pattern || reqPath.startsWith(pattern)) {
                                return next?.();
                            }
                        } else if (pattern instanceof RegExp && pattern.test(reqPath)) {
                            return next?.();
                        }
                    }
                }

                // Reconstruct full URL to scan everything including path and query
                const protocol = req.headers["x-forwarded-proto"] || "http";
                const host = req.headers.host || "localhost";
                const fullUrl = `${protocol}://${host}${req.originalUrl || req.url}`;

                const result = await __strl__.scanUrl(fullUrl, options as any);

                if (result.isMalicious) {
                    // Filter heuristic false positives on standard UUIDs, hashes, standard param names and benign values
                    const genuinePatterns = (result.detectedPatterns || []).filter((p: any) => {
                        if (scannerConfig.ignorePatterns?.includes(p.type)) {
                            return false;
                        }
                        // Ignore benign parameter name alerts (e.g. "password", "token", "auth") in standard API routes
                        if (p.type === "suspicious_parameter") {
                            return false;
                        }
                        if (
                            p.type === "encoded_payload" ||
                            p.type === "multi_encoding" ||
                            p.pattern === "high_entropy" ||
                            p.pattern === "multi_layer_encoding"
                        ) {
                            const val = p.matchedValue || "";
                            if (!val || UUID_REGEX.test(val) || HASH_REGEX.test(val) || SAFE_PARAM_REGEX.test(val)) {
                                return false;
                            }
                        }
                        return true;
                    });

                    if (genuinePatterns.length > 0) {
                        const details = genuinePatterns
                            .map((p: any) => {
                                const desc = p.description ? ` (${p.description})` : "";
                                const match = p.matchedValue ? ` [match: "${p.matchedValue}"]` : "";
                                const loc = p.location ? ` @ ${p.location}` : "";
                                return `${p.type}${desc}${match}${loc}`;
                            })
                            .join(" | ");

                        const logMessage = `[XMUrlS (MaliciousUrlScanner)] Detected malicious URL (Score: ${result.score}, Confidence: ${result.confidence || "unknown"}). URL: ${req.url}\n  -> StruLink Detections: ${details}${result.recommendation ? `\n  -> Recommendation: ${result.recommendation}` : ""}`;
                        
                        if (logger) {
                            logger.warn("security", logMessage);
                        } else {
                            console.warn(logMessage);
                        }

                        if (mode === "block") {
                            if (!res.headersSent && !res.writableEnded) {
                                res.status(403).json({
                                    error: "Forbidden",
                                    code: "EMALICIOUSURL",
                                    message: "The request was blocked due to suspected malicious payload."
                                });
                            }
                            return;
                        }
                    }
                }
                
                next?.();
            } catch (err) {
                if (logger) {
                    logger.error("security", "Failed to scan URL for malicious payloads", err as Error);
                }
                next?.();
            }
        };
    }
}

